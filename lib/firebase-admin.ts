import * as admin from 'firebase-admin';

// Helper to reliably format the private key
const formatPrivateKey = (key: string | undefined) => {
    if (!key) return undefined;

    // 1. Handle literal newlines first (common in .env files)
    // We do this first because the markers might be split by literal \n
    let clean = key.replace(/\\n/g, '\n');

    // 2. Locate the standard PEM markers
    const header = "-----BEGIN PRIVATE KEY-----";
    const footer = "-----END PRIVATE KEY-----";

    const start = clean.indexOf(header);
    const end = clean.indexOf(footer);

    // 3. If markers are found, extract exactly that segment
    if (start !== -1 && end !== -1) {
        clean = clean.substring(start, end + footer.length);
    } else {
        // Fallback: If markers aren't found (e.g. maybe it's RSA PRIVATE KEY or just weird), 
        // try basic cleanup.
        console.warn("[FIREBASE ADMIN] Standard Private Key markers not found. Attempting basic cleanup.");
        clean = clean.trim();
        if (clean.startsWith('"') && clean.endsWith('"')) {
            clean = clean.slice(1, -1);
        }
    }

    // 4. Verification & Auto-Recovery Case (Environment Truncation)
    if (!clean.includes(header)) {
        console.error(`[FIREBASE ADMIN] Private Key missing header! Check environment variable length.`);
    } else if (!clean.includes(footer)) {
        console.warn("[FIREBASE ADMIN] Footer missing (likely environment truncation). Attempting recovery.");
        // Append footer if it was cut off (common in some shells/loaders)
        clean = clean.trim() + "\n" + footer;
    }

    if (clean.includes(header) && clean.includes(footer)) {
        console.log(`[FIREBASE ADMIN] Private Key extracted successfully (Length: ${clean.length})`);
    } else {
        console.error(`[FIREBASE ADMIN] Invalid Private Key format after recovery attempt.`);
    }

    return clean;
};

const getCredentials = () => {
    return {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    };
};

function initializeFirebaseAdmin() {
    if (admin.apps.length > 0) return admin.apps[0];

    const { projectId, clientEmail, privateKey } = getCredentials();

    try {
        if (projectId && clientEmail && privateKey) {
            console.log(`[FIREBASE ADMIN] Initializing with explicit Service Account (Project: ${projectId})`);
            return admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
                projectId // Explicitly set projectId just in case
            });
        } else {
            console.log('[FIREBASE ADMIN] Initializing with Application Default Credentials');
            // This works in GCP/Firebase environments automatically
            return admin.initializeApp();
        }
    } catch (error: any) {
        if (error.code === 'app/duplicate-app') {
            return admin.apps[0];
        }
        console.error('[FIREBASE ADMIN] Initialization Error:', error.message);
        return null;
    }
}

// Use dynamic getters to ensure we always try to initialize if needed
export const getAdminAuth = () => {
    const app = initializeFirebaseAdmin();
    return app ? admin.auth(app) : null;
};

export const getAdminDb = () => {
    const app = initializeFirebaseAdmin();
    return app ? admin.firestore(app) : null;
};

// Also export as constants for convenience in existing code, but they now call the functions
export const adminAuth = getAdminAuth();
export const adminDb = getAdminDb();

