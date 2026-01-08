
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

// Strict whitelist of collections to export
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

export async function GET(request: Request) {
    try {
        const user = await requireAuth(['ANCIAO', 'SUPER_ADMIN']);

        if (!adminDb) {
            return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
        }

        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const timestamp = new Date().toISOString();
        const exportType = isSuperAdmin ? 'FULL_EXPORT' : 'CONGREGATION_EXPORT';

        // Metadata Header
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

        for (const collectionName of COLLECTIONS) {
            let query: FirebaseFirestore.Query = adminDb.collection(collectionName);

            // SCOPING LOGIC
            if (!isSuperAdmin) {
                // Determine if collection has congregationId
                // 'congregations' collection: Elder sees ONLY their own doc
                if (collectionName === 'congregations') {
                    // Logic handled below special case
                } else if (collectionName === 'users') {
                    query = query.where('congregationId', '==', user.congregationId);
                } else {
                    // Generic collections (cities, territories, etc.) usually have congregationId
                    // Except global configs or similar. 
                    // Let's check safety. If a collection lacks congregationId, an empty query result is better than leaking.
                    // However, we know our schema.
                    // 'shared_lists' has congregationId.
                    // 'reports' has congregationId (usually) or userId. 
                    // Let's assume schema compliance.
                    query = query.where('congregationId', '==', user.congregationId);
                }
            }

            // Special fetch logic
            let docs: any[] = [];

            if (collectionName === 'congregations' && !isSuperAdmin) {
                // Fetch single doc
                if (user.congregationId) {
                    const doc = await adminDb.collection('congregations').doc(user.congregationId).get();
                    if (doc.exists) {
                        docs.push({ _id: doc.id, ...doc.data() });
                    }
                }
            } else {
                const snapshot = await query.get();
                snapshot.forEach(doc => {
                    docs.push({
                        _id: doc.id,
                        ...doc.data()
                    });
                });
            }

            // DATA HYGIENE (Users)
            if (collectionName === 'users') {
                docs = docs.map(u => {
                    // Always sanitizing users, even for Super Admin? 
                    // No, Super Admin sees all. Elder sees sanitized.
                    if (!isSuperAdmin) {
                        return {
                            _id: u._id,
                            uid: u.uid || u._id,
                            name: u.name || u.displayName,
                            email: u.email, // keeping email for contact
                            role: u.role,
                            congregationId: u.congregationId,
                            // Explicitly exclude sensitive auth fields
                        };
                    }
                    return u;
                });
            }

            result.data[collectionName] = docs;
        }

        // Return JSON file
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
