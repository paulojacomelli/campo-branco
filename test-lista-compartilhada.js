const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
} catch (e) { }

const db = admin.firestore();

async function run() {
    const doc = await db.collection('shared_lists').doc('TbZwKUkZnYOXLOCZL3gT').get();
    console.log(JSON.stringify(doc.data(), null, 2));
}

run();
