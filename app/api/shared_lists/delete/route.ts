// app/api/shared_lists/delete/route.ts
// Exclui uma lista compartilhada no Firestore
// Requer autenticação e permissão de ancião ou admin

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const { id } = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'ID não fornecido' }, { status: 400 });
        }

        // Busca o documento da lista para verificação
        const listDoc = await adminDb.collection('shared_lists').doc(id).get();
        const existingList = listDoc.data();

        if (!listDoc.exists || !existingList) {
            return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
        }

        const listCongregationId = existingList.congregationId || existingList.congregation_id;

        if (user.role !== 'ADMIN' && listCongregationId !== user.congregationId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        await adminDb.collection('shared_lists').doc(id).delete();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Shared List Delete API Error:", error);
        return NextResponse.json({
            error: error.message || 'Erro interno no servidor'
        }, { status: 500 });
    }
}
