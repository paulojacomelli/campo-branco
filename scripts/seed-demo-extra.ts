
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

const CONG_ID = 'fe01ce2a-7fba-48fa-aaed-7c982a04e229';

const USERS = [
    { id: 'cd27ebfa-68fe-4c9f-a9cf-df033bc5944d', name: 'Superintendente de Serviço' },
    { id: 'ab31b0d9-19ef-4173-a152-da9a6e8a4489', name: 'Paulo Henrique' },
    { id: '057a14a2-73a8-482a-a4e7-831681d91aec', name: 'SuperAdmin' }
];

async function seedExtras() {
    console.log('🚀 Populando Pontos de Testemunho e Listas Compartilhadas...');

    // 1. Obter cidades criadas para referenciar
    const { data: cities } = await supabase.from('cities').select('id, name').eq('congregation_id', CONG_ID);
    if (!cities || cities.length === 0) throw new Error('Cidades não encontradas.');

    // 2. Pontos de Testemunho (Cartão)
    const witnessingPoints = [
        {
            id: randomUUID(),
            name: 'Terminal Central de Ônibus',
            congregation_id: CONG_ID,
            city_id: cities[0].id,
            address: 'Praça da Matriz, S/N',
            schedule: 'Segunda a Sexta, 08:00 - 18:00',
            status: 'AVAILABLE',
            created_at: new Date().toISOString()
        },
        {
            id: randomUUID(),
            name: 'Calçadão da Vila Imperial',
            congregation_id: CONG_ID,
            city_id: cities[1].id,
            address: 'Rua Principal, 100',
            schedule: 'Sábados, 09:00 - 12:00',
            status: 'AVAILABLE',
            created_at: new Date().toISOString()
        }
    ];

    await supabase.from('witnessing_points').upsert(witnessingPoints);
    console.log('✅ Pontos de testemunho criados.');

    // 3. Listas Compartilhadas (Designações)
    const { data: territories } = await supabase.from('territories').select('id, name').eq('congregation_id', CONG_ID);
    if (!territories || territories.length === 0) throw new Error('Territórios não encontrados.');

    const sharedLists = [
        {
            id: randomUUID(),
            congregation_id: CONG_ID,
            created_by: USERS[0].id,
            name: `Designação: ${territories[0].name}`,
            title: territories[0].name,
            territory_id: territories[0].id,
            city_id: cities[0].id,
            assigned_to: USERS[1].id,
            assigned_name: USERS[1].name,
            status: 'active',
            type: 'territory',
            created_at: new Date().toISOString(),
            assigned_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000 * 30).toISOString(), // 30 dias
            items: [],
            context: {}
        },
        {
            id: randomUUID(),
            congregation_id: CONG_ID,
            created_by: USERS[0].id,
            name: `Concluído: ${territories[1].name}`,
            title: territories[1].name,
            territory_id: territories[1].id,
            city_id: cities[1].id,
            assigned_to: USERS[2].id,
            assigned_name: USERS[2].name,
            status: 'completed',
            type: 'territory',
            created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
            assigned_at: new Date(Date.now() - 86400000 * 60).toISOString(),
            returned_at: new Date(Date.now() - 86400000 * 5).toISOString(),
            items: [],
            context: {}
        }
    ];

    await supabase.from('shared_lists').upsert(sharedLists);
    console.log('✅ Designações compartilhadas criadas.');

    console.log('\n✨ Todos os módulos da Congregação Demo estão com dados ricos agora!');
}

seedExtras().catch(err => console.error('❌ Erro extras:', err));
