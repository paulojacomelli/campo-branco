import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const COLLECTIONS = [
    'users',
    'congregations',
    'cities',
    'territories',
    'addresses',
    'witnessing_points',
    'reports',
    'shared_lists'
];

export async function GET() {
    try {
        const user = await requireAuth(['ANCIAO', 'SUPER_ADMIN']);
        const supabase = createRouteHandlerClient({ cookies });

        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const timestamp = new Date().toISOString();
        const exportType = isSuperAdmin ? 'FULL_EXPORT' : 'CONGREGATION_EXPORT';

        const result: any = {
            meta: {
                type: exportType,
                requestedBy: user.uid,
                role: user.role,
                congregationId: user.congregationId || 'GLOBAL',
                exportedAt: timestamp,
                collections: COLLECTIONS
            },
            data: {}
        };

        for (const tableName of COLLECTIONS) {
            let query = supabase.from(tableName).select('*');

            if (!isSuperAdmin) {
                if (tableName === 'congregations') {
                    query = query.eq('id', user.congregationId);
                } else if (tableName === 'users') {
                    query = query.eq('congregation_id', user.congregationId);
                } else {
                    query = query.eq('congregation_id', user.congregationId);
                }
            }

            const { data, error } = await query;
            if (error) {
                console.error(`Error exporting table ${tableName}:`, error);
                result.data[tableName] = [];
                continue;
            }

            let docs = data || [];

            // DATA HYGIENE
            if (tableName === 'users' && !isSuperAdmin) {
                docs = docs.map(u => ({
                    id: u.id,
                    name: u.name,
                    email: u.email,
                    role: u.role,
                    congregation_id: u.congregation_id,
                }));
            }

            result.data[tableName] = docs;
        }

        const filename = `backup-${isSuperAdmin ? 'FULL' : user.congregationId}-${timestamp.replace(/[:.]/g, '-')}.json`;

        return new NextResponse(JSON.stringify(result, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });

    } catch (error: any) {
        console.error('Export API Error:', error);
        return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
    }
}
