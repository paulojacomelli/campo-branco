
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('Authorization');
        let token = '';

        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else {
            const cookie = req.headers.get('cookie');
            token = cookie?.split('__session=')[1]?.split(';')[0] || '';
        }

        if (!token) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const decodedToken = await adminAuth.verifyIdToken(token);
        const { oldId, newId } = await req.json();

        if (!oldId || !newId || oldId === newId) {
            return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
        }

        // 1. Verificar se é Admin
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'ADMIN' && decodedToken.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        console.log(`DEBUG - Iniciando migração de congregação: ${oldId} -> ${newId}`);

        // 2. Buscar a congregação original
        const oldCongDoc = await adminDb.collection('congregations').doc(oldId).get();

        if (!oldCongDoc.exists) {
            return NextResponse.json({ error: 'Congregação original não encontrada.' }, { status: 404 });
        }

        const originalCong = oldCongDoc.data();

        // 3. Criar a nova congregação com o novo ID (Cópia) se ela não existir
        const newCongDoc = await adminDb.collection('congregations').doc(newId).get();

        if (!newCongDoc.exists) {
            console.log(`DEBUG - Criando nova congregação ${newId}...`);
            await adminDb.collection('congregations').doc(newId).set({
                ...originalCong,
                updatedAt: new Date()
            });
        } else {
            console.log(`DEBUG - Congregação de destino ${newId} já existe. Transferindo dados...`);
        }

        // 4. Atualizar todas as coleções vinculadas
        const collections = [
            'cities',
            'users',
            'territories',
            'addresses',
            'witnessing_points',
            'shared_lists',
            'visits'
        ];

        for (const collName of collections) {
            console.log(`DEBUG - Migrando coleção ${collName}...`);
            const snapshot = await adminDb.collection(collName).where('congregationId', '==', oldId).get();

            if (snapshot.empty) continue;

            const batch = adminDb.batch();
            snapshot.docs.forEach(doc => {
                batch.update(doc.ref, { congregationId: newId });
            });
            await batch.commit();
        }

        // 5. Remover a congregação antiga
        await adminDb.collection('congregations').doc(oldId).delete();

        return NextResponse.json({ success: true, message: 'Migração concluída com sucesso!' });

    } catch (error: any) {
        console.error('Migration API Critical Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
