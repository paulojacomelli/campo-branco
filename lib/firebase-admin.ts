// lib/firebase-admin.ts
// Cliente Firebase Admin para uso exclusivo no servidor (API routes, Server Components)
// Usa Service Account para acesso privilegiado ao Firestore, sem restrições de segurança do cliente

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

// Inicializa o Admin SDK apenas uma vez
function initAdminApp(): App {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    // Aceita configuração via variável de ambiente JSON (para Firebase App Hosting / Vercel)
    // ou via variáveis individuais
    const adminConfig = process.env.FIREBASE_ADMIN_SDK_JSON;

    if (adminConfig) {
        const serviceAccount = JSON.parse(adminConfig);
        return initializeApp({
            credential: cert(serviceAccount),
        });
    }

    return initializeApp({
        credential: cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            // A chave privada vem com \n escapado nas envs, precisamos converter
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
        }),
    });
}

// Instâncias do Admin SDK
const adminApp: App = initAdminApp();
export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
