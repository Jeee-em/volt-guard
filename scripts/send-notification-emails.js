'use strict';

const admin = require('firebase-admin');
const fs = require('fs');
const {
    buildNotificationEmailMessage,
    createNotificationEmailTransport,
} = require('../lib/notification-email');

const REQUIRED_ENV = [
    // Either JSON or PATH to service account must be provided
    'FIREBASE_DATABASE_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
];

for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        throw new Error(`Missing required env var: ${key}`);
    }
}

// Load service account JSON either from env or from a file path
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (err) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON');
    }
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    try {
        const raw = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
        serviceAccount = JSON.parse(raw);
    } catch (err) {
        throw new Error(`Failed to read or parse FIREBASE_SERVICE_ACCOUNT_PATH: ${err.message}`);
    }
} else {
    throw new Error('Either FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH must be set');
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

const db = admin.database();

const transport = createNotificationEmailTransport();

const EMAIL_FROM = process.env.SMTP_FROM || process.env.SMTP_USER;
const MAX_AGE_DAYS = Number(process.env.EMAIL_MAX_AGE_DAYS || 7);
function parseTimeToMinutes(value) {
    const [h, m] = value.split(':').map((part) => Number(part));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
}

function isWithinQuietHours(quietHours, now) {
    if (!quietHours?.enabled) return false;
    if (!Array.isArray(quietHours.days) || !quietHours.days.includes(now.getDay())) return false;
    const from = parseTimeToMinutes(quietHours.from);
    const to = parseTimeToMinutes(quietHours.to);
    if (from === null || to === null) return false;

    const minutes = now.getHours() * 60 + now.getMinutes();
    if (from === to) return true;
    if (from < to) return minutes >= from && minutes < to;
    return minutes >= from || minutes < to;
}

async function sendNotificationEmail(to, item) {
    await transport.sendMail({
        from: EMAIL_FROM,
        to,
        ...buildNotificationEmailMessage(item, { appBaseUrl: process.env.APP_BASE_URL || '' }),
    });
}

async function main() {
    await transport.verify();

    const prefsSnapshot = await db.ref('user_notification_preferences').get();
    const prefsByUser = prefsSnapshot.val() || {};
    const now = new Date();
    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

    const userIds = Object.keys(prefsByUser);
    for (const uid of userIds) {
        const prefs = prefsByUser[uid];
        const email = prefs?.contact?.email;
        if (!email) continue;

        const quietActive = isWithinQuietHours(prefs?.quietHours, now);

        const notifSnapshot = await db.ref(`user_notifications/${uid}`).get();
        const notifications = notifSnapshot.val() || {};

        for (const [id, item] of Object.entries(notifications)) {
            const receivedAtMs = Number(item?.receivedAtMs || Date.parse(item?.receivedAt || ''));
            if (!Number.isFinite(receivedAtMs)) continue;
            if (receivedAtMs < cutoff) {
                await db.ref(`user_notifications/${uid}/${id}/delivery`).update({
                    emailSkipped: true,
                    emailSkipReason: 'stale',
                    emailSkippedAt: new Date().toISOString(),
                });
                continue;
            }

            if (item?.status !== 'unread') continue;
            if (item?.delivery && item.delivery.emailSent) continue;

            const severity = item?.severity;
            const emailEnabled = prefs?.matrix?.[severity]?.email === true;
            if (!emailEnabled) continue;

            if (quietActive && severity !== 'critical') continue;

            await sendNotificationEmail(email, item);
            await db.ref(`user_notifications/${uid}/${id}/delivery`).update({
                emailSent: true,
                emailSentAt: new Date().toISOString(),
                emailProvider: 'gmail',
            });
        }
    }
}

async function shutdown() {
    // Close nodemailer transport if supported
    try {
        if (transport && typeof transport.close === 'function') {
            transport.close();
        }
    } catch (err) {
        console.warn('Error closing transport:', err);
    }

    // Delete firebase apps to close sockets
    try {
        await Promise.all(admin.apps.map((app) => app.delete()));
    } catch (err) {
        console.warn('Error deleting firebase apps:', err);
    }
}

(async () => {
    try {
        await main();
        console.log('Notification email job completed.');
    } catch (error) {
        console.error('Notification email job failed:', error);
        process.exitCode = 1;
    } finally {
        await shutdown();
    }
})();
