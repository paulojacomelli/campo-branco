const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: 'campo-branco',
    clientEmail: '',
    privateKey: $privateKey,
  })
});

const db = admin.firestore();

async function setSuperAdmin() {
  const email = 'campobrancojw@gmail.com';
  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    await db.collection('users').doc(userRecord.uid).set({
      name: 'Super Admin',
      email: email,
      role: 'ADMIN',
      congregationId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log('SUCCESS: Usuario promovido a ADMIN (' + email + ')');
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.log('NOTICE: O usuario ' + email + ' ainda nao foi criado pelo login. Faca login primeiro.');
    } else {
      console.error('ERROR: ', e);
    }
  }
}
setSuperAdmin();
