// app/api/addresses/list/route.ts
// Lista endereços de um território ou cidade com informações da última visita
// Requer autenticação e permissão de acesso à congregação solicitada

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken, canAccessCongregation, isAdminRole } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token);

        if (!user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregationId = url.searchParams.get('congregationId');
        const cityId = url.searchParams.get('cityId');
        const territoryId = url.searchParams.get('territoryId');

        if (!congregationId || !cityId) {
            return NextResponse.json({ error: 'Parâmetros ausentes' }, { status: 400 });
        }

        // Verifica permissão de acesso à congregação
        if (!canAccessCongregation(user, congregationId) || !isAdminRole(user.role)) {
            return NextResponse.json({ error: 'Você não tem acesso a essa congregação' }, { status: 403 });
        }

        // Busca endereços no Firestore com filtros aplicados
        let query = adminDb.collection('addresses')
            .where('congregationId', '==', congregationId);

        if (territoryId) {
            query = query.where('territoryId', '==', territoryId);
        } else {
            query = query.where('cityId', '==', cityId);
        }

        const addressSnap = await query.get();
        const addresses = addressSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Busca as visitas mais recentes para esses endereços
        const addressIds = addresses.map((a: any) => a.id);
        const visitsMap: Record<string, any> = {};

        if (addressIds.length > 0) {
            // Firestore só suporta até 30 itens por 'in' query, dividindo em chunks
            const chunks = [];
            for (let i = 0; i < addressIds.length; i += 30) {
                chunks.push(addressIds.slice(i, i + 30));
            }

            for (const chunk of chunks) {
                const visitSnap = await adminDb.collection('visits')
                    .where('addressId', 'in', chunk)
                    .orderBy('createdAt', 'desc')
                    .get();

                for (const vDoc of visitSnap.docs) {
                    const vData = vDoc.data();
                    if (!visitsMap[vData.addressId]) {
                        visitsMap[vData.addressId] = vData;
                    }
                }
            }
        }

        // Mescla dados de visita a cada endereço
        const addressesWithStatus = addresses.map((addr: any) => {
            const lastVisit = visitsMap[addr.id];
            return {
                ...addr,
                visit_status: lastVisit?.status || 'none',
                last_visited_at: lastVisit?.createdAt?.toDate?.()?.toISOString() || null
            };
        });

        return NextResponse.json({ success: true, addresses: addressesWithStatus });
    } catch (error: any) {
        console.error("API Address List Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
