
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
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const decodedToken = await adminAuth.verifyIdToken(token);

        // Get user's congregation and role from profile (Firestore)
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const profile = userDoc.data();

        const { searchParams } = new URL(req.url);
        let congregationId = searchParams.get('congregationId');

        // Force congregationId to be the user's congregation for non-admins
        if (profile?.role !== 'ADMIN' || !congregationId) {
            congregationId = profile?.congregationId || null;
        }

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregação não identificada' }, { status: 400 });
        }

        // Fetch Territories
        const territoriesSnap = await adminDb.collection('territories')
            .where('congregationId', '==', congregationId)
            .get();
        const territories = territoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Cities
        const citiesSnap = await adminDb.collection('cities')
            .where('congregationId', '==', congregationId)
            .get();
        const cities = citiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Shared Lists (History)
        const sharedListsSnap = await adminDb.collection('shared_lists')
            .where('congregationId', '==', congregationId)
            .get();
        const sharedLists = sharedListsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return NextResponse.json({
            territories: territories || [],
            cities: cities || [],
            sharedLists: sharedLists || []
        });
    } catch (error: any) {
        console.error("Registry Fetch API Error:", error);
        return NextResponse.json({
            error: error.message || 'Erro interno no servidor'
        }, { status: 500 });
    }
}
