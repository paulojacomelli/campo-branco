
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
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

        const url = new URL(req.url);
        let congregationId = url.searchParams.get('congregationId');

        // Busca o perfil do usuário no Firestore
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const adminData = userDoc.data();

        // Security: Force congregationId to be the user's congregation for operational views
        if (adminData?.role !== 'ADMIN' || !congregationId) {
            congregationId = adminData?.congregationId || null;
        }

        const isAllowed = adminData && (
            adminData.role === 'ADMIN' ||
            (['ELDER', 'SERVANT', 'ANCIAO', 'SERVO'].includes(adminData.role || ''))
        );

        if (!isAllowed || !congregationId) {
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
        }

        // Busca as cidades da congregação no Firestore (Tenta ambos os campos por segurança)
        let citiesSnapshot = await adminDb.collection('cities')
            .where('congregationId', '==', congregationId)
            .get();

        if (citiesSnapshot.empty) {
            citiesSnapshot = await adminDb.collection('cities')
                .where('congregation_id', '==', congregationId)
                .get();
        }

        const cities = citiesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ success: true, cities });
    } catch (error: any) {
        console.error("Cities List API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
