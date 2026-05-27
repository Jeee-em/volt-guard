import 'server-only';

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let adminApp: admin.app.App | null = null;

function loadServiceAccount(): admin.ServiceAccount {
    // Prefer full JSON content in env (used by CI/GitHub Actions)
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (raw) {
        try {
            return JSON.parse(raw) as admin.ServiceAccount;
        } catch (err) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON');
        }
    }

    // Fallback to a filesystem path for local development
    const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (jsonPath) {
        const resolved = path.isAbsolute(jsonPath) ? jsonPath : path.resolve(process.cwd(), jsonPath);
        if (!fs.existsSync(resolved)) {
            throw new Error(`FIREBASE_SERVICE_ACCOUNT_PATH does not exist: ${resolved}`);
        }
        const content = fs.readFileSync(resolved, { encoding: 'utf8' });
        try {
            return JSON.parse(content) as admin.ServiceAccount;
        } catch (err) {
            throw new Error('File at FIREBASE_SERVICE_ACCOUNT_PATH is not valid JSON');
        }
    }

    throw new Error('Neither FIREBASE_SERVICE_ACCOUNT_JSON nor FIREBASE_SERVICE_ACCOUNT_PATH is set');
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
