const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function migrateAddresses() {
    try {
        console.log('🔍 Buscando endereços sem congregationId...');

        const addressesRef = db.collection('addresses');
        const snapshot = await addressesRef.get();

        let fixed = 0;
        let alreadyOk = 0;
        let failed = 0;

        const batch = db.batch();
        let batchCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();

            if (!data.congregationId) {
                // Buscar o território pai para pegar o congregationId
                if (data.territoryId) {
                    const territoryDoc = await db.collection('territories').doc(data.territoryId).get();

                    if (territoryDoc.exists && territoryDoc.data().congregationId) {
                        batch.update(doc.ref, {
                            congregationId: territoryDoc.data().congregationId
                        });
                        fixed++;
                        batchCount++;
                        console.log(`✅ Corrigindo ${doc.id} -> ${territoryDoc.data().congregationId}`);

                        // Commit batch a cada 500 operações
                        if (batchCount >= 500) {
                            await batch.commit();
                            batchCount = 0;
                        }
                    } else {
                        console.log(`⚠️  ${doc.id}: Território ${data.territoryId} não encontrado ou sem congregationId`);
                        failed++;
                    }
                } else {
                    console.log(`⚠️  ${doc.id}: Sem territoryId para buscar congregationId`);
                    failed++;
                }
            } else {
                alreadyOk++;
            }
        }

        // Commit final
        if (batchCount > 0) {
            await batch.commit();
        }

        console.log('\n📊 Resumo da Migração:');
        console.log(`✅ Corrigidos: ${fixed}`);
        console.log(`✔️  Já corretos: ${alreadyOk}`);
        console.log(`❌ Falhas: ${failed}`);
        console.log(`📝 Total: ${snapshot.size}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    }
}

migrateAddresses();
