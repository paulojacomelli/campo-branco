// app/api/admin/fix-duplicates/route.ts
// Mescla territórios com nomes duplicados (ex: '1' e '01') no Firestore

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user || user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregationId = url.searchParams.get('congregationId');

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregacão não informada' }, { status: 400 });
        }

        // 1. Buscar todos os territórios desta congregação
        const terrSnap = await adminDb.collection('territories')
            .where('congregationId', '==', congregationId)
            .get();

        const territories = terrSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

        if (territories.length === 0) return NextResponse.json({ success: true, merged: 0 });

        const stats = { found: 0, merged: 0, errors: [] as string[] };
        const territoriesByCity: Record<string, any[]> = {};

        territories.forEach(t => {
            const cityId = t.cityId || t.city_id;
            if (!territoriesByCity[cityId]) territoriesByCity[cityId] = [];
            territoriesByCity[cityId].push(t);
        });

        for (const [cityId, cityTerrs] of Object.entries(territoriesByCity)) {
            for (const t of cityTerrs) {
                const name = (t.name || '').trim();
                // Verifica se é um único dígito (ex: "1")
                if (/^\d+$/.test(name) && name.length === 1) {
                    const normalizedName = name.padStart(2, '0'); // "01"
                    const target = cityTerrs.find(targetT => targetT.name === normalizedName);

                    if (target && target.id !== t.id) {
                        stats.found++;
                        try {
                            // 2. Mover endereços do origem (t.id) para o destino (target.id) via batch
                            const addrSnap = await adminDb.collection('addresses')
                                .where('territoryId', '==', t.id)
                                .get();

                            if (!addrSnap.empty) {
                                const batch = adminDb.batch();
                                addrSnap.docs.forEach(doc => {
                                    batch.update(doc.ref, {
                                        territoryId: target.id,
                                        updatedAt: new Date().toISOString()
                                    });
                                });
                                await batch.commit();
                            }

                            // 3. Excluir território de origem
                            await adminDb.collection('territories').doc(t.id).delete();

                            stats.merged++;
                        } catch (err: any) {
                            stats.errors.push(`Erro mesclando ${name} -> ${normalizedName}: ${err.message}`);
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true, stats });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
