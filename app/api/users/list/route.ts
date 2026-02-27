// app/api/users/list/route.ts
// Lista usuários (membros) de uma congregação no Firestore
// Requer autenticação e permissão de acesso à congregação

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken } from '@/lib/firestore';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const currentUser = await getUserFromToken(token) as any;

        if (!currentUser) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregationId = url.searchParams.get('congregationId');

        if (!congregationId) {
            return NextResponse.json({ error: 'ID da congregação ausente' }, { status: 400 });
        }

        // Verifica permissão (Ancião do próprio congregação ou Admin)
        if (currentUser.role !== 'ADMIN' && currentUser.congregationId !== congregationId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        // Busca membros na coleção 'users' do Firestore
        // Tenta campo novo e legado
        let usersSnap = await adminDb.collection('users')
            .where('congregationId', '==', congregationId)
            .get();

        if (usersSnap.empty) {
            usersSnap = await adminDb.collection('users')
                .where('congregation_id', '==', congregationId)
                .get();
        }

        const users = usersSnap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || 'Sem nome',
                email: data.email || '',
                avatar_url: data.photoURL || data.avatar_url || data.picture || null,
                role: data.role
            };
        }).sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ users });
    } catch (error: any) {
        console.error("List users API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
