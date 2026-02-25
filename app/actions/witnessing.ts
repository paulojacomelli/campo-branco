import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'

const TABLE = 'witnessing_points';

export async function getWitnessingPoints(cityId: string) {
    try {
        await requireAuth();
        const supabase = createServerActionClient({ cookies });

        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('city_id', cityId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, data }
    } catch (error: any) {
        console.error('Error fetching witnessing points:', error)
        return { success: false, error: error.message || 'Failed to fetch points' }
    }
}

export async function createWitnessingPoint(data: {
    name: string;
    address: string;
    cityId: string;
    latitude: number;
    longitude: number;
    schedule: string;
}) {
    try {
        const user = await requireAuth(['SERVO', 'ANCIAO']);
        const supabase = createServerActionClient({ cookies });

        // Security check
        if (user.role !== 'ADMIN') {
            const { data: city, error: cityError } = await supabase
                .from('cities')
                .select('congregation_id')
                .eq('id', data.cityId)
                .single();

            if (cityError || !city || city.congregation_id !== user.congregationId) {
                throw new Error('Forbidden');
            }
        }

        const { error } = await supabase
            .from(TABLE)
            .insert({
                name: data.name,
                address: data.address,
                city_id: data.cityId,
                lat: data.latitude,
                lng: data.longitude,
                schedule: data.schedule,
                status: 'AVAILABLE',
                congregation_id: user.congregationId,
            });

        if (error) throw error;

        revalidatePath(`/witnessing`)
        return { success: true }
    } catch (error: any) {
        console.error('Error creating witnessing point:', error)
        return { success: false, error: error.message || 'Failed to create point' }
    }
}

export async function getWitnessingPointById(id: string) {
    try {
        await requireAuth();
        const supabase = createServerActionClient({ cookies });

        const { data, error } = await supabase
            .from(TABLE)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        return { success: true, data }
    } catch (error: any) {
        console.error('Error fetching point:', error)
        return { success: false, error: error.message || 'Failed to fetch point' }
    }
}

export async function updateWitnessingPointDetails(id: string, data: {
    name: string;
    address: string;
    longitude: number;
    latitude: number;
    schedule: string;
}) {
    try {
        const user = await requireAuth(['SERVO', 'ANCIAO']);
        const supabase = createServerActionClient({ cookies });

        const { data: point, error: fetchError } = await supabase
            .from(TABLE)
            .select('congregation_id')
            .eq('id', id)
            .single();

        if (fetchError || !point) throw new Error('Not found');

        // Security check
        if (user.role !== 'ADMIN' && point.congregation_id !== user.congregationId) {
            throw new Error('Forbidden');
        }

        const { error } = await supabase
            .from(TABLE)
            .update({
                name: data.name,
                address: data.address,
                lng: data.longitude,
                lat: data.latitude,
                schedule: data.schedule,
            })
            .eq('id', id);

        if (error) throw error;

        revalidatePath(`/witnessing`)
        return { success: true }
    } catch (error: any) {
        console.error('Error updating point details:', error)
        return { success: false, error: error.message || 'Failed to update point' }
    }
}

export async function updateWitnessingPointStatus(id: string, status: string, publishersAsString: string | null) {
    try {
        const user = await requireAuth();
        const supabase = createServerActionClient({ cookies });

        const { data: point, error: fetchError } = await supabase
            .from(TABLE)
            .select('congregation_id')
            .eq('id', id)
            .single();

        if (fetchError || !point) throw new Error('Not found');

        // Ensure point belongs to user's congregation
        if (user.role !== 'ADMIN' && point.congregation_id !== user.congregationId) {
            throw new Error('Forbidden');
        }

        const { error } = await supabase
            .from(TABLE)
            .update({
                status,
                current_publishers: publishersAsString ? [publishersAsString] : [], // Adjust based on schema (text[])
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) throw error;

        revalidatePath(`/witnessing`)
        return { success: true }
    } catch (error: any) {
        console.error('Error updating witnessing point:', error)
        return { success: false, error: error.message || 'Failed to update point' }
    }
}

export async function deleteWitnessingPoint(id: string) {
    try {
        const user = await requireAuth(['SERVO', 'ANCIAO']);
        const supabase = createServerActionClient({ cookies });

        const { data: point, error: fetchError } = await supabase
            .from(TABLE)
            .select('congregation_id')
            .eq('id', id)
            .single();

        if (fetchError || !point) throw new Error('Not found');

        if (user.role !== 'ADMIN' && point.congregation_id !== user.congregationId) {
            throw new Error('Forbidden');
        }

        const { error } = await supabase
            .from(TABLE)
            .delete()
            .eq('id', id);

        if (error) throw error;

        revalidatePath(`/witnessing`)
        return { success: true }
    } catch (error: any) {
        console.error('Error deleting witnessing point:', error)
        return { success: false, error: error.message || 'Failed to delete point' }
    }
}
