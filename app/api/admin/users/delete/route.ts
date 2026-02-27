
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

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
        }

        // 1. Verificar permissões do administrador solicitante no Firestore
        const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const adminData = adminDoc.data();

        if (!adminData || (adminData.role !== 'ADMIN' && adminData.role !== 'ANCIAO')) {
            return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 });
        }

        // 2. Buscar o usuário alvo no Firestore
        const targetUserDoc = await adminDb.collection('users').doc(userId).get();
        if (!targetUserDoc.exists) {
            return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
        }
        const targetUserData = targetUserDoc.data();

        // 3. Regras de segurança adicionais
        if (adminData.role !== 'ADMIN') {
            // Se for Ancião, só deleta da própria congregação e não pode deletar Admin ou outro Ancião
            if (targetUserData?.congregationId !== adminData.congregationId) {
                return NextResponse.json({ error: 'Você só pode excluir usuários da sua congregação.' }, { status: 403 });
            }
            if (targetUserData?.role === 'ADMIN' || targetUserData?.role === 'ANCIAO') {
                return NextResponse.json({ error: 'Você não tem permissão para excluir este nível de usuário.' }, { status: 403 });
            }
        }

        console.log(`DEBUG - Excluindo usuário ${userId} via Firebase Admin por admin ${decodedToken.uid}`);

        // 4. Excluir do Firestore
        await adminDb.collection('users').doc(userId).delete();

        // 5. Excluir do Firebase Auth
        try {
            await adminAuth.deleteUser(userId);
        } catch (authError: any) {
            console.warn('Auth User Delete warning (might be already deleted or protected):', authError.message);
            // Não falhamos o processo se o auth falhar (ex: usuário já removido do auth mas ficou no profile)
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('User Delete API Critical Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
