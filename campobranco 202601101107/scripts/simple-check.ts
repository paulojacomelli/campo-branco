
import { getAdminDb } from '../lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Load env from root manually
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            const val = values.join('=').trim().replace(/^["']|["']$/g, '');
            process.env[key.trim()] = val;
        }
    });
}

async function listUsers() {
    const db = getAdminDb();
    if (!db) { console.log("No DB"); return; }

    const snapshot = await db.collection('users').get();
    console.log(`\n--- FOUND ${snapshot.size} USERS ---`);

    snapshot.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id}`);
        console.log(`Name: '${d.name}'`);
        console.log(`Email: '${d.email}'`);
        console.log(`Role: ${d.role}`);
        console.log(`Provider: ${d.provider}`);
        console.log('---');
    });
}

listUsers();
