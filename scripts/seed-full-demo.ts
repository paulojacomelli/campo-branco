
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!);
const CONG_ID = 'fe01ce2a-7fba-48fa-aaed-7c982a04e229';

const USERS = [
    { id: 'cd27ebfa-68fe-4c9f-a9cf-df033bc5944d', name: 'Superintendente' },
    { id: 'ab31b0d9-19ef-4173-a152-da9a6e8a4489', name: 'Paulo Henrique' },
    { id: '057a14a2-73a8-482a-a4e7-831681d91aec', name: 'Admin' },
    { id: 'd3ca558f-e8e0-42c6-b02b-3caf9b358267', name: 'Paulo (User)' }
];

const neighborhoods = [
    { name: 'Centro Histórico', region: 'Setor A' },
    { name: 'Jardim das Orquídeas', region: 'Setor B' },
    { name: 'Vila Aurora', region: 'Setor C' },
    { name: 'Parque das Águas', region: 'Setor D' }
];

const streets = [
    'Rua Independência', 'Avenida Marechal Deodoro', 'Rua Tiradentes', 'Rua Rui Barbosa',
    'Avenida Sete de Setembro', 'Rua Getúlio Vargas', 'Beco da Esperança', 'Alameda Santos'
];

const observations = [
    'Estuda a bíblia com frequência.',
    'Ausente em 3 tentativas.',
    'Pediu para visitar somente após as 18h.',
    'Interessado no folheto sobre sofrimento.',
    'Surdo - utiliza LIBRAS.',
    'Ocupado com crianças pequenas.',
    'Residência com cachorro bravo, bater palmas.'
];

async function seedFull() {
    console.log('🚀 Iniciando seeding TOTAL para Congregação Demo...');

    // 1. Criar Bairros
    const citiesData = neighborhoods.map(n => ({
        id: randomUUID(),
        name: n.name,
        region: n.region,
        uf: 'SP',
        congregation_id: CONG_ID,
        created_at: new Date().toISOString()
    }));
    const { data: bCity } = await supabase.from('cities').upsert(citiesData).select();
    if (!bCity) return;
    console.log(`✅ ${bCity.length} bairros criados.`);

    // 2. Criar Territórios (2 por bairro)
    const territoriesData: any[] = [];
    bCity.forEach((city, i) => {
        for (let t = 1; t <= 2; t++) {
            territoriesData.push({
                id: randomUUID(),
                name: `Território ${city.name} - ${t}`,
                number: (i + 1) * 10 + t,
                city_id: city.id,
                congregation_id: CONG_ID,
                status: t === 1 ? 'OCUPADO' : 'LIVRE',
                created_at: new Date().toISOString()
            });
        }
    });
    const { data: bTerr } = await supabase.from('territories').upsert(territoriesData).select();
    if (!bTerr) return;
    console.log(`✅ ${bTerr.length} territórios criados.`);

    // 3. Criar Endereços (10 por território)
    const addressesData: any[] = [];
    bTerr.forEach(terr => {
        for (let a = 1; a <= 10; a++) {
            addressesData.push({
                id: randomUUID(),
                territory_id: terr.id,
                congregation_id: CONG_ID,
                city_id: terr.city_id,
                street: streets[Math.floor(Math.random() * streets.length)],
                number: `${a * 10 + tRandom(9)}`,
                resident_name: tRandom(5) === 0 ? '' : `Residente ${a}`,
                gender: a % 2 === 0 ? 'MULHER' : 'HOMEM',
                is_deaf: tRandom(10) > 8,
                is_active: true,
                visit_status: 'not_contacted',
                created_at: new Date(Date.now() - tRandom(1000000000)).toISOString()
            });
        }
    });
    const { data: bAddr } = await supabase.from('addresses').insert(addressesData).select();
    if (!bAddr) return;
    console.log(`✅ ${bAddr.length} endereços criados.`);

    // 4. Criar Visitas (mínimo 2 por endereço)
    const visitsData: any[] = [];
    bAddr.forEach(addr => {
        const numVs = 2 + tRandom(3);
        for (let v = 0; v < numVs; v++) {
            visitsData.push({
                id: randomUUID(),
                address_id: addr.id,
                publisher_id: USERS[tRandom(USERS.length)].id,
                congregation_id: CONG_ID,
                status: v === 0 ? 'visitado' : 'ausente',
                observations: observations[tRandom(observations.length)],
                visit_date: new Date(Date.now() - (v * 86400000 * 5) - tRandom(86400000)).toISOString(),
                created_at: new Date().toISOString()
            });
        }
    });
    const { error: vErr } = await supabase.from('visits').insert(visitsData);
    if (vErr) throw vErr;
    console.log(`✅ ${visitsData.length} visitas históricas criadas.`);

    console.log('\n✨ Todos os bairros, territórios e endereços possuem agora informações completas e visitas registradas!');
}

function tRandom(max: number) { return Math.floor(Math.random() * max); }

seedFull().catch(console.error);
