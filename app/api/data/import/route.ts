
import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// -------------------------------------------------------
// FORMATO DO CSV (separado por ponto e vírgula):
// Nome da cidade;UF;Número do Mapa;Descrição;Endereço;
// Número de residentes;Nome;Link do Maps;Link do Waze;
// Status;Surdo;Menor de idade;Estudante;Neurodivergente;
// Gênero;Observação;visit_status;sort_order
//
// Regras:
// - Se "Endereço" estiver vazio → apenas cria/atualiza Cidade e Território (sem endereço)
// - Upsert em cascata: Cidade → Território → Endereço
// - Match de Cidade por nome + uf
// - Match de Território por congregation_id + city_id + number
// - Match de Endereço por territory_id + street (case-insensitive)
// -------------------------------------------------------

// Parser de booleano: aceita "true", "TRUE", "1", "t", "sim", "yes"
function parseBool(val: string): boolean {
    return ['true', '1', 't', 'sim', 'yes'].includes((val || '').toLowerCase().trim());
}

// Normaliza nome do território: se for número de 1 a 9, adiciona zero à esquerda (ex: "1" -> "01")
function normalizeTerritoryName(name: string): string {
    const trimmed = (name || '').trim();
    if (/^\d+$/.test(trimmed) && trimmed.length === 1) {
        return trimmed.padStart(2, '0');
    }
    return trimmed;
}

// Parser de linha CSV com suporte a separador ponto e vírgula e aspas duplas
function parseCSVLine(line: string, separator = ';'): string[] {
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            row.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    row.push(current.trim());
    return row;
}

