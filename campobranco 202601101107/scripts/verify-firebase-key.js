const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Robust .env parser
function loadEnv() {
    try {
        const envFiles = ['.env.local', '.env'];
        for (const file of envFiles) {
            const envPath = path.join(process.cwd(), file);
            if (!fs.existsSync(envPath)) continue;

            console.log(`Loading ${file}...`);
            const content = fs.readFileSync(envPath, 'utf8');

            // Regex to match KEY="VALUE" (multiline) or KEY=VALUE
            // This regex handles:
            // 1. KEY=" ... " (quoted, can be multiline)
            // 2. KEY=' ... ' (single quoted, can be multiline)
            // 3. KEY=... (unquoted, stops at end of line)
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

const rawKey = process.env.FIREBASE_PRIVATE_KEY;

if (!rawKey) {
    console.error('ERROR: FIREBASE_PRIVATE_KEY is missing from environment.');
    process.exit(1);
}

// Replicate the logic from lib/firebase-admin.ts EXACTLY
let formatted = rawKey;

// Handle case where the key is wrapped in quotes
if (formatted.startsWith('"') && formatted.endsWith('"')) {
    formatted = formatted.slice(1, -1);
}

// Handle case where newlines are escaped as literal "\n" (common in some env setups)
// We replace ALL occurrences of literal "\n" with actual newline characters
// Also handle double-escaped newlines just in case
formatted = formatted.replace(/\\n/g, '\n').replace(/\\\\n/g, '\n');

console.log('--- Key Diagnosis ---');
console.log(`Raw Length: ${rawKey.length}`);
console.log(`Formatted Length: ${formatted.length}`);
console.log(`Starts with Header: ${formatted.trim().startsWith('-----BEGIN PRIVATE KEY-----')}`);
console.log(`Ends with Footer: ${formatted.trim().endsWith('-----END PRIVATE KEY-----')}`);

const lines = formatted.split('\n');
console.log(`Number of lines: ${lines.length}`);
if (lines.length > 0) console.log(`First line: ${lines[0]}`);
if (lines.length > 1) console.log(`Last line: ${lines[lines.length - 1]}`);

// Check for spaces in base64 body (bad)
// We skip header (first) and footer (last)
for (let i = 1; i < lines.length - 1; i++) {
    if (lines[i].includes(' ') && lines[i].trim() !== '') {
        console.log(`WARN: Line ${i + 1} contains spaces! This might be invalid.`);
    }
}

try {
    const keyObject = crypto.createPrivateKey(formatted);
    console.log('\nSUCCESS: Node.js crypto module accepted the private key!');
    // console.log(`Type: ${keyObject.type}`);
    // console.log(`AsymmetricKeyType: ${keyObject.asymmetricKeyType}`);
} catch (e) {
    console.error('\nFAILURE: Node.js crypto module REJECTED the private key.');
    console.error('Error:', e.message);
    if (e.code) console.error('Code:', e.code);

    // Attempt aggressive fix to see what works
    console.log('\n--- Attempting Aggressive Fix ---');
    try {
        const body = formatted
            .replace(/-----BEGIN PRIVATE KEY-----/g, '')
            .replace(/-----END PRIVATE KEY-----/g, '')
            .replace(/\s/g, ''); // Remove all whitespace

        // Chunk it
        const chunked = body.match(/.{1,64}/g).join('\n');
        const reconstructed = `-----BEGIN PRIVATE KEY-----\n${chunked}\n-----END PRIVATE KEY-----`;

        crypto.createPrivateKey(reconstructed);
        console.log('AGGRESSIVE FIX SUCCESS: Reformatting the key worked!');
        console.log('GUIDANCE: The key has extra whitespace or bad formatting that needs aggressive cleaning.');
    } catch (e2) {
        console.error('Aggressive fix also failed.');
        console.error(e2.message);
    }
}
