// lib/firebase-admin.ts
// Cliente Firebase Admin para uso exclusivo no servidor (API routes, Server Components)
// Usa Service Account ou ADC para acesso privilegiado ao Firestore

import { initializeApp, getApps, cert, App, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// Inicializa o Admin SDK de forma segura, tentando múltiplas fontes de credenciais
function initAdminApp(): App {

    // Reutiliza a instância existente (importante para hot-reload no dev)
    const existingApps = getApps();
    if (existingApps.length > 0) {
        const currentApp = existingApps[0];
        if (process.env.NODE_ENV === 'development') {
            const pid = (currentApp.options as any).projectId;
            console.log(`♻️ Firebase Admin: Reutilizando app para projeto: [${pid}]`);
        }
        return existingApps[0];
    }

    const projectId = (
        process.env.FIREBASE_ADMIN_PROJECT_ID ||
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        ''
    ).replace(/^[\"']|[\"']$/g, '').trim();

    // ============================================================
    // OPÇÃO 1: JSON completo do Service Account (via variável de env)
    // ============================================================
    const adminConfigJson = process.env.FIREBASE_ADMIN_SDK_JSON;
    if (adminConfigJson) {
        try {
            const serviceAccount = JSON.parse(adminConfigJson.replace(/^[\"']|[\"']$/g, '').trim());
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n').replace(/^[\"']|[\"']$/g, '').trim();
            }
            console.log('✅ Firebase Admin: Inicializado via FIREBASE_ADMIN_SDK_JSON');
            return initializeApp({
                credential: cert(serviceAccount),
                projectId: serviceAccount.project_id || projectId
            });
        } catch (e) {
            console.error('❌ Firebase Admin: Erro ao parsear FIREBASE_ADMIN_SDK_JSON:', e);
        }
    }

    // ============================================================
    // OPÇÃO 2: Arquivo service-account.json local (desenvolvimento)
    // ============================================================
    const saPath = path.join(process.cwd(), 'service-account.json');
    if (fs.existsSync(saPath)) {
        try {
            const serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n').replace(/^[\"']|[\"']$/g, '').trim();
            }
            console.log('✅ Firebase Admin: Inicializado via service-account.json local');
            return initializeApp({
                credential: cert(serviceAccount),
                projectId: serviceAccount.project_id || projectId
            });
        } catch (e) {
            console.error('❌ Firebase Admin: Erro ao ler service-account.json:', e);
        }
    }

    // ============================================================
    // OPÇÃO 3: Variáveis individuais de ambiente (FIREBASE_PRIVATE_KEY etc.)
    // ============================================================
    const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY || process.env.FB_ADMIN_PRIVATE_KEY;
    const clientEmail = (process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.FB_ADMIN_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL || '').replace(/^[\"']|[\"']$/g, '').trim();

    if (rawKey && projectId && clientEmail) {
        try {
            const privateKey = rawKey.replace(/\\n/g, '\n').replace(/^[\"']|[\"']$/g, '').trim();
            console.log('🚀 Firebase Admin: Inicializando com variáveis de ambiente. PID:', projectId);
            return initializeApp({
                credential: cert({ projectId, clientEmail, privateKey }),
                projectId
            });
        } catch (e: any) {
            console.error('❌ Firebase Admin: Erro ao inicializar com variáveis:', e.message);
        }
    }

    // ============================================================
    // OPÇÃO 4: ADC - Application Default Credentials
    // Funciona automaticamente no Firebase App Hosting e Google Cloud Run
    // O servidor de produção tem acesso às credenciais via service account do projeto
    // ============================================================
    try {
        console.log('🌐 Firebase Admin: Tentando ADC (Application Default Credentials). PID:', projectId || '(não definido)');
        return initializeApp({
            credential: applicationDefault(),
            projectId: projectId || undefined
        });
    } catch (e: any) {
        console.error('❌ Firebase Admin: ADC falhou:', e.message);
    }

    // ============================================================
    // FALLBACK: App mock para evitar crash durante build ou testes
    // ============================================================
    console.warn('⚠️ Firebase Admin: Todas as opções de credenciais falharam. Usando mock app.');
    return { name: '[mock]', options: {} } as any;
}

// Instâncias do Admin SDK - inicializadas de forma segura
const adminApp: App = initAdminApp();

// Evita chamar getFirestore/getAuth se o app for mock (comum no build do Next.js)
export const adminDb: Firestore = adminApp.name !== '[mock]'
    ? getFirestore(adminApp)
    : {
        collection: () => { throw new Error('Firestore indisponível: credenciais ausentes.'); }
    } as any;

export const adminAuth: Auth = adminApp.name !== '[mock]'
    ? getAuth(adminApp)
    : {
        verifyIdToken: () => { throw new Error('Auth indisponível: credenciais ausentes.'); }
    } as any;
