// app/api/shared_lists/create/route.ts
// Cria uma lista de compartilhamento e salva snapshots dos itens no Firestore

import { NextResponse } from 'next/server';
import { adminDb, FieldValue } from '@/lib/firestore';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { listData, territories } = body;

        // 1. Inserir em 'shared_lists' no Firestore
        // Mapear campos snake_case se existirem
        const finalData = {
            ...listData,
            congregationId: listData.congregationId || listData.congregation_id,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        };

        // Remover campo legado se presente no mapeamento acima
        delete finalData.congregation_id;

        const shareDoc = await adminDb.collection('shared_lists').add(finalData);
        const shareId = shareDoc.id;

        // 2. Criar snapshots (Territórios + Endereços)
        if (territories && Array.isArray(territories)) {
            const batch = adminDb.batch();
            const snapshotsRef = adminDb.collection('shared_list_snapshots');

            // Snapshot dos Territórios
            territories.forEach((t: any) => {
                const snapRef = snapshotsRef.doc();
                batch.set(snapRef, {
                    sharedListId: shareId,
                    itemId: t.id,
                    type: 'territory',
                    data: {
                        ...t,
                        visit_status: 'none'
                    },
                    createdAt: FieldValue.serverTimestamp()
                });
            });

            // Buscar Endereços vinculados para snapshot
            const territoryIds = territories.map((t: any) => t.id);
            if (territoryIds.length > 0) {
                // Firestore limit 30 in 'in' query
                const chunks = [];
                for (let i = 0; i < territoryIds.length; i += 30) {
                    chunks.push(territoryIds.slice(i, i + 30));
                }

                for (const chunk of chunks) {
                    const addrSnap = await adminDb.collection('addresses')
                        .where('territoryId', 'in', chunk)
                        .get();

                    addrSnap.docs.forEach(doc => {
                        const snapRef = snapshotsRef.doc();
                        batch.set(snapRef, {
                            sharedListId: shareId,
                            itemId: doc.id,
                            type: 'address',
                            data: {
                                ...doc.data(),
                                visit_status: 'none'
                            },
                            createdAt: FieldValue.serverTimestamp()
                        });
                    });
                }
            }

            await batch.commit();
        }

        return NextResponse.json({ shareData: { id: shareId, ...finalData } });
    } catch (error: any) {
        console.error("Shared List API Error:", error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
