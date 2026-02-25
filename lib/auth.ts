// lib/auth.ts
// Funções de autenticação e autorização para uso nas API routes (servidor)
// Usa Firebase Admin SDK para verificar tokens JWT sem expô-los ao cliente

import { adminAuth, adminDb } from './firebase-admin';
import { cookies } from 'next/headers';

export interface AuthorizedUser {
    uid: string;
    email?: string;
    role: string;
    roles: string[];
    congregationId?: string;
    [key: string]: any;
}

// Verifica o token de autenticação presente nos cookies da requisição
export async function checkAuth(): Promise<AuthorizedUser | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get('__session')?.value;

        if (!token) return null;

        // Verifica e decodifica o token JWT via Firebase Admin
        const decodedToken = await adminAuth.verifyIdToken(token);
        const uid = decodedToken.uid;

        // Busca o perfil completo do usuário no Firestore
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const userData = userDoc.data();

        if (!userData) {
            return {
                uid,
                email: decodedToken.email,
                role: 'PUBLICADOR',
                roles: ['PUBLICADOR'],
            };
        }

        return {
            uid,
            email: decodedToken.email,
            role: userData.role || 'PUBLICADOR',
            roles: [userData.role || 'PUBLICADOR'],
            congregationId: userData.congregationId,
            ...userData
        };
    } catch (error) {
        console.error('[AUTH] Falha na verificação do token Firebase:', error);
        return null;
    }
}

// Exige autenticação e opcionalmente um conjunto de papéis permitidos
export async function requireAuth(allowedRoles?: string[]): Promise<AuthorizedUser> {
    const user = await checkAuth();

    if (!user) {
        throw new Error('Unauthorized');
    }

    if (allowedRoles && allowedRoles.length > 0) {
        const hasPermission = allowedRoles.includes(user.role) || user.role === 'ADMIN';
        if (!hasPermission) {
            throw new Error('Forbidden');
        }
    }

    return user;
}
