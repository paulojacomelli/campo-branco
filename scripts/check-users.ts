
import { getAdminDb } from '../lib/firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Load env from root manually to avoid dotenv dependency
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from ${envPath}`);
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const [key, ...values] = line.split('=');
        if (key && values.length > 0) {
            const val = values.join('=').trim().replace(/^["']|["']$/g, ''); // simple quote removal
            process.env[key.trim()] = val;
        }
    });
} else {
    console.warn("No .env.local found!");
}

async function listUsers() {
    console.log("Listing users...");
    // Initialize DB *after* env is loaded (by importing function, or dynamic import if module side effects matter,
    // but here getAdminDb calls initializeFirebaseAdmin which reads env at runtime)

    // Check if envs were loaded
    if (!process.env.FIREBASE_CLIENT_EMAIL) {
        console.error("Missing FIREBASE_CLIENT_EMAIL in env. Script might fail.");
    }

    const db = getAdminDb();
    if (!db) {
        console.error("Failed to initialize Admin DB. Check credentials.");
        return;
    }

    try {
        const snapshot = await db.collection('users').get();
        if (snapshot.empty) {
            console.log("No users found.");
            return;
        }

        const users: any[] = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });

        console.table(users.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role
        })));

        // Check for duplicates
        const emails = users.map((u: any) => u.email).filter(e => e);
        const duplicateEmails = emails.filter((e: any, i: number, a: any[]) => a.indexOf(e) !== i);

        if (duplicateEmails.length > 0) {
            console.log("\n⚠️ DUPLICATE EMAILS FOUND:");
            duplicateEmails.forEach((email: any) => {
                const dups = users.filter((u: any) => u.email === email);
                console.log(`Email: ${email}`);
                dups.forEach((d: any) => console.log(` - ID: ${d.id}, Name: ${d.name}, Role: ${d.role}`));
            });
        } else {
            console.log("\n✅ No duplicate emails found.");
        }

    } catch (error) {
        console.error("Error listing users:", error);
    }
}

listUsers();
