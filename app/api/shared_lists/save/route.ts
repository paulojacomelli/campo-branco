// app/api/shared_lists/save/route.ts
// Salva ou cria uma lista compartilhada no Firestore
// Requer autenticação e permissão de ancião ou admin

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken, FieldValue } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const body = await req.json();
        const { payload, id } = body;

        if (!payload) {
            return NextResponse.json({ error: 'Payload não fornecido' }, { status: 400 });
        }

        // Mapear campos legados para consistência
        if (payload.congregation_id) {
            payload.congregationId = payload.congregation_id;
            delete payload.congregation_id;
        }

        // SEGURANÇA: Validar alinhamento da congregação
        if (user.role !== 'ADMIN') {
            if (payload.congregationId && payload.congregationId !== user.congregationId) {
                return NextResponse.json({ error: 'Acesso negado à congregação solicitada' }, { status: 403 });
            }
            payload.congregationId = user.congregationId;
        }

        if (id) {
            // Atualização
            await adminDb.collection('shared_lists').doc(id).update({
                ...payload,
                updatedAt: FieldValue.serverTimestamp()
            });
            return NextResponse.json({ success: true, id });
        } else {
            // Criação
            const docRef = await adminDb.collection('shared_lists').add({
                ...payload,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
            return NextResponse.json({ success: true, id: docRef.id });
        }
    } catch (error: any) {
        console.error("Shared List Save API Error:", error);
        return NextResponse.json({
            error: error.message || 'Erro interno no servidor'
        }, { status: 500 });
    }
}
