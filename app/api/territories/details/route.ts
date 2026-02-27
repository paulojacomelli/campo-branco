// app/api/territories/details/route.ts
// Busca detalhes de um ou mais territórios no Firestore
// Requer autenticação e permissão sobre a congregação

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const url = new URL(req.url);
        const idsParam = url.searchParams.get('ids');

        if (!idsParam) {
            return NextResponse.json({ error: 'IDs não fornecidos' }, { status: 400 });
        }

        const ids = idsParam.split(',').filter(Boolean);

        // 1. Busca os territórios no Firestore
        // O Firestore não tem um "where in" para documentos individuais se forem muitos, 
        // mas para IDs usamos documentos específicos ou queries.
        const territories: any[] = [];
        const promises = ids.map(id => adminDb.collection('territories').doc(id).get());
        const snapshots = await Promise.all(promises);

        snapshots.forEach(snap => {
            if (snap.exists) {
                territories.push({ id: snap.id, ...snap.data() });
            }
        });

        if (territories.length === 0) {
            return NextResponse.json({ success: true, territories: [] });
        }

        // 2. SECURE: Verificar permissão (deve pertencer à congregação do usuário)
        if (user.role !== 'ADMIN') {
            const hasUnauthorized = territories.some(t => {
                const congId = t.congregationId || t.congregation_id;
                return congId !== user.congregationId;
            });
            if (hasUnauthorized) {
                return NextResponse.json({ error: 'Você não tem permissão para acessar alguns dos territórios solicitados.' }, { status: 403 });
            }
        }

        return NextResponse.json({
            success: true,
            territories
        });

    } catch (error: any) {
        console.error("Critical Error in /api/territories/details:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