// Detecta o separador do CSV analisando a primeira linha
function detectSeparator(headerLine: string): string {
    const semicolonCount = (headerLine.match(/;/g) || []).length;
    const commaCount = (headerLine.match(/,/g) || []).length;
    return semicolonCount >= commaCount ? ';' : ',';
}

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const simulate = url.searchParams.get('simulate') === 'true';
        const strict = url.searchParams.get('strict') !== 'false';
        const congregationId = url.searchParams.get('congregationId');

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

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(buffer);
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length < 2) {
            return NextResponse.json({ error: 'CSV vazio ou sem dados' }, { status: 400 });
        }

        // Remove BOM e detecta separador automaticamente
        const rawHeader = lines[0].replace(/^\ufeff/, '');
        const sep = detectSeparator(rawHeader);
        const header = parseCSVLine(rawHeader, sep);

        // Mapeamento de colunas: índice de cada coluna pelo nome do cabeçalho
        // Suporta tanto o header técnico quanto o amigável
        const COL: Record<string, string[]> = {
            cityName: ['Cidade', 'Nome da cidade (Cities name)', 'Nome da cidade'],
            uf: ['UF (Cities uf)', 'UF'],
            mapNum: ['Número do Mapa (Territories name)', 'Número do Mapa'],
            mapDesc: ['Descrição (Territories notes)', 'Descrição'],
            street: ['Endereço (street)', 'Endereço'],
            residentsCount: ['Quantidade de residentes', 'Número de residentes (residents_count)', 'Número de residentes', 'Número de Residentes'],
            residentName: ['Nome (resident_name)', 'Nome'],
            googleMapsLink: ['Link do Maps (google_maps_link)', 'Link do Maps', 'Link do Google Maps'],
            wazeLink: ['Link do Waze (waze_link)', 'Link do Waze'],
            isActive: ['Status (is_active)', 'Status'],
            isDeaf: ['Surdo (is_deaf)', 'Surdo'],
            isMinor: ['Menor de idade (is_minor)', 'Menor de idade'],
            isStudent: ['Estudante (is_student)', 'Estudante'],
            isNeurodivergent: ['Neurodivergente  (is_neurodivergent)', 'Neurodivergente (is_neurodivergent)', 'Neurodivergente'],
            gender: ['Gênero (gender)', 'Gênero'],
            observations: ['Observações', 'Observação (observations)', 'Observação'],
            visitStatus: ['Resultado da ultima visita', 'visit_status'],
            sortOrder: ['Ordem na listagem', 'sort_order'],
        };

        // Indexa as colunas do header por nome
        const colIndex: Record<string, number> = {};
        for (const [key, candidates] of Object.entries(COL)) {
            const idx = candidates.findIndex(c => header.some(h => h.trim() === c));
            const matchedHeader = header.findIndex(h => candidates.includes(h.trim()));
            colIndex[key] = matchedHeader;
        }

        // Valida que colunas obrigatórias estão presentes
        if (colIndex.cityName < 0 || colIndex.mapNum < 0) {
            return NextResponse.json({
                error: `Cabeçalho inválido. Colunas obrigatórias: "Nome da cidade" e "Número do Mapa". Encontrado: ${header.join(' | ')}`
            }, { status: 422 });
        }

        const results = {
            created: { cities: 0, territories: 0, addresses: 0 },
            updated: { territories: 0, addresses: 0 },
            skipped: 0,
            errors: [] as { line: number; reason: string }[]
        };

        // Cache de cidades e territórios para evitar queries repetidas
        const cityCache: Record<string, string> = {};
        const territoryCache: Record<string, string> = {};

        const batch = lines.slice(1);

        for (let i = 0; i < batch.length; i++) {
            const lineNum = i + 2;
            const row = parseCSVLine(batch[i], sep);

            // Helper para pegar valor de uma coluna por chave
            const get = (key: string): string => {
                const idx = colIndex[key];
                if (idx < 0 || idx >= row.length) return '';
                return (row[idx] || '').trim();
            };

            const cityName = get('cityName');
            const uf = get('uf');
            const mapNumRaw = get('mapNum');
            const mapNum = normalizeTerritoryName(mapNumRaw);

            // Linhas sem cidade ou número do mapa são ignoradas
            if (!cityName || !mapNum) continue;

            try {
                // --------------------------------------------------
                // 1. UPSERT CIDADE
                // --------------------------------------------------
                const cityKey = `${uf.toUpperCase()}:${cityName.toLowerCase()}`;
                let cityId = cityCache[cityKey];

                if (!cityId) {
                    const { data: city } = await supabaseAdmin
                        .from('cities')
                        .select('id')
                        .ilike('name', cityName)
                        .eq('uf', uf.toUpperCase())
                        .eq('congregation_id', congregationId)
                        .single();

                    if (city?.id) {
                        cityId = city.id;
                    } else if (!simulate) {
                        const { data: newCity, error: cityErr } = await supabaseAdmin
                            .from('cities')
                            .insert({ name: cityName, uf: uf.toUpperCase(), congregation_id: congregationId })
                            .select('id').single();
                        if (cityErr) throw cityErr;
                        cityId = newCity.id;
                        results.created.cities++;
                    } else {
                        // Em simulação, usa UUID fictício
                        cityId = `sim-city-${cityKey}`;
                        results.created.cities++;
                    }
                    cityCache[cityKey] = cityId;
                }

                // --------------------------------------------------
                // 2. UPSERT TERRITÓRIO
                // --------------------------------------------------
                const territoryKey = `${congregationId}:${cityId}:${mapNum}`;
                let territoryId = territoryCache[territoryKey];
                const mapDesc = get('mapDesc');

                if (!territoryId) {
                    const { data: territory } = await supabaseAdmin
                        .from('territories')
                        .select('id, notes')
                        .eq('congregation_id', congregationId)
                        .eq('city_id', cityId)
                        .eq('name', mapNum)
                        .single();

                    if (territory?.id) {
                        territoryId = territory.id;
                        // Atualiza a descrição (notes) se mudou
                        if (mapDesc && territory.notes !== mapDesc && !simulate) {
                            await supabaseAdmin
                                .from('territories')
                                .update({ notes: mapDesc })
                                .eq('id', territoryId);
                            results.updated.territories++;
                        }
                    } else if (!simulate) {
                        const { data: newTerr, error: terrErr } = await supabaseAdmin
                            .from('territories')
                            .insert({
                                congregation_id: congregationId,
                                city_id: cityId,
                                name: mapNum,
                                notes: mapDesc || null,
                            })
                            .select('id').single();
                        if (terrErr) throw terrErr;
                        territoryId = newTerr.id;
                        results.created.territories++;
                    } else {
                        territoryId = `sim-terr-${territoryKey}`;
                        results.created.territories++;
                    }
                    territoryCache[territoryKey] = territoryId;
                }

                // --------------------------------------------------
                // 3. UPSERT ENDEREÇO (apenas se houver street)
                // --------------------------------------------------
                const street = get('street');
                if (!street) continue; // Linha sem endereço apenas cria cidade/território

                const addressData: Record<string, any> = {
                    congregation_id: congregationId,
                    city_id: cityId,
                    territory_id: territoryId,
                    street,
                    residents_count: parseInt(get('residentsCount')) || 1,
                    resident_name: get('residentName') || null,
                    google_maps_link: get('googleMapsLink') || null,
                    waze_link: get('wazeLink') || null,
                    is_active: get('isActive') !== '' ? parseBool(get('isActive')) : true,
                    is_deaf: parseBool(get('isDeaf')),
                    is_minor: parseBool(get('isMinor')),
                    is_student: parseBool(get('isStudent')),
                    is_neurodivergent: parseBool(get('isNeurodivergent')),
                    gender: get('gender') || null,
                    observations: get('observations') || null,
                    visit_status: get('visitStatus') || 'not_contacted',
                    sort_order: parseInt(get('sortOrder')) || 0,
                };

                if (simulate) {
                    results.created.addresses++;
                    continue;
                }

                // Tenta encontrar endereço existente (match por territory + street)
                const { data: existing } = await supabaseAdmin
                    .from('addresses')
                    .select('id, resident_name, google_maps_link')
                    .eq('territory_id', territoryId)
                    .ilike('street', street)
                    .single();

                if (existing?.id) {
                    // Verifica se houve alteração relevante
                    const hasChanged =
                        existing.resident_name !== addressData.resident_name ||
                        existing.google_maps_link !== addressData.google_maps_link;

                    if (hasChanged) {
                        const { error: updErr } = await supabaseAdmin
                            .from('addresses').update(addressData).eq('id', existing.id);
                        if (updErr) throw updErr;
                        results.updated.addresses++;
                    } else {
                        results.skipped++;
                    }
                } else {
                    const { error: insErr } = await supabaseAdmin
                        .from('addresses').insert(addressData);
                    if (insErr) throw insErr;
                    results.created.addresses++;
                }

            } catch (err: any) {
                results.errors.push({ line: lineNum, reason: err.message });
                if (strict) {
                    return NextResponse.json({ error: `Erro na linha ${lineNum}: ${err.message}` }, { status: 500 });
                }
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error("Import API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
