const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'campo-branco',
    clientEmail: '',
    privateKey: $privateKey,
  })
});

const db = admin.firestore();

async function checkLock() {
  const email = 'campobrancojw@gmail.com';
  try {
    const user = await admin.auth().getUserByEmail(email);
    console.log('User found:', user.uid);
    await db.collection('config').doc('security').set({
      superAdminUid: user.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log('Lock updated with UID:', user.uid);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
checkLock();
