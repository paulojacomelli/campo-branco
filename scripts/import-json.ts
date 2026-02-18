
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

// Initialize Supabase Admin Client (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper to validate UUID
function isValidUUID(uuid: string) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
}

function sanitizeId(originalId: string, context: string) {
    if (isValidUUID(originalId)) return originalId;

    // Generate new ID
    const newId = randomUUID();
    console.warn(`⚠️  Invalid UUID "${originalId}" in ${context}. Generated new ID: ${newId}`);
    return newId;
}

async function importData() {
    const args = process.argv.slice(2);
    const filename = args[0];

    if (!filename) {
        console.error('❌ Please provide the JSON file path. Usage: npx tsx scripts/import-json.ts <path-to-json>');
        process.exit(1);
    }

    const filePath = path.resolve(process.cwd(), filename);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    console.log(`📂 Reading backup file: ${filename}...`);
    let backupData;
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        backupData = JSON.parse(raw);
        // Handle wrapped structure if presents (e.g. { data: { ... } })
        if (backupData.data && !backupData.users) {
            backupData = backupData.data;
        }
    } catch (e: any) {
        console.error(`❌ Failed to parse JSON: ${e.message}`);
        process.exit(1);
    }

    console.log(`✅ Loaded ${Object.keys(backupData).length} collections.`);

    // --- Import Order (Critical for Foreign Keys) ---
    // 1. Cities
    // 2. Congregations (depends on City)
    // 3. Users (depends on Congregation)
    // 4. Territories (depends on City & Congregation)
    // 5. Addresses (depends on Territory)

    await importTable('cities', backupData.cities, async (doc) => ({
        id: sanitizeId(doc._id, `city ${doc.name}`),
        name: doc.name,
        state: doc.state
    }));

    await importTable('congregations', backupData.congregations, async (doc) => ({
        id: sanitizeId(doc._id, `congregation ${doc.name}`),
        name: doc.name,
        number: doc.number,
        city_id: doc.cityId || null
    }));

    await importTable('users', backupData.users, async (doc) => ({
        id: sanitizeId(doc._id, `user ${doc.email}`),
        email: doc.email,
        name: doc.name,
        role: doc.role,
        congregation_id: doc.congregationId || null
    }));

    await importTable('territories', backupData.territories, async (doc) => ({
        id: sanitizeId(doc._id, `territory ${doc.name}`),
        name: doc.name,
        number: doc.number,
        city_id: doc.cityId || null,
        congregation_id: doc.congregationId || null,
        status: doc.status,
        type: doc.type,
        // map other fields if necessary
        image_url: doc.imageUrl || null
    }));

    await importTable('addresses', backupData.addresses, async (doc) => ({
        id: sanitizeId(doc._id, `address ${doc.street}`),
        street: doc.street,
        number: doc.number,
        neighborhood: doc.neighborhood,
        territory_id: doc.territoryId || null,
        coordinates: doc.coordinates || null,
        // Adicionar campos extras que podem ser obrigatórios
        city_id: doc.cityId || null,
        congregation_id: doc.congregationId || null,
        notes: doc.complement || null // Mapear complement para notes se existir
    }));

    // Optional: Witnessing Points
    if (backupData.witnessing_points) {
        // Check if table exists first or wrap in try/catch if uncertain
        await importTable('witnessing_points', backupData.witnessing_points, async (doc) => ({
            id: sanitizeId(doc._id, `point ${doc.name}`),
            name: doc.name,
            // ... map fields based on schema
        }));
    }

    console.log('\n🎉 Import Process Completed!');
}

async function importTable(tableName: string, docs: any[], mapper: (doc: any) => Promise<any>) {
    if (!docs || docs.length === 0) {
        console.log(`⚠️  Skipping ${tableName}: No data found.`);
        return;
    }

    console.log(`\n📦 Importing ${tableName} (${docs.length} records)...`);

    // Process in batches
    const BATCH_SIZE = 100;
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batchRaw = docs.slice(i, i + BATCH_SIZE);
        const batchMapped = [];

        for (const doc of batchRaw) {
            try {
                const mapped = await mapper(doc);
                // Clean undefined
                Object.keys(mapped).forEach(key => mapped[key] === undefined && delete mapped[key]);
                batchMapped.push(mapped);
            } catch (e) {
                console.warn(`Original doc failed mapping:`, doc);
            }
        }

        if (batchMapped.length > 0) {
            const { error } = await supabase.from(tableName).upsert(batchMapped, { onConflict: 'id' }); // Assumes 'id' is PK

            if (error) {
                console.error(`❌ Batch error on ${tableName} (rows ${i}-${i + batchMapped.length}):`, JSON.stringify(error, null, 2));
                // Tentar inserir um por um para isolar o erro
                for (const item of batchMapped) {
                    const { error: singleError } = await supabase.from(tableName).upsert(item, { onConflict: 'id' });
                    if (singleError) console.error(`   -> Failed item ${item.id}: ${singleError.message}`);
                }
                failed += batchMapped.length;
            } else {
                successful += batchMapped.length;
                process.stdout.write('.');
            }
        }
    }
    console.log(`\n   ✅ ${tableName}: ${successful} imported, ${failed} failed.`);
}

importData().catch(e => console.error(e));
