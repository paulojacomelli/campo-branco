
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

        const { userId, name, role, congregation_id } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'ID do usuário é obrigatório.' }, { status: 400 });
        }

        // 1. Verificar permissões do administrador solicitante no Firestore
        const adminDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        const adminData = adminDoc.data();

        if (!adminData || (adminData.role !== 'ADMIN' && adminData.role !== 'ANCIAO' && adminData.role !== 'SERVO')) {
            return NextResponse.json({ error: 'Você não tem permissão para atualizar usuários.' }, { status: 403 });
        }

        // 2. Buscar o usuário alvo no Firestore
        const targetUserDoc = await adminDb.collection('users').doc(userId).get();
        if (!targetUserDoc.exists) {
            return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
        }
        const targetUserData = targetUserDoc.data();

        // 3. Regras de segurança
        if (adminData.role !== 'ADMIN') {
            // Se for Ancião ou Servo, só edita da própria congregação
            if (targetUserData?.congregationId !== adminData.congregationId) {
                return NextResponse.json({ error: 'Você só pode editar usuários da sua congregação.' }, { status: 403 });
            }
            if (targetUserData?.role === 'ADMIN') {
                return NextResponse.json({ error: 'Você não pode editar um Admin.' }, { status: 403 });
            }
            if (role === 'ADMIN') {
                return NextResponse.json({ error: 'Você não pode promover alguém a Admin.' }, { status: 403 });
            }
        }

        console.log(`DEBUG - Atualizando usuário ${userId} via Firebase Admin`);

        // 4. Atualizar no Firestore
        await adminDb.collection('users').doc(userId).update({
            name: name || targetUserData?.name,
            role: role || targetUserData?.role,
            congregationId: congregation_id || targetUserData?.congregationId || null,
            updatedAt: new Date()
        });

        // 5. Atualizar nome no Firebase Auth
        if (name) {
            try {
                await adminAuth.updateUser(userId, {
                    displayName: name
                });
            } catch (e) {
                console.warn("Auth displayName update failed (non-critical):", e);
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('User Update API Critical Error:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
