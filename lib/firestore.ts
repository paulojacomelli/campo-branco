// lib/firestore.ts
// Helpers centralizados para acesso ao Firestore
// Facilita leitura, criação e atualização de documentos de forma padronizada

import { adminDb, adminAuth } from './firebase-admin';
import {
    FieldValue,
    Timestamp,
    DocumentData,
    QueryDocumentSnapshot
} from 'firebase-admin/firestore';

// Exporta utilitários do Firestore para uso nas API routes
export { adminDb, adminAuth, FieldValue, Timestamp };

// Converte um documento do Firestore para um objeto simples com id
export function docToObject(doc: QueryDocumentSnapshot<DocumentData>) {
    return { id: doc.id, ...doc.data() };
}

// Verifica e retorna o perfil de usuário a partir de um token de sessão
export async function getUserFromToken(token: string | undefined) {
    if (!token) return null;

    try {
        const decoded = await adminAuth.verifyIdToken(token);
        const userDoc = await adminDb.collection('users').doc(decoded.uid).get();

        if (!userDoc.exists) return null;

        return {
            uid: decoded.uid,
            email: decoded.email,
            ...userDoc.data()
        };
    } catch (e) {
        return null;
    }
}

// Verifica permissão de acesso a uma congregação específica
export function canAccessCongregation(user: any, congregationId: string): boolean {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.congregationId === congregationId;
}

// Verifica se o usuário tem papel de administrador (Ancião ou acima)
export function isAdminRole(role: string): boolean {
    return ['ANCIAO', 'SERVO', 'ADMIN'].includes(role);
}
