'use strict';

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

const REQUIRED_ENV = [
    'FIREBASE_SERVICE_ACCOUNT_JSON',
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

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
}

const db = admin.database();

const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const EMAIL_FROM = process.env.SMTP_FROM || process.env.SMTP_USER;
const MAX_AGE_DAYS = Number(process.env.EMAIL_MAX_AGE_DAYS || 7);
const APP_BASE_URL = process.env.APP_BASE_URL || '';

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

function buildAnalyticsUrl(item) {
    if (!item.analyticsHref) return null;
    if (/^https?:\/\//.test(item.analyticsHref)) return item.analyticsHref;
    if (!APP_BASE_URL) return item.analyticsHref;
    return `${APP_BASE_URL.replace(/\/$/, '')}${item.analyticsHref}`;
}

function buildEmailSubject(item) {
    return `[${item.severity.toUpperCase()}] ${item.title}`;
}

function buildEmailText(item) {
    const analyticsUrl = buildAnalyticsUrl(item);
    const value = Number(item.value || 0);
    return [
        `${item.title || 'Notification'}`,
        '',
        `${item.description || ''}`,
        '',
        `Rule: ${item.ruleName || 'Rule'}`,
        `Metric: ${item.metric || 'metric'}`,
        `Value: ${value.toFixed(2)} ${item.unit || ''}`,
        `Threshold: ${item.threshold || 0} ${item.unit || ''}`,
        `Received: ${item.receivedAt || new Date().toISOString()}`,
        analyticsUrl ? `View: ${analyticsUrl}` : null,
    ].filter(Boolean).join('\n');
}

function buildEmailHtml(item) {
    const analyticsUrl = buildAnalyticsUrl(item);
    const value = Number(item.value || 0);
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2 style="margin: 0 0 8px;">${item.title || 'Notification'}</h2>
            <p style="margin: 0 0 12px; color: #555;">${item.description || ''}</p>
            <table style="border-collapse: collapse; width: 100%; margin-bottom: 12px;">
                <tr><td><strong>Rule</strong></td><td>${item.ruleName || 'Rule'}</td></tr>
                <tr><td><strong>Metric</strong></td><td>${item.metric || 'metric'}</td></tr>
                <tr><td><strong>Value</strong></td><td>${value.toFixed(2)} ${item.unit || ''}</td></tr>
                <tr><td><strong>Threshold</strong></td><td>${item.threshold || 0} ${item.unit || ''}</td></tr>
                <tr><td><strong>Received</strong></td><td>${item.receivedAt || new Date().toISOString()}</td></tr>
            </table>
            ${analyticsUrl ? `<a href="${analyticsUrl}">View in analytics</a>` : ''}
        </div>
    `;
}

async function sendNotificationEmail(to, item) {
    await transport.sendMail({
        from: EMAIL_FROM,
        to,
        subject: buildEmailSubject(item),
        text: buildEmailText(item),
        html: buildEmailHtml(item),
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

main()
    .then(() => {
        console.log('Notification email job completed.');
    })
    .catch((error) => {
        console.error('Notification email job failed:', error);
        process.exitCode = 1;
    });
