const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Robust .env parser
function loadEnv() {
    try {
        const envFiles = ['.env.local', '.env'];
        for (const file of envFiles) {
            const envPath = path.join(process.cwd(), file);
            if (!fs.existsSync(envPath)) continue;

            console.log(`Loading ${file}...`);
            const content = fs.readFileSync(envPath, 'utf8');

            const keyValRegex = /^\s*([\w\.\-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^#\r\n]*))/gm;

            let match;
            while ((match = keyValRegex.exec(content)) !== null) {
                const key = match[1];
                let value = match[2] || match[3] || match[4] || '';

                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        }
    } catch (e) {
        console.error('Failed to load env files', e);
    }
}

loadEnv();

// Copy the exact function from lib/firebase-admin.ts (the aggressive one)
const formatPrivateKey = (key) => {
    if (!key) return undefined;

    let raw = key.trim();
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        raw = raw.slice(1, -1);
    }

    let preprocessed = raw.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');

    const header = "-----BEGIN PRIVATE KEY-----";
    const footer = "-----END PRIVATE KEY-----";

    let body = preprocessed;

    // Explicit global replace
    body = body.split(header).join('');
    body = body.split(footer).join('');

    body = body.replace(/\s/g, '');

    if (body.length === 0) {
        console.error('Body empty');
        return undefined;
    }

    const chunked = body.match(/.{1,64}/g).join('\n');
    const finalKey = `${header}\n${chunked}\n${footer}`;

    console.log(`[SCRIPT] Body Length: ${body.length}`);
    return finalKey;
};

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const rawKey = process.env.FIREBASE_PRIVATE_KEY;
const formattedKey = formatPrivateKey(rawKey);

console.log(`Project: ${projectId}`);
console.log(`Email: ${clientEmail}`);
console.log(`Formatted Key Length: ${formattedKey ? formattedKey.length : 'N/A'}`);

try {
    const app = admin.initializeApp({
        credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: formattedKey,
        }),
        projectId
    }, 'test-app'); // Name it to avoid conflict

    console.log('SUCCESS: admin.initializeApp worked!');
} catch (e) {
    console.error('FAILURE: admin.initializeApp threw error:');
    console.error(e);
}
