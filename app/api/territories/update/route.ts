// app/api/territories/update/route.ts
// Atualiza um território existente no Firestore
// Requer autenticação e permissão sobre a congregação

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken, isAdminRole } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const body = await req.json();
        const { id, name, notes } = body;

        if (!id || !name) {
            return NextResponse.json({ error: 'ID e Nome são obrigatórios.' }, { status: 400 });
        }

        // Verificar permissões
        if (!isAdminRole(user.role)) {
            return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 });
        }

        // Obter território alvo para verificar congregação
        const territoryRef = adminDb.collection('territories').doc(id);
        const territorySnap = await territoryRef.get();

        if (!territorySnap.exists) {
            return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });
        }

        const territoryData = territorySnap.data() as any;
        const congregationId = territoryData.congregationId || territoryData.congregation_id;

        // Se for Ancião/Servo, só pode atualizar da própria congregação
        if (user.role !== 'ADMIN' && congregationId !== user.congregationId) {
            return NextResponse.json({ error: 'Você só pode atualizar itens da sua congregação.' }, { status: 403 });
        }

        await territoryRef.update({
            name,
            notes: notes || null,
            updatedAt: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Territory Update API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
