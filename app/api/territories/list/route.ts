// app/api/territories/list/route.ts
// Lista os territórios de uma cidade com estatísticas de endereços
// Requer autenticação e permissão de acesso à congregação

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken, isAdminRole } from '@/lib/firestore';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const url = new URL(req.url);
        const cityId = url.searchParams.get('cityId');
        let congregationId = url.searchParams.get('congregationId');

        // Garante que usuários não-admin vejam apenas sua própria congregação
        if (user.role !== 'ADMIN' || !congregationId) {
            congregationId = user.congregationId || null;
        }

        // Verifica permissão
        const isAllowed = user.role === 'ADMIN' ||
            ['ANCIAO', 'SERVO', 'PUBLICADOR'].includes(user.role || '');

        if (!isAllowed || !congregationId) {
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
        }

        // 1. Busca os territórios no Firestore
        let teQuery = adminDb.collection('territories')
            .where('congregationId', '==', congregationId)
            .orderBy('name');

        if (cityId) {
            teQuery = adminDb.collection('territories')
                .where('cityId', '==', cityId)
                .where('congregationId', '==', congregationId)
                .orderBy('name');
        }

        const teSnap = await teQuery.get();
        const territories = teSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (territories.length === 0) {
            return NextResponse.json({ success: true, territories: [] });
        }

        const territoryIds = territories.map((t: any) => t.id);

        // 2. Busca endereços ativos para calcular estatísticas
        // Divide em chunks de 30 (limite do Firestore para 'in')
        const statsMap: Record<string, { count: number, men: number, women: number, couples: number }> = {};

        const chunks = [];
        for (let i = 0; i < territoryIds.length; i += 30) {
            chunks.push(territoryIds.slice(i, i + 30));
        }

        for (const chunk of chunks) {
            const addrSnap = await adminDb.collection('addresses')
                .where('territoryId', 'in', chunk)
                .where('isActive', '==', true)
                .get();

            addrSnap.docs.forEach(doc => {
                const addr = doc.data();
                if (!statsMap[addr.territoryId]) {
                    statsMap[addr.territoryId] = { count: 0, men: 0, women: 0, couples: 0 };
                }
                statsMap[addr.territoryId].count++;
                if (addr.gender === 'HOMEM') statsMap[addr.territoryId].men++;
                else if (addr.gender === 'MULHER') statsMap[addr.territoryId].women++;
                else if (addr.gender === 'CASAL') statsMap[addr.territoryId].couples++;
            });
        }

        // 3. Mescla estatísticas aos territórios
        const formattedTerritories = territories.map((t: any) => {
            const stats = statsMap[t.id] || { count: 0, men: 0, women: 0, couples: 0 };
            return {
                ...t,
                addressCount: stats.count,
                menCount: stats.men,
                womenCount: stats.women,
                couplesCount: stats.couples
            };
        });

        return NextResponse.json({ success: true, territories: formattedTerritories });
    } catch (error: any) {
        console.error("API Territories List Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
