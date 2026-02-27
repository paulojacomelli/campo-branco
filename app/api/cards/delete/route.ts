// app/api/cards/delete/route.ts
// Exclui múltiplos cartões (listas compartilhadas) no Firestore
// Requer autenticação e permissão de administrador ou ancião

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken, isAdminRole } from '@/lib/firestore';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token) as any;

        if (!user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const { ids } = await req.json();

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Nenhum cartão selecionado para exclusão.' }, { status: 400 });
        }

        // 1. Verificar permissões do usuário
        if (!isAdminRole(user.role)) {
            return NextResponse.json({ error: 'Você não tem permissão para realizar exclusões em massa.' }, { status: 403 });
        }

        console.log(`DEBUG - Iniciando exclusão via Admin de ${ids.length} cartões por usuário ${user.id}`);

        // 2. Executar delete em batch no Firestore
        const chunks = [];
        for (let i = 0; i < ids.length; i += 400) {
            chunks.push(ids.slice(i, i + 400));
        }

        for (const chunk of chunks) {
            const batch = adminDb.batch();
            chunk.forEach(id => {
                const docRef = adminDb.collection('shared_lists').doc(id);
                batch.delete(docRef);
            });
            await batch.commit();
        }

        console.log(`DEBUG - Sucesso! ${ids.length} cartões excluídos.`);

        return NextResponse.json({
            success: true,
            message: `${ids.length} cartões excluídos com sucesso.`
        });
    } catch (error: any) {
        console.error('Card Delete API Critical Error:', error);
        return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
    }
}
