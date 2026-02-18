
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

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Faltam variáveis de ambiente.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CONG_ID = 'fe01ce2a-7fba-48fa-aaed-7c982a04e229'; // ID Real do Banco (aaed)

// Usuários Reais encontrados no banco para esta congregação
const USERS = [
    { id: 'cd27ebfa-68fe-4c9f-a9cf-df033bc5944d', name: 'Superintendente de Serviço' },
    { id: 'ab31b0d9-19ef-4173-a152-da9a6e8a4489', name: 'Paulo Henrique' },
    { id: '057a14a2-73a8-482a-a4e7-831681d91aec', name: 'SuperAdmin' }
];

const neighborhoods = [
    { name: 'Jardim das Oliveiras', region: 'Setor 1' },
    { name: 'Vila Imperial', region: 'Setor 2' },
    { name: 'Parque das Nações', region: 'Setor 3' }
];

const streets = [
    'Rua das Azaleias', 'Rua dos Inconfidentes', 'Avenida da Saudade', 'Rua Sergipe',
    'Rua Minas Gerais', 'Alameda dos Anjos', 'Rua Boa Esperança', 'Avenida da Paz'
];

async function seed() {
    console.log('🌱 Iniciando seeding da Congregação Demo (Data Fix)...');

    // 1. Criar Cidades/Bairros
    const citiesData = neighborhoods.map(n => ({
        id: randomUUID(),
        name: n.name,
        region: n.region,
        uf: 'SP',
        congregation_id: CONG_ID,
        created_at: new Date().toISOString()
    }));

    const { data: createdCities, error: citiesErr } = await supabase.from('cities').upsert(citiesData).select();
    if (citiesErr) throw citiesErr;
    console.log(`✅ ${createdCities.length} bairros criados.`);

    // 2. Criar Territórios
    const territoriesData = createdCities.map((city, index) => ({
        id: randomUUID(),
        name: `Território ${String(index + 10).padStart(2, '0')}`, // Começar do 10 para diferenciar
        number: index + 10,
        city_id: city.id,
        congregation_id: CONG_ID,
        status: 'LIVRE',
        created_at: new Date().toISOString()
    }));

    const { data: createdTerritories, error: terrErr } = await supabase.from('territories').upsert(territoriesData).select();
    if (terrErr) throw terrErr;
    console.log(`✅ ${createdTerritories.length} territórios criados.`);

    // 3. Criar Endereços
    const addressesData: any[] = [];
    for (const terr of createdTerritories) {
        for (let i = 1; i <= 15; i++) {
            addressesData.push({
                id: randomUUID(),
                territory_id: terr.id,
                congregation_id: CONG_ID,
                city_id: terr.city_id,
                street: streets[Math.floor(Math.random() * streets.length)],
                number: String(i * 12 + Math.floor(Math.random() * 5)),
                resident_name: i % 4 === 0 ? '' : `Morador ${i}`,
                gender: i % 2 === 0 ? 'MULHER' : 'HOMEM',
                is_deaf: Math.random() > 0.8,
                is_active: true,
                visit_status: 'not_contacted',
                created_at: new Date(Date.now() - Math.random() * 1000000000).toISOString()
            });
        }
    }

    const { data: createdAddresses, error: addrErr } = await supabase.from('addresses').insert(addressesData).select();
    if (addrErr) throw addrErr;
    console.log(`✅ ${createdAddresses.length} endereços criados.`);

    // 4. Criar Visitas
    const visitsData: any[] = [];
    const observations = [
        'Morador muito atencioso, aceitou o folheto.',
        'Ninguém em casa na primeira visita.',
        'Pediu para retornar no final de semana.',
        'Ocupado com trabalho doméstico.',
        'Interessado no tema sobre família.',
        'Surdo, anotamos para revisita com intérprete.',
        'Confirmou presença na próxima reunião pública.'
    ];

    for (const addr of createdAddresses) {
        const numVisits = Math.floor(Math.random() * 3) + 1; // 1 a 3 visitas
        for (let v = 0; v < numVisits; v++) {
            visitsData.push({
                id: randomUUID(),
                address_id: addr.id,
                publisher_id: USERS[Math.floor(Math.random() * USERS.length)].id,
                congregation_id: CONG_ID,
                status: v === 0 ? 'visitado' : 'ausente',
                observations: observations[Math.floor(Math.random() * observations.length)],
                visit_date: new Date(Date.now() - (v * 86400000 * 7)).toISOString(), // Semanalmente para trás
                created_at: new Date().toISOString()
            });
        }
    }

    const { error: visitErr } = await supabase.from('visits').insert(visitsData);
    if (visitErr) throw visitErr;
    console.log(`✅ ${visitsData.length} visitas registradas.`);

    console.log('\n✨ População da Congregação Demo concluída com sucesso!');
}

seed().catch(err => {
    console.error('❌ Erro no seeding:', JSON.stringify(err, null, 2));
});
