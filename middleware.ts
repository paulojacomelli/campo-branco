import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware para gerenciar a sessão do Supabase em todas as rotas
export async function middleware(req: NextRequest) {
    const res = NextResponse.next();

    // Cria o cliente Supabase para o contexto do middleware (SSR)
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                // Lê os cookies da requisição
                getAll() {
                    return req.cookies.getAll();
                },
                // Escreve os cookies na resposta
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        req.cookies.set(name, value);
                        res.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // Atualiza a sessão do usuário (necessário para manter a sessão ativa)
    await supabase.auth.getSession();

    return res;
}

export const config = {
    matcher: [
        /*
         * Aplica o middleware em todas as rotas exceto:
         * - _next/static (arquivos estáticos)
         * - _next/image (otimização de imagens)
         * - favicon.ico
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
