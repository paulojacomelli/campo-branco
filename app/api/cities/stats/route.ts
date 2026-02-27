
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
        const startDateString = url.searchParams.get('startDate');
        const endDateString = url.searchParams.get('endDate');

        // Busca o perfil do usuário no Firestore
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const adminData = userDoc.data();

        // Security: Force congregationId to be the user's congregation for operational views
        if (adminData?.role !== 'ADMIN' || !congregationId) {
            congregationId = adminData?.congregationId || null;
        }

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregação não identificada' }, { status: 400 });
        }

        // 1. Fetch all territories for this congregation
        let territoriesSnapshot = await adminDb.collection('territories')
            .where('congregationId', '==', congregationId)
            .get();

        if (territoriesSnapshot.empty) {
            territoriesSnapshot = await adminDb.collection('territories')
                .where('congregation_id', '==', congregationId)
                .get();
        }

        const territories = territoriesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // 2. Fetch all shared_lists for this congregation (filter in memory for speed/indexes)
        let assignmentsSnapshot = await adminDb.collection('shared_lists')
            .where('congregationId', '==', congregationId)
            .get();

        if (assignmentsSnapshot.empty) {
            assignmentsSnapshot = await adminDb.collection('shared_lists')
                .where('congregation_id', '==', congregationId)
                .get();
        }

        let history = assignmentsSnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((item: any) => item.status === 'completed');

        // Filter by date logically
        if (startDateString || endDateString) {
            const start = startDateString ? new Date(startDateString) : null;
            const end = endDateString ? new Date(endDateString) : null;

            history = history.filter((item: any) => {
                const dateVal = item.returnedAt || item.returned_at;
                const returnedAt = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
                if (!returnedAt) return false;
                if (start && returnedAt < start) return false;
                if (end && returnedAt > end) return false;
                return true;
            });
        }

        // 3. Fetch all Addresses for this congregation
        let addressesSnapshot = await adminDb.collection('addresses')
            .where('congregationId', '==', congregationId)
            .get();

        if (addressesSnapshot.empty) {
            addressesSnapshot = await adminDb.collection('addresses')
                .where('congregation_id', '==', congregationId)
                .get();
        }

        let addresses = addressesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        if (startDateString || endDateString) {
            const start = startDateString ? new Date(startDateString) : null;
            const end = endDateString ? new Date(endDateString) : null;

            addresses = addresses.filter((item: any) => {
                const dateVal = item.lastVisitedAt || item.last_visited_at;
                const visitedAt = dateVal?.toDate ? dateVal.toDate() : (dateVal ? new Date(dateVal) : null);
                if (!visitedAt) return false;
                if (start && visitedAt < start) return false;
                if (end && visitedAt > end) return false;
                return true;
            });
        }

        return NextResponse.json({
            success: true,
            territories,
            history,
            addresses
        });
    } catch (error: any) {
        console.error("Cities Stats API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
