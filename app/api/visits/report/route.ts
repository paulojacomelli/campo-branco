// app/api/visits/report/route.ts
// Registra uma visita realizada via link de território compartilhado
// Não requer autenticação pois o acesso é controlado pelo shareId

import { NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firestore';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { visitData, shareId } = body;

        if (!shareId || !visitData) {
            return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
        }

        // 1. Verifica se a lista compartilhada existe e não está expirada
        const listRef = adminDb.collection('sharedLists').doc(shareId);
        const listSnap = await listRef.get();

        if (!listSnap.exists) {
            return NextResponse.json({ error: 'Link de compartilhamento inválido' }, { status: 403 });
        }

        const list = listSnap.data()!;

        if (list.expiresAt) {
            const expiresDate = list.expiresAt.toDate ? list.expiresAt.toDate() : new Date(list.expiresAt);
            if (new Date() > expiresDate) {
                return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
            }
        }

        // 2. Insere a visita vinculada à congregação da lista
        const finalVisitData = {
            ...visitData,
            sharedListId: shareId,
            congregationId: list.congregationId,
            createdAt: FieldValue.serverTimestamp(),
        };

        const visitRef = await adminDb.collection('visits').add(finalVisitData);
        const visitSnap = await visitRef.get();

        return NextResponse.json({ success: true, visit: { id: visitRef.id, ...visitSnap.data() } });

    } catch (error: any) {
        console.error("Critical Error in /api/visits/report:", error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
