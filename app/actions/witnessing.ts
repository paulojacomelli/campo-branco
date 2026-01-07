'use server'

import { adminDb } from '@/lib/firebase-admin'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'

const COLLECTION = 'witnessing_points';

export async function getWitnessingPoints(cityId: string) {
    try {
        await requireAuth();
        if (!adminDb) throw new Error('Database not initialized');

        const snapshot = await adminDb.collection(COLLECTION)
            .where('cityId', '==', cityId)
            .orderBy('createdAt', 'desc')
            .get();

        const points = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate()?.toISOString(),
            updatedAt: doc.data().updatedAt?.toDate()?.toISOString(),
        }));

        return { success: true, data: points }
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
        if (!adminDb) throw new Error('Database not initialized');

        // Ensure city belongs to user's congregation (or super admin)
        if (user.role !== 'SUPER_ADMIN') {
            const cityDoc = await adminDb.collection('cities').doc(data.cityId).get();
            const cityData = cityDoc.data();
            if (!cityDoc.exists || cityData?.congregationId !== user.congregationId) {
                throw new Error('Forbidden');
            }
        }

        await adminDb.collection(COLLECTION).add({
            ...data,
            status: 'AVAILABLE',
            congregationId: user.congregationId, // Store for security rules
            createdAt: new Date(),
            updatedAt: new Date(),
        });

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
        if (!adminDb) throw new Error('Database not initialized');

        const doc = await adminDb.collection(COLLECTION).doc(id).get();
        if (!doc.exists) return { success: false, error: 'Point not found' };

        const point = {
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data()?.createdAt?.toDate()?.toISOString(),
            updatedAt: doc.data()?.updatedAt?.toDate()?.toISOString(),
        };

        return { success: true, data: point }
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
        if (!adminDb) throw new Error('Database not initialized');

        const docRef = adminDb.collection(COLLECTION).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) throw new Error('Not found');

        // Security check
        if (user.role !== 'SUPER_ADMIN' && doc.data()?.congregationId !== user.congregationId) {
            throw new Error('Forbidden');
        }

        await docRef.update({
            ...data,
            updatedAt: new Date()
        });

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
        if (!adminDb) throw new Error('Database not initialized');

        const docRef = adminDb.collection(COLLECTION).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) throw new Error('Not found');

        const pointData = doc.data();

        // Ensure point belongs to user's congregation
        if (user.role !== 'SUPER_ADMIN' && pointData?.congregationId !== user.congregationId) {
            throw new Error('Forbidden');
        }

        await docRef.update({
            status,
            currentPublishers: publishersAsString,
            updatedAt: new Date()
        });

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
        if (!adminDb) throw new Error('Database not initialized');

        const docRef = adminDb.collection(COLLECTION).doc(id);
        const doc = await docRef.get();
        if (!doc.exists) throw new Error('Not found');

        if (user.role !== 'SUPER_ADMIN' && doc.data()?.congregationId !== user.congregationId) {
            throw new Error('Forbidden');
        }

        await docRef.delete();
        revalidatePath(`/witnessing`)
        return { success: true }
    } catch (error: any) {
        console.error('Error deleting witnessing point:', error)
        return { success: false, error: error.message || 'Failed to delete point' }
    }
}
