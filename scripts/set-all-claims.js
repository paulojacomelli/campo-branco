const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const USERS = [
    {
        email: 'growthboost.oficial@gmail.com',
        role: 'ANCIAO',
        congregationId: 'lscatanduva'
    },
    {
        email: 'paulo.serafim2001@gmail.com',
        role: 'SUPER_ADMIN',
        congregationId: 'lscatanduva' // Super Admin pode não precisar, mas bom garantir
    },
    {
        email: 'paulo.jacomelli2001@gmail.com',
        role: 'SERVO',
        congregationId: 'lscatanduva'
    }
];

async function setAllClaims() {
    console.log('Starting batch claim update...\n');

    for (const userData of USERS) {
        try {
            // Get user by email
            const user = await admin.auth().getUserByEmail(userData.email);

            console.log(`Setting claims for ${userData.email} (${userData.role})...`);

            const claims = {
                congregationId: userData.congregationId,
                role: userData.role,
                roles: [userData.role]
            };

            await admin.auth().setCustomUserClaims(user.uid, claims);

            console.log(`✅ Success! Claims: ${JSON.stringify(claims)}\n`);

        } catch (error) {
            console.error(`❌ Error for ${userData.email}:`, error.message);
            if (error.code === 'auth/user-not-found') {
                console.log('   (User might not be created in this environment yet)\n');
            }
        }
    }

    console.log('All done! Remember to logout/login with EACH user to refresh tokens.');
    process.exit(0);
}

setAllClaims();
