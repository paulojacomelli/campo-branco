import { supabaseAdmin } from '@/lib/supabase-admin';
import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export async function POST(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

        if (authError || !currentUser) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const body = await req.json();
        const { name, uf, congregation_id, parent_city, lat, lng } = body;

        if (!name || !congregation_id) {
            return NextResponse.json({ error: 'Nome e congregação são obrigatórios.' }, { status: 400 });
        }

        // Verificar permissões do administrador
        const { data: adminData } = await supabase
            .from('users')
            .select('role, congregation_id')
            .eq('id', currentUser.id)
            .single();

        if (!adminData || (adminData.role !== 'ADMIN' && adminData.role !== 'ANCIAO' && adminData.role !== 'SERVO')) {
            return NextResponse.json({ error: 'Você não tem permissão para esta ação.' }, { status: 403 });
        }

        // Se for Ancião/Servo, só pode criar para a própria congregação
        if (adminData.role !== 'ADMIN' && congregation_id !== adminData.congregation_id) {
            return NextResponse.json({ error: 'Você só pode gerenciar dados da sua congregação.' }, { status: 403 });
        }

        const { data, error: publicInsertError } = await supabaseAdmin
            .from('cities')
            .insert([{
                name,
                uf,
                congregation_id,
                parent_city: parent_city || null,
                lat: lat || null,
                lng: lng || null
            }]);

        if (publicInsertError) {
            console.error('City Create API Error:', publicInsertError);
            return NextResponse.json({ error: publicInsertError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('City Create API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
