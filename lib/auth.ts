import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import { verifyFirebaseIdToken } from '@/lib/jose-auth';

export interface AuthorizedUser {
    uid: string;
    email?: string;
    role: string;
    roles: string[];
    congregationId?: string;
    [key: string]: any;
}

export async function checkAuth(): Promise<AuthorizedUser | null> {
    const session = (await cookies()).get('__session')?.value;

    if (!session) {
        return null;
    }

    try {
        // Verify Session Cookie using Admin SDK
        // (Since we are now using createSessionCookie in login, we must verify it as such)
        const { adminAuth } = await import('@/lib/firebase-admin');
        if (!adminAuth) {
            throw new Error("Admin Auth not initialized for verification");
        }

        const decodedClaims = await adminAuth.verifySessionCookie(session, true /** checkRevoked */);
        const uid = decodedClaims.uid;

        // Fetch full user profile from Firestore to get roles/congregation
        // We still use adminDb for Firestore, which should be initialized with 
        // Application Default Credentials in production if no env vars are provided.
        if (adminDb) {
            const userDoc = await adminDb.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                return {
                    uid,
                    email: decodedClaims.email as string,
                    role: userData?.role || 'PUBLICADOR',
                    roles: userData?.roles || [userData?.role || 'PUBLICADOR'],
                    congregationId: userData?.congregationId,
                    ...userData
                };
            }
        }

        return {
            uid,
            email: decodedClaims.email as string,
            role: 'PUBLICADOR',
            roles: ['PUBLICADOR'],
        };
    } catch (error) {
        console.error('[AUTH] Session verification failed:', error);
        return null;
    }
}

export async function requireAuth(allowedRoles?: string[]): Promise<AuthorizedUser> {
    const user = await checkAuth();

    if (!user) {
        throw new Error('Unauthorized');
    }

    if (allowedRoles && allowedRoles.length > 0) {
        const userRoles = Array.isArray(user.roles) ? user.roles : [user.role];
        const hasPermission = userRoles.some((role: string) => allowedRoles.includes(role)) || user.role === 'SUPER_ADMIN';

        if (!hasPermission) {
            throw new Error('Forbidden');
        }
    }

    return user;
}
