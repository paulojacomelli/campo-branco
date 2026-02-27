import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware para tratamento de rotas
export async function middleware(req: NextRequest) {
    // No momento, o Firebase gerencia a autenticação via Client SDK e Session Cookies
    // Este middleware pode ser expandido para proteger rotas específicas no servidor
    return NextResponse.next();
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
