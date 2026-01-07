const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

async function setClaims() {
    try {
        // Get user by email
        const email = 'growthboost.oficial@gmail.com';
        const user = await admin.auth().getUserByEmail(email);

        console.log(`Setting custom claims for user ${user.uid} (${email})...`);

        await admin.auth().setCustomUserClaims(user.uid, {
            congregationId: 'lscatanduva',
            role: 'ANCIAO',
            roles: ['ANCIAO']
        });

        console.log('✅ Custom claims set successfully!');
        console.log('User must force-refresh their token (logout/login) for changes to take effect.');

        // Verify
        const updatedUser = await admin.auth().getUser(user.uid);
        console.log('Current Claims:', updatedUser.customClaims);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error setting claims:', error);
        process.exit(1);
    }
}

setClaims();
