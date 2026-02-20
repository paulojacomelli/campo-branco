import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        // 1. Verificar se é Super Admin
        const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        const { oldId, newId } = await req.json();

        if (!oldId || !newId || oldId === newId) {
            return NextResponse.json({ error: 'IDs inválidos' }, { status: 400 });
        }

        console.log(`DEBUG - Iniciando migração de congregação: ${oldId} -> ${newId}`);

        // 2. Buscar a congregação original
        const { data: originalCong, error: fetchError } = await supabaseAdmin
            .from('congregations')
            .select('*')
            .eq('id', oldId)
            .single();

        if (fetchError || !originalCong) {
            return NextResponse.json({ error: 'Congregação original não encontrada.' }, { status: 404 });
        }

        // 3. Criar a nova congregação com o novo ID (Cópia) se ela não existir
        const { data: existingTarget } = await supabaseAdmin
            .from('congregations')
            .select('id')
            .eq('id', newId)
            .single();

        if (!existingTarget) {
            console.log(`DEBUG - Criando nova congregação ${newId}...`);
            const newCongData = { ...originalCong, id: newId };
            const { error: insertError } = await supabaseAdmin
                .from('congregations')
                .insert(newCongData);

            if (insertError) {
                console.error('Migration insert error:', insertError);
                return NextResponse.json({ error: 'Erro ao criar nova congregação: ' + insertError.message }, { status: 500 });
            }
        } else {
            console.log(`DEBUG - Congregação de destino ${newId} já existe. Procedendo apenas com a transferência de dados.`);
        }

        // 4. Atualizar todas as tabelas vinculadas
        const tables = [
            'cities',
            'users',
            'territories',
            'addresses',
            'witnessing_points',
            'shared_lists',
            'visits'
        ];

        for (const table of tables) {
            console.log(`DEBUG - Migrando tabela ${table}...`);
            const { error: updateError } = await supabaseAdmin
                .from(table)
                .update({ congregation_id: newId })
                .eq('congregation_id', oldId);

            if (updateError) {
                console.error(`Error migrating table ${table}:`, updateError);
                // NOTA: Em um cenário ideal, faríamos rollback. 
                // Mas no Supabase JS sem RPC, vamos continuar e logar.
            }
        }

        // 5. Remover a congregação antiga
        const { error: deleteError } = await supabaseAdmin
            .from('congregations')
            .delete()
            .eq('id', oldId);

        if (deleteError) {
            console.warn('Erro ao remover congregação antiga (podem haver vínculos residuais):', deleteError.message);
        }

        return NextResponse.json({ success: true, message: 'Migração concluída com sucesso!' });

    } catch (error: any) {
        console.error('Migration API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
