
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// -------------------------------------------------------
// EXPORTAÇÃO DE DADOS - Gera CSV compatível com o importador
//
// Formato de saída (separado por ponto e vírgula):
// Nome da cidade;UF;Número do Mapa;Descrição;Endereço;
// Número de residentes;Nome;Link do Maps;Link do Waze;
// Status;Surdo;Menor de idade;Estudante;Neurodivergente;
// Gênero;Observação;visit_status;sort_order
// -------------------------------------------------------

export async function GET(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const congregationId = url.searchParams.get('congregationId');
        const cityId = url.searchParams.get('cityId');
        const territoryId = url.searchParams.get('territoryId');

        if (!congregationId) {
            return NextResponse.json({ error: 'Congregação não informada' }, { status: 400 });
        }

        // Verificar permissão do usuário na congregação
        const { data: adminData } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        if (!adminData || (adminData.role !== 'SUPER_ADMIN' && adminData.congregation_id !== congregationId)) {
            return NextResponse.json({ error: 'Acesso negado à congregação.' }, { status: 403 });
        }

        // Buscar endereços sem join aninhado (territories→cities não está no schema cache)
        let addrQuery = supabaseAdmin
            .from('addresses')
            .select(`
                id,
                territory_id,
                city_id,
                street,
                residents_count,
                resident_name,
                google_maps_link,
                waze_link,
                is_active,
                is_deaf,
                is_minor,
                is_student,
                is_neurodivergent,
                gender,
                observations,
                visit_status,
                last_visited_at,
                sort_order
            `)
            .eq('congregation_id', congregationId);

        if (territoryId) {
            addrQuery = addrQuery.eq('territory_id', territoryId);
        } else if (cityId) {
            addrQuery = addrQuery.eq('city_id', cityId);
        }

        const { data: addresses, error: addrError } = await addrQuery
            .order('territory_id', { ascending: true })
            .order('sort_order', { ascending: true });

        if (addrError) {
            console.error("Export Addresses Error:", addrError);
            throw addrError;
        }

        // Coletar IDs únicos de territórios e cidades para lookup
        const territoryIds = Array.from(new Set((addresses || []).map(a => a.territory_id).filter(Boolean)));
        const cityIds = Array.from(new Set((addresses || []).map(a => a.city_id).filter(Boolean)));

        // Mapas de lookup: id → dados
        const territoryMap: Record<string, { name: string; notes: string }> = {};
        const cityMap: Record<string, { name: string; uf: string }> = {};

        if (territoryIds.length > 0) {
            const { data: territories } = await supabaseAdmin
                .from('territories')
                .select('id, name, notes')
                .in('id', territoryIds);
            (territories || []).forEach(t => {
                territoryMap[t.id] = { name: t.name || '', notes: t.notes || '' };
            });
        }

        if (cityIds.length > 0) {
            const { data: cities } = await supabaseAdmin
                .from('cities')
                .select('id, name, uf')
                .in('id', cityIds);
            (cities || []).forEach(c => {
                cityMap[c.id] = { name: c.name || '', uf: c.uf || '' };
            });
        }

        // Cabeçalho do CSV conforme formato padrão de importação
        const headers = [
            'Nome da cidade (Cities name)',
            'UF (Cities uf)',
            'Número do Mapa (Territories name)',
            'Descrição (Territories notes)',
            'Endereço (street)',
            'Número de residentes (residents_count)',
            'Nome (resident_name)',
            'Link do Maps (google_maps_link)',
            'Link do Waze (waze_link)',
            'Status (is_active)',
            'Surdo (is_deaf)',
            'Menor de idade (is_minor)',
            'Estudante (is_student)',
            'Neurodivergente (is_neurodivergent)',
            'Gênero (gender)',
            'Observação (observations)',
            'visit_status',
            'sort_order'
        ];

        const rows = (addresses || []).map(addr => {
            // Buscar cidade e território nos mapas de lookup
            const city = cityMap[addr.city_id] || { name: '', uf: '' };
            const territory = territoryMap[addr.territory_id] || { name: '', notes: '' };

            return [
                city.name,
                city.uf || '',
                territory.name || '',       // número/nome do território
                territory.notes || '',      // descrição do território
                addr.street,
                addr.residents_count ?? 1,
                addr.resident_name || '',
                addr.google_maps_link || '',
                addr.waze_link || '',
                addr.is_active !== false ? 'true' : 'false',
                addr.is_deaf ? 'true' : 'false',
                addr.is_minor ? 'true' : 'false',
                addr.is_student ? 'true' : 'false',
                addr.is_neurodivergent ? 'true' : 'false',
                addr.gender || '',
                addr.observations || '',
                addr.visit_status || 'not_contacted',
                addr.sort_order ?? 0
            ];
        });

        // Escapar campos que contêm ponto e vírgula ou quebras de linha
        const escapeCell = (cell: any): string => {
            const text = String(cell ?? '');
            if (text.includes(';') || text.includes('"') || text.includes('\n')) {
                return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
        };

        // Montar CSV com separador ponto e vírgula
        const csvContent = [
            headers.join(';'),
            ...rows.map(row => row.map(escapeCell).join(';'))
        ].join('\n');

        // UTF-8 BOM para compatibilidade com Excel
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
