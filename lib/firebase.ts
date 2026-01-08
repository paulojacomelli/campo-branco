// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";

import { getAuth } from "firebase/auth";

// Aqui o código busca os dados que você colou no seu arquivo .env
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};



// Isso evita que o Next.js tente conectar ao Firebase toda hora que você recarregar a página
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Aqui ativamos o banco de dados (Firestore) para o Campo Branco
// Configuração com persistência offline robusta para suportar PWA
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from "firebase/firestore";

let db: Firestore;

try {
    // Tenta obter a instância existente para evitar erro de re-inicialização
    db = getFirestore(app);
} catch (e) {
    // Se não existir, inicializa com as configurações personalizadas
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
        })
    });
}

export { db };

// Ativamos o serviço de Autenticação
export const auth = getAuth(app);

// Exportar messaging apenas no lado do cliente (navegador)
// O Next.js roda no servidor também, onde 'window' não existe.
export const messaging = async () => {
    if (typeof window !== "undefined") {
        try {
            const { getMessaging, isSupported } = await import("firebase/messaging");
            if (await isSupported()) {
                return getMessaging(app);
            }
        } catch (error) {
            console.warn("Firebase Messaging not supported:", error);
            return null;
        }
    }
    return null;
};