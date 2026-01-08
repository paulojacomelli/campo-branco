
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// --- Environment Loading ---
const loadEnv = () => {
    try {
        // Strategy 1: Try service-account.json (Most reliable for CLI)
        const serviceAccountPath = path.resolve(process.cwd(), 'service-account.json');
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            console.log('✅ Loaded credentials from service-account.json');

            // Map to the env vars expected by lib/firebase-admin
            process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = serviceAccount.project_id;
            process.env.FIREBASE_CLIENT_EMAIL = serviceAccount.client_email;
            process.env.FIREBASE_PRIVATE_KEY = serviceAccount.private_key;
            return;
        }

        // Strategy 2: Try .env.local (Fallback, fragile for multiline keys)
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const envConfig = fs.readFileSync(envPath, 'utf8');
            // Basic parsing that handles quotes but might fail on complex multiline
            envConfig.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^"(.*)"$/, '$1');
                    process.env[key] = value;
                }
            });
            console.log('⚠️ Loaded credentials from .env.local (Caution: Private Key formatting might need check)');
        }
    } catch (e) {
        console.error('❌ Error loading credentials:', e);
    }
};

loadEnv();

// --- Configuration ---
const COLLECTIONS = [
    'users',
    'congregations',
    'cities',
    'territories',
    'addresses',
    'witnessing_points',
    'reports',
    'shared_lists'
];

const BACKUP_DIR = path.join(process.cwd(), 'backups');

// --- Helper Functions ---

const ensureBackupDir = () => {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
};

const askQuestion = (query: string): Promise<string> => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};

// --- Export Logic ---

export async function exportData(mockAdminDb?: any) {
    console.log('🚀 Starting Database Export...');

    // Dynamic import to ensure env is loaded first
    // In tests, we might inject mockAdminDb
    let adminDb;
    if (mockAdminDb) {
        adminDb = mockAdminDb;
    } else {
        // @ts-ignore
        const adminModule = await import('../lib/firebase-admin');
        adminDb = adminModule.adminDb;
    }

    // Check if DB is initialized
    if (!adminDb) {
        console.error('❌ Firebase Admin not initialized. Check service-account.json or env vars.');
        process.exit(1);
    }

    const timestamp = new Date().toISOString();
    const backupData: any = {
        meta: {
            type: 'FULL_EXPORT_CLI',
            version: '1.0',
            exportedAt: timestamp,
            collections: COLLECTIONS
        },
        data: {}
    };

    for (const collectionName of COLLECTIONS) {
        console.log(`📦 Fetching collection: ${collectionName}...`);
        try {
            const snapshot = await adminDb.collection(collectionName).get();
            const docs: any[] = [];
            snapshot.forEach((doc: any) => {
                docs.push({
                    _id: doc.id,
                    ...doc.data()
                });
            });
            backupData.data[collectionName] = docs;
            console.log(`   ✅ ${docs.length} documents retrieved.`);
        } catch (error: any) {
            console.error(`   ❌ Error fetching ${collectionName}:`, error.message);
            // Don't exit, try next collection
        }
    }

    ensureBackupDir();
    // Format: backup-YYYY-MM-DD-HH-mm.json
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${dateStr}.json`;
    const filePath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2));
    console.log(`\n🎉 Export Complete! File saved to:`);
    console.log(`POWERSHELL/BASH: ${filePath}`);
    try {
        console.log(`(Size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(2)} MB)`);
    } catch { }
    if (!mockAdminDb) process.exit(0);
}

// --- Import Logic ---

export async function importData(targetFile: string, mockAdminDb?: any) {
    console.log('🚀 Starting Database Restore/Import...');

    if (!targetFile) {
        console.error('❌ Please provide a file path. Usage: npm run db:import -- backups/myfile.json');
        if (!mockAdminDb) process.exit(1);
        return;
    }

    const filePath = path.resolve(process.cwd(), targetFile);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        if (!mockAdminDb) process.exit(1);
        return;
    }

    console.log(`📂 Reading file: ${filePath}...`);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let backup: any;
    try {
        backup = JSON.parse(fileContent);
    } catch (e) {
        console.error('❌ Invalid JSON file.');
        process.exit(1);
    }

    // Validation
    if (!backup.meta || !backup.data) {
        console.error('❌ Invalid backup format (missing meta or data).');
        if (!mockAdminDb) process.exit(1);
        return;
    }

    console.log(`\n📋 Backup Metadata:`);
    console.log(`   Type: ${backup.meta.type}`);
    console.log(`   Date: ${backup.meta.exportedAt}`);

    // Warning
    console.warn(`\n⚠️  WARNING: This operation will MERGE data into the current database.`);
    console.warn(`   Existing documents with the same IDs will be OVERWRITTEN.`);
    console.warn(`   This process is irreversible via this tool.`);

    let confirmation = 'RESTORE';
    if (!mockAdminDb) {
        confirmation = await askQuestion('👉 Type "RESTORE" to confirm: ');
    }

    if (confirmation !== 'RESTORE') {
        console.log('❌ Operation cancelled.');
        if (!mockAdminDb) process.exit(0);
        return;
    }

    // Dynamic import
    let adminDb;
    if (mockAdminDb) {
        adminDb = mockAdminDb;
    } else {
        // @ts-ignore
        const adminModule = await import('../lib/firebase-admin');
        adminDb = adminModule.adminDb;
    }

    if (!adminDb) {
        console.error('❌ Firebase Admin not initialized.');
        process.exit(1);
    }

    console.log('\n🔄 Starting Restore...');

    for (const collectionName of Object.keys(backup.data)) {
        // Enforce whitelist check anyway
        if (!COLLECTIONS.includes(collectionName)) {
            console.log(`⚠️  Skipping unknown collection in backup: ${collectionName}`);
            continue;
        }

        const docs = backup.data[collectionName];
        if (!Array.isArray(docs)) continue;

        console.log(`📦 Restoring ${collectionName} (${docs.length} docs)...`);

        // Batch writes (limit 500)
        let batch = adminDb.batch();
        let count = 0;
        let total = 0;

        for (const docData of docs) {
            const docId = docData._id;
            if (!docId) continue;

            const content = { ...docData };
            delete content._id; // Remove ID from body

            const ref = adminDb.collection(collectionName).doc(docId);
            batch.set(ref, content, { merge: true });

            count++;
            total++;

            if (count >= 400) {
                await batch.commit();
                batch = adminDb.batch();
                count = 0;
                process.stdout.write('.');
            }
        }

        if (count > 0) {
            await batch.commit();
        }
        console.log(` ✅ Done.`);
    }

    console.log('\n🎉 Restore Complete!');
    if (!mockAdminDb) process.exit(0);
}

// (CLI Entry point moved to db-tools-cli.ts)
