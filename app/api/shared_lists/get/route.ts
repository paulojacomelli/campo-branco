// app/api/shared_lists/get/route.ts
// Busca os dados de uma lista compartilhada por ID via Firebase Admin SDK

import { adminDb } from '@/lib/firestore';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID do link ausente' }, { status: 400 });
        }

        // 1. Busca os metadados da lista compartilhada no Firestore
        const listDoc = await adminDb.collection('shared_lists').doc(id).get();

        if (!listDoc.exists) {
            return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
        }

        const list = { id: listDoc.id, ...listDoc.data() };

        // 2. Verifica se o link está expirado
        const expiresAt = (list as any).expiresAt || (list as any).expires_at;
        if (expiresAt) {
            const now = new Date();
            const expires = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
            if (now > expires) {
                return NextResponse.json({ error: 'Link expirado' }, { status: 410 });
            }
        }

        // 3. Busca os snapshots
        let items: any[] = [];
        const snapshotsSnap = await adminDb.collection('shared_list_snapshots')
            .where('sharedListId', '==', id)
            .get();

        if (!snapshotsSnap.empty) {
            items = snapshotsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // 4. Busca o histórico de visitas
        const visitsSnap = await adminDb.collection('visits')
            .where('sharedListId', '==', id)
            .get();
        const visits = visitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 5. Busca categoria da congregação
        let congregationCategory = 'TRADITIONAL';
        const congregationId = (list as any).congregationId || (list as any).congregation_id;

        if (congregationId) {
            const congDoc = await adminDb.collection('congregations').doc(congregationId).get();
            if (congDoc.exists) {
                congregationCategory = congDoc.data()?.category || 'TRADITIONAL';
            }
        }

        return NextResponse.json({
            success: true,
            list,
            items,
            visits,
            congregationCategory
        });

    } catch (error: any) {
        console.error("Erro crítico em /api/shared_lists/get:", error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
