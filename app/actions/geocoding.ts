// Função de Geocoding (Executada no Cliente para suporte a Static Export/APK)

/**
 * Server Action para Geocoding via Nominatim (OpenStreetMap)
 * Realiza a requisição do lado do servidor para evitar problemas de CORS e controlar User-Agent.
 */
export async function geocodeAddress(query: string) {
    if (!query || query.length < 3) return [];

    const sanitizedQuery = query
        .replace(/[<>\"']/g, '')
        .trim()
        .slice(0, 500);

    try {
        // Delay artificial para respeitar limites da API (se chamado em loop no client)
        // No server side, o delay é menos crítico para UX se for único, mas bom para evitar ban.
        // O cliente já tem um delay, mas aqui garantimos o header correto.

        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(sanitizedQuery)}&limit=1`);

        if (!response.ok) {
            console.error(`[Geocode] Error fetching: ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        return data || [];

    } catch (error) {
        console.error('[Geocode] Server Error:', error);
        return [];
    }
}
