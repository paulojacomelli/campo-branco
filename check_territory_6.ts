import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTerritory6() {
    try {
        console.log("--- Verificando Território 06 ---");

        // 1. Encontrar o território pelo nome "06"
        const { data: territories, error: tErr } = await supabase
            .from('territories')
            .select('*')
            .eq('name', '06');

        if (tErr) throw tErr;

        if (!territories || territories.length === 0) {
            console.log("Nenhum território encontrado com o nome '06'.");
            return;
        }

        for (const t of territories) {
            console.log(`\nTerritório: ${t.name} (ID: ${t.id})`);
            console.log(`Status na Tabela: ${t.status}`);
            console.log(`Congregação: ${t.congregation_id}`);

            // 2. Buscar listas compartilhadas ativas que contenham este ID
            const { data: lists, error: lErr } = await supabase
                .from('shared_lists')
                .select('*')
                .eq('congregation_id', t.congregation_id)
                .contains('items', [t.id]);

            if (lErr) {
                console.error(`Erro ao buscar listas para ${t.id}:`, lErr);
                continue;
            }

            if (!lists || lists.length === 0) {
                console.log("Nenhuma lista compartilhada encontrada para este território.");
            } else {
                console.log(`${lists.length} listas encontradas:`);
                lists.forEach(l => {
                    console.log(`- ID: ${l.id} | Status: ${l.status} | Expira em: ${l.expires_at} | Designado: ${l.assigned_name}`);
                });
            }
        }

    } catch (error) {
        console.error("Erro durante verificação:", error);
    }
}

checkTerritory6();
