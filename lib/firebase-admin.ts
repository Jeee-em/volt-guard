import 'server-only';

import admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;

function loadServiceAccount(): admin.ServiceAccount {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing required Firebase Admin credentials in environment variables.');
    }

    return {
        projectId,
        clientEmail,
        // Safely parse literal '\n' strings back into actual newlines for the RSA key
        privateKey: privateKey.replace(/\\n/g, '\n'),
    };
}

export function getAdminApp(): admin.app.App {
    if (adminApp) return adminApp;

    if (!admin.apps.length) {
        const databaseURL = process.env.FIREBASE_DATABASE_URL;
        
        if (!databaseURL) {
            throw new Error('FIREBASE_DATABASE_URL is not set');
        }

        admin.initializeApp({
            credential: admin.credential.cert(loadServiceAccount()),
            databaseURL,
        });
    }

    adminApp = admin.app();
    return adminApp;
}

export function getAdminDb() {
    return getAdminApp().database();
}

export function getAdminAuth() {
    return getAdminApp().auth();
}