// app/api/addresses/save/route.ts
// Cria ou atualiza um endereço no Firestore
// Requer autenticação e permissão de pertencimento à congregação

import { NextResponse } from 'next/server';
import { adminDb, getUserFromToken, canAccessCongregation, FieldValue } from '@/lib/firestore';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;
        const user = await getUserFromToken(token);

        if (!user) {
            return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 });
        }

        const body = await req.json();
        const {
            street, territoryId, congregationId, cityId, lat, lng,
            isActive, googleMapsLink, wazeLink, residentName, gender,
            isDeaf, isMinor, isStudent, isNeurodivergent, observations, id,
            inactivatedAt,
            // Compatibilidade com campo snake_case do formulário legado
            territory_id, congregation_id, city_id, is_active, is_deaf, is_minor,
            is_student, is_neurodivergent, resident_name, google_maps_link, waze_link,
            inactivated_at
        } = body;

        // Aceita ambos os formatos (camelCase novo e snake_case legado)
        const finalCongregationId = congregationId || congregation_id;
        const finalTerritoryId = territoryId || territory_id;
        const finalCityId = cityId || city_id;

        if (!canAccessCongregation(user, finalCongregationId)) {
            return NextResponse.json({ error: 'Você não tem permissão nesta congregação.' }, { status: 403 });
        }

        // Monta o objeto de dados do endereço
        const addressData: Record<string, any> = {
            street,
            territoryId: finalTerritoryId,
            congregationId: finalCongregationId,
            cityId: finalCityId,
            lat: lat || null,
            lng: lng || null,
            isActive: isActive ?? is_active ?? true,
            googleMapsLink: googleMapsLink || google_maps_link || null,
            wazeLink: wazeLink || waze_link || null,
            residentName: residentName || resident_name || null,
            gender: gender || null,
            isDeaf: isDeaf ?? is_deaf ?? false,
            isMinor: isMinor ?? is_minor ?? false,
            isStudent: isStudent ?? is_student ?? false,
            isNeurodivergent: isNeurodivergent ?? is_neurodivergent ?? false,
            observations: observations || null,
            inactivatedAt: inactivatedAt || inactivated_at || null,
            updatedAt: FieldValue.serverTimestamp(),
        };

        if (id) {
            // Atualiza um endereço existente
            await adminDb.collection('addresses').doc(id).update(addressData);
        } else {
            // Cria um novo endereço
            addressData.createdAt = FieldValue.serverTimestamp();
            await adminDb.collection('addresses').add(addressData);
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("API Address Save Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
