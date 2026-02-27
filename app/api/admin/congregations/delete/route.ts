
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        let token = '';

        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else {
            // Tenta obter do cookie se não estiver no header (padrão do App Hosting)
            const cookie = req.headers.get('cookie');
            token = cookie?.split('__session=')[1]?.split(';')[0] || '';
        }

        if (!token) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        const { id: congregationId, force } = await req.json();

        if (!congregationId) {
            return NextResponse.json({ error: 'ID da congregação é obrigatório.' }, { status: 400 });
        }

        // 1. Verificar se é Admin
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'ADMIN' && decodedToken.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        const collectionsToCleanup = ['territories', 'addresses', 'witnessing_points', 'shared_lists', 'visits'];
        const collectionsToUnlink = ['cities', 'users'];

        if (!force) {
            // Check for relations
            for (const collName of [...collectionsToCleanup, ...collectionsToUnlink]) {
                const snapshot = await adminDb.collection(collName).where('congregationId', '==', congregationId).limit(1).get();
                if (!snapshot.empty) {
                    return NextResponse.json({
                        code: 'HAS_RELATIONS',
                        error: `Esta congregação possui dados vinculados em '${collName}'. Deseja realizar uma limpeza total e excluir assim mesmo?`
                    }, { status: 400 });
                }
            }
        } else {
            // Force cleanup
            console.log(`DEBUG - Executando limpeza total para congregação ${congregationId}...`);

            for (const collName of collectionsToCleanup) {
                const snapshot = await adminDb.collection(collName).where('congregationId', '==', congregationId).get();
                const batch = adminDb.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }

            for (const collName of collectionsToUnlink) {
                const snapshot = await adminDb.collection(collName).where('congregationId', '==', congregationId).get();
                const batch = adminDb.batch();
                snapshot.docs.forEach(doc => batch.update(doc.ref, { congregationId: null }));
                await batch.commit();
            }
        }

        // 2. Excluir a congregação
        await adminDb.collection('congregations').doc(congregationId).delete();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Congregation Delete API Critical Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
