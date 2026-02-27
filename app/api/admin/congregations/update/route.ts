
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

        // 1. Verificar permissões do administrador solicitante no Firestore
        const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const adminData = adminDoc.data();

        if (!adminData || adminData.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Você não tem permissão para realizar esta ação.' }, { status: 403 });
        }

        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'ID da congregação é obrigatório.' }, { status: 400 });
        }

        console.log(`DEBUG - Atualizando congregação ${id} via Firebase Admin`);

        // 2. Atualizar no Firestore
        // Removemos o ID do corpo de atualizações para não duplicar campos se necessário
        delete updates.id;

        // Adicionamos timestamp de atualização
        updates.updatedAt = FieldValue.serverTimestamp();

        await adminDb.collection('congregations').doc(id).update(updates);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Congregation Update API Critical Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
