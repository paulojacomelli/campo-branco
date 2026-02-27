// app/api/data/export/route.ts
// Exporta dados do Firestore para CSV compatível com o importador
// Requer autenticação e permissão de administrador ou ancião

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getUserFromToken, canAccessCongregation, isAdminRole } from '@/lib/firestore';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregationId = url.searchParams.get('congregationId');
        const cityId = url.searchParams.get('cityId');
        const territoryId = url.searchParams.get('territoryId');

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregação não informada' }, { status: 400 });
        }

        // Verificar permissão
        if (!canAccessCongregation(user, congregationId) || !isAdminRole(user.role)) {
            return NextResponse.json({ error: 'Acesso negado à congregação.' }, { status: 403 });
        }

        // 1. Buscar endereços no Firestore
        let addrQuery = adminDb.collection('addresses')
            .where('congregationId', '==', congregationId);

        if (territoryId) {
            addrQuery = addrQuery.where('territoryId', '==', territoryId);
        } else if (cityId) {
            addrQuery = addrQuery.where('cityId', '==', cityId);
        }

        const addrSnap = await addrQuery.get();
        const addresses = addrSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (addresses.length === 0) {
            // Tenta buscar usando campo legado 'congregation_id' para garantir que nada fique para trás
            const addrSnapLegacy = await adminDb.collection('addresses')
                .where('congregation_id', '==', congregationId)
                .get();
            addresses.push(...addrSnapLegacy.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }

        // Coletar IDs únicos de territórios e cidades para lookup
        const territoryIds = Array.from(new Set(addresses.map((a: any) => a.territoryId || a.territory_id).filter(Boolean)));
        const cityIds = Array.from(new Set(addresses.map((a: any) => a.cityId || a.city_id).filter(Boolean)));

        const territoryMap: Record<string, any> = {};
        const cityMap: Record<string, any> = {};

        // Busca em paralelo para performance
        await Promise.all([
            ...territoryIds.map(async (tid: any) => {
                const doc = await adminDb.collection('territories').doc(tid).get();
                if (doc.exists) territoryMap[tid] = doc.data();
            }),
            ...cityIds.map(async (cid: any) => {
                const doc = await adminDb.collection('cities').doc(cid).get();
                if (doc.exists) cityMap[cid] = doc.data();
            })
        ]);

        // Cabeçalho do CSV
        const headers = [
            'Cidade', 'UF', 'Número do Mapa', 'Descrição', 'Endereço',
            'Quantidade de residentes', 'Nome', 'Link do Maps', 'Link do Waze',
            'Status', 'Surdo', 'Menor de idade', 'Estudante', 'Neurodivergente',
            'Gênero', 'Observações', 'Resultado da ultima visita', 'Ordem na listagem'
        ];

        const rows = addresses.map((addr: any) => {
            const city = cityMap[addr.cityId || addr.city_id] || { name: '', uf: '' };
            const territory = territoryMap[addr.territoryId || addr.territory_id] || { name: '', notes: '' };

            return [
                city.name || '',
                city.uf || '',
                territory.name || '',
                territory.notes || '',
                addr.street || '',
                addr.residentsCount || addr.residents_count || 1,
                addr.residentName || addr.resident_name || '',
                addr.googleMapsLink || addr.google_maps_link || '',
                addr.wazeLink || addr.waze_link || '',
                (addr.isActive ?? addr.is_active) !== false ? 'true' : 'false',
                (addr.isDeaf ?? addr.is_deaf) ? 'true' : 'false',
                (addr.isMinor ?? addr.is_minor) ? 'true' : 'false',
                (addr.isStudent ?? addr.is_student) ? 'true' : 'false',
                (addr.isNeurodivergent ?? addr.is_neurodivergent) ? 'true' : 'false',
                addr.gender || '',
                addr.observations || '',
                addr.visitStatus || addr.visit_status || 'not_contacted',
                addr.sortOrder ?? addr.sort_order ?? 0
            ];
        });

        // Escapar e formatar CSV
        const escapeCell = (cell: any): string => {
            const text = String(cell ?? '');
            if (text.includes(';') || text.includes('"') || text.includes('\n')) {
                return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
        };

        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(escapeCell).join(';'))
        ].join('\n');

        // UTF-8 BOM
        const BOM = '\ufeff';
        const encoder = new TextEncoder();
        const csvBytes = encoder.encode(csvContent);
        const bomBytes = new Uint8Array([0xEF, 0xBB, 0xBF]);

        const finalContent = new Uint8Array(bomBytes.length + csvBytes.length);
        finalContent.set(bomBytes);
        finalContent.set(csvBytes, bomBytes.length);

        const fileName = `export_campo_branco_${new Date().getTime()}.csv`;

        return new Response(finalContent, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${fileName}"`
            }
        });

    } catch (error: any) {
        console.error("Export API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
