// app/api/shared_lists/return/route.ts
// Processa devolução de mapas e territórios compartilhados no Firestore

import { NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firestore';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, action, territoryId, undo } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID da lista compartilhada é obrigatório' }, { status: 400 });
        }

        // Busca a lista compartilhada no Firestore
        const listRef = adminDb.collection('shared_lists').doc(id);
        const listDoc = await listRef.get();

        if (!listDoc.exists) {
            return NextResponse.json({ error: 'Lista compartilhada não encontrada' }, { status: 404 });
        }

        // AÇÃO 1: Devolver o mapa inteiro
        if (action === 'return_map') {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24); // Acesso por mais 24h

            await listRef.update({
                status: 'completed',
                returnedAt: FieldValue.serverTimestamp(),
                expiresAt: expiresAt.toISOString()
            });

            return NextResponse.json({ success: true, message: 'Mapa devolvido com sucesso!' });
        }

        // AÇÃO 2: Devolver ou desfazer devolução de um território individual
        if (action === 'return_territory' && territoryId) {
            const newStatus = undo ? 'active' : 'completed';

            const snapshotsQuery = await adminDb
                .collection('shared_list_snapshots')
                .where('sharedListId', '==', id)
                .where('itemId', '==', territoryId)
                .get();

            if (!snapshotsQuery.empty) {
                const batch = adminDb.batch();
                snapshotsQuery.docs.forEach(snap => {
                    batch.update(snap.ref, { 'data.visit_status': newStatus });
                });
                await batch.commit();
            }

            // Se estava desfazendo e a lista estava 'completed', reativa
            if (undo && listDoc.data()?.status === 'completed') {
                await listRef.update({
                    status: 'active',
                    returnedAt: null,
                    expiresAt: null
                });
            }

            return NextResponse.json({
                success: true,
                message: undo ? 'Devolução desfeita!' : 'Território devolvido!'
            });
        }

        // AÇÃO 3: Aceitar responsabilidade pela lista
        if (action === 'accept_responsibility') {
            const { userId, userName, userCongregationId } = body;

            if (!userId) {
                return NextResponse.json({ error: 'Usuário não informado' }, { status: 400 });
            }

            await listRef.update({
                assignedTo: userId,
                assignedName: userName || 'Irmão sem Nome'
            });

            // Vincula o usuário à congregação da lista se ele ainda não tiver
            if (userCongregationId) {
                const userRef = adminDb.collection('users').doc(userId);
                const userDoc = await userRef.get();
                const userData = userDoc.data();

                if (userData && !userData.congregationId && !userData.congregation_id) {
                    await userRef.update({
                        congregationId: userCongregationId,
                        role: 'PUBLICADOR'
                    });
                    return NextResponse.json({ success: true, reloadRequired: true });
                }
            }

            return NextResponse.json({ success: true, reloadRequired: false });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });

    } catch (error: any) {
        console.error('Shared List Return API Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
