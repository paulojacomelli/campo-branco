// app/api/territories/delete/route.ts
// Exclui um território e trata endereços vinculados (cascade ou orphan)
// Requer autenticação e permissão sobre a congregação

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken, isAdminRole } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const body = await req.json();
        const { id, mode = 'cascade' } = body; // mode pode ser 'cascade' ou 'orphan'

        if (!id) {
            return NextResponse.json({ error: 'ID é obrigatório.' }, { status: 400 });
        }

        // Verificar permissões
        if (!isAdminRole(user.role)) {
            return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 });
        }

        // Obter território alvo para verificar congregação
        const territoryRef = adminDb.collection('territories').doc(id);
        const territorySnap = await territoryRef.get();

        if (!territorySnap.exists) {
            return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
        }

        const territoryData = territorySnap.data() as any;
        const congregationId = territoryData.congregationId || territoryData.congregation_id;

        // Se for Ancião/Servo, só pode deletar da própria congregação
        if (user.role !== 'ADMIN' && congregationId !== user.congregationId) {
            return NextResponse.json({ error: 'Você só pode excluir itens da sua congregação.' }, { status: 403 });
        }

        // Busca endereços vinculados para limpeza
        const addressesRef = adminDb.collection('addresses');
        // Suporte para ambos os nomes de campos durante a transição
        const addrSnap1 = await addressesRef.where('territoryId', '==', id).get();
        const addrSnap2 = await addressesRef.where('territory_id', '==', id).get();

        const allAddrDocs = [...addrSnap1.docs, ...addrSnap2.docs];

        if (allAddrDocs.length > 0) {
            // Firestore tem limite de 500 operações por batch
            const chunks = [];
            for (let i = 0; i < allAddrDocs.length; i += 400) {
                chunks.push(allAddrDocs.slice(i, i + 400));
            }

            for (const chunk of chunks) {
                const batch = adminDb.batch();
                chunk.forEach(doc => {
                    if (mode === 'orphan') {
                        batch.update(doc.ref, {
                            territoryId: null,
                            territory_id: null,
                            updatedAt: new Date().toISOString()
                        });
                    } else {
                        batch.delete(doc.ref);
                    }
                });
                await batch.commit();
            }
        }

        // Finalmente deleta o território
        await territoryRef.delete();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Territory Delete API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
