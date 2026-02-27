
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

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

        // Busca o perfil do usuário no Firestore para validar permissão de Admin
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const userData = userDoc.data();

        if (userData?.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Acesso restrito a Admins' }, { status: 403 });
        }

        const body = await req.json();
        const { id, name, city, category, term_type, customId } = body;

        if (!name) {
            return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
        }

        const formData: any = {
            name: name.trim(),
            city: city ? city.trim() : null,
            category: category ? category.trim() : null,
            term_type: term_type || 'city',
            updatedAt: FieldValue.serverTimestamp()
        };

        let resultId = id;

        if (id) {
            // Update
            await adminDb.collection('congregations').doc(id).update(formData);
        } else {
            // Insert
            formData.createdAt = FieldValue.serverTimestamp();
            if (customId && customId.trim()) {
                resultId = customId.trim();
                await adminDb.collection('congregations').doc(resultId).set(formData);
            } else {
                const docRef = await adminDb.collection('congregations').add(formData);
                resultId = docRef.id;
            }
        }

        return NextResponse.json({
            success: true,
            data: { id: resultId, ...formData }
        });

    } catch (error: any) {
        console.error('Congregation Save API Critical Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
