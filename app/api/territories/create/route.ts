// app/api/territories/create/route.ts
// Cria um novo território no Firestore
// Requer autenticação e permissão de ancião ou servo

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
        const { name, notes, cityId, congregationId, lat, lng, status } = body;

        // Suporte para nomes de campos antigos se vierem do frontend antigo
        const finalCityId = cityId || body.city_id;
        const finalCongregationId = congregationId || body.congregation_id;

        if (!name || !finalCityId || !finalCongregationId) {
            return NextResponse.json({ error: 'Nome, cidade e congregação são obrigatórios.' }, { status: 400 });
        }

        // Verificar permissões
        if (!isAdminRole(user.role)) {
            return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 });
        }

        // Se for Ancião/Servo, só pode criar para a própria congregação
        if (user.role !== 'ADMIN' && finalCongregationId !== user.congregationId) {
            return NextResponse.json({ error: 'Você só pode gerenciar dados da sua congregação.' }, { status: 403 });
        }

        const newTerritory = {
            name,
            notes: notes || null,
            cityId: finalCityId,
            congregationId: finalCongregationId,
            lat: lat || null,
            lng: lng || null,
            status: status || 'LIVRE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user.uid
        };

        const docRef = await adminDb.collection('territories').add(newTerritory);

        return NextResponse.json({ success: true, id: docRef.id });
    } catch (error: any) {
        console.error('Territory Create API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
