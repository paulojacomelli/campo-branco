// lib/api-client.ts
// Utilitário para chamadas de API que funciona tanto no Firebase quanto no GitHub Pages

export async function fetchApi(path: string, options?: RequestInit) {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '';
    // Garante que o path comece com / se necessário
    const fullPath = path.startsWith('http') ? path : `${baseUrl}${path}`;

    return fetch(fullPath, options);
}
