
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// API para listar todas as congregações (uso restrito ao painel admin)
// Utiliza o Firebase Admin SDK para contornar regras de segurança e garantir acesso total
export async function GET(req: Request) {
    try {
        // Extrai o token de autenticação do header Authorization ou cookie de sessão
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
            return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
        }

        // Verifica se o usuário é administrador no Firestore
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        // Permite acesso se for ADMIN ou se for o email mestre
        const isAdmin = userData?.role === 'ADMIN' || decodedToken.email === 'campobrancojw@gmail.com';

        if (!isAdmin) {
            return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
        }

        // Busca todas as congregações ordenadas por nome
        const snapshot = await adminDb.collection('congregations').orderBy('name', 'asc').get();

        const congregations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ success: true, congregations });

    } catch (error: any) {
        console.error('Congregations List API Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
