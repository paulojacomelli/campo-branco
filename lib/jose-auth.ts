import { jwtVerify, createRemoteJWKSet } from 'jose';

const FIREBASE_JWKS_URL = 'https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com';
const JWKS = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

export async function verifyFirebaseIdToken(token: string) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (!projectId) {
        throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not defined');
    }

    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/${projectId}`,
            audience: projectId,
        });

        return payload;
    } catch (error) {
        console.error('[JOSE] Token verification failed:', error);
        throw error;
    }
}
