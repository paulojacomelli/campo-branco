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

    const rawKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    // Durante o build do Next.js, se as credenciais estiverem faltando, 
    // não falhamos o processo, pois as rotas de API não são executadas no build.
    if (!rawKey || !projectId || !clientEmail) {
        if (process.env.NODE_ENV === 'production') {
            console.warn("⚠️ Firebase Admin credentials missing during build. Using mock app to prevent crash.");
            return {
                name: '[mock]',
                options: {},
                automaticResourceManagement: false
            } as any;
        }
    }

    try {
        return initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                // Processamento ultra-robusto da chave privada
                privateKey: rawKey ? rawKey.replace(/\\n/g, '\n').replace(/^["']|["']$/g, '').trim() : undefined,
            }),
        });
    } catch (error: any) {
        if (process.env.NODE_ENV === 'production') {
            console.warn("⚠️ Failed to initialize Firebase Admin during build:", error.message);
            return { name: '[mock]', options: {} } as any;
        }
        throw error;
    }
}

// Instâncias do Admin SDK
const adminApp: App = initAdminApp();
export const adminDb: Firestore = getFirestore(adminApp);
export const adminAuth: Auth = getAuth(adminApp);
