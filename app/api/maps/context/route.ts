
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

// API para buscar o contexto de navegação (congregação, cidade, território)
// Utilizada para montar o breadcrumb e as informações de cabeçalho em páginas de mapas
export async function GET(req: Request) {
    try {
        // Extrai o token de autenticação do header ou cookie
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
        const congregationId = url.searchParams.get('congregationId');
        const cityId = url.searchParams.get('cityId');
        const territoryId = url.searchParams.get('territoryId');

        // Busca o perfil do usuário e verifica permissões
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        const userCong = String(userData?.congregationId || userData?.congregation_id || '').toLowerCase().trim();
        const reqCong = String(congregationId || '').toLowerCase().trim();

        // Valida se o usuário tem acesso à congregação solicitada
        const isAllowed = userData && (
            userData.role === 'ADMIN' ||
            (userCong === reqCong && (['ELDER', 'SERVANT', 'ADMIN', 'ANCIAO', 'SERVO'].includes(userData.role || '')))
        );

        if (!isAllowed) {
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
        }

        // Busca os dados de contexto em paralelo no Firestore
        const [congData, cityData, terrData] = await Promise.all([
            congregationId
                ? adminDb.collection('congregations').doc(congregationId).get()
                : Promise.resolve(null),
            cityId
                ? adminDb.collection('cities').doc(cityId).get()
                : Promise.resolve(null),
            territoryId
                ? adminDb.collection('territories').doc(territoryId).get()
                : Promise.resolve(null)
        ]);

        return NextResponse.json({
            success: true,
            // Normaliza os campos para manter compatibilidade com o front-end
            congregation: congData?.exists ? { id: congData.id, ...congData.data() } : null,
            city: cityData?.exists ? { id: cityData.id, ...cityData.data() } : null,
            territory: terrData?.exists ? { id: terrData.id, ...terrData.data() } : null
        });

    } catch (error: any) {
        console.error('Maps Context API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
