import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
    buildNotificationEmailMessage,
    createNotificationEmailTransport,
} from '@/lib/notification-email';

const EMAIL_FROM = process.env.SMTP_FROM || process.env.SMTP_USER;
const DEBUG_SEND_EMAIL = process.env.NODE_ENV !== 'production';

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Unknown error';
}

function debugSendEmail(...args: unknown[]) {
    if (DEBUG_SEND_EMAIL) {
        console.log('[send-email]', ...args);
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ notificationId: string }> },
) {
    try {
        debugSendEmail('request start');

        const token = (await cookies()).get('token')?.value;
        if (!token) {
            debugSendEmail('missing token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { notificationId } = await params;
        debugSendEmail('notification id', notificationId);
        if (!notificationId) {
            return NextResponse.json({ error: 'Missing notification id' }, { status: 400 });
        }

        const decoded = await getAdminAuth().verifyIdToken(token);
        debugSendEmail('decoded auth', {
            uid: decoded?.uid,
            email: decoded?.email,
            hasEmail: Boolean(decoded?.email),
        });
        if (!decoded?.uid || !decoded.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const notificationPaths = [
            `user_notifications/${decoded.uid}/${notificationId}`,
            `notifications/${decoded.uid}/${notificationId}`,
        ];

        let notificationSnapshot = null;
        let notificationPath = notificationPaths[0];
        for (const path of notificationPaths) {
            debugSendEmail('checking notification path', path);
            const snapshot = await getAdminDb().ref(path).get();
            if (snapshot.exists()) {
                notificationSnapshot = snapshot;
                notificationPath = path;
                debugSendEmail('notification found', path);
                break;
            }
        }

        if (!notificationSnapshot) {
            debugSendEmail('notification not found', notificationPaths);
            return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
        }

        const notification = notificationSnapshot.val();
        if (!notification || typeof notification !== 'object') {
            return NextResponse.json({ error: 'Invalid notification payload' }, { status: 400 });
        }

        const prefsSnapshot = await getAdminDb()
            .ref(`user_notification_preferences/${decoded.uid}`)
            .get();
        const prefs = prefsSnapshot.val() || {};
        debugSendEmail('preferences loaded', {
            hasPrefs: Boolean(prefsSnapshot.exists()),
            hasContact: Boolean(prefs?.contact),
            prefKeys: Object.keys(prefs || {}),
        });

        const now = new Date().toISOString();
        await getAdminDb().ref(`user_notification_preferences/${decoded.uid}`).update({
            contact: {
                ...(prefs.contact && typeof prefs.contact === 'object' ? prefs.contact : {}),
                email: decoded.email,
            },
            updatedAt: now,
        });
        debugSendEmail('preferences updated with recipient email');

        let transport;
        try {
            transport = createNotificationEmailTransport();
            debugSendEmail('smtp transport created', {
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: process.env.SMTP_SECURE,
                fromConfigured: Boolean(EMAIL_FROM),
                userConfigured: Boolean(process.env.SMTP_USER),
            });
            await transport.verify();
            debugSendEmail('smtp verify ok');
        } catch (error) {
            debugSendEmail('smtp verify failed', getErrorMessage(error));
            return NextResponse.json(
                { error: `SMTP configuration failed: ${getErrorMessage(error)}` },
                { status: 500 },
            );
        }

        const message = buildNotificationEmailMessage(notification, {
            appBaseUrl: process.env.APP_BASE_URL || '',
        });
        debugSendEmail('email message built', {
            subject: message.subject,
            recipient: decoded.email,
            notificationPath,
        });

        try {
            await transport.sendMail({
                from: EMAIL_FROM,
                to: decoded.email,
                ...message,
            });
            debugSendEmail('smtp send ok');
        } catch (error) {
            debugSendEmail('smtp send failed', getErrorMessage(error));
            return NextResponse.json(
                { error: `Email send failed: ${getErrorMessage(error)}` },
                { status: 502 },
            );
        }

        await getAdminDb().ref(`${notificationPath}/delivery`).update({
            emailSent: true,
            emailSentAt: now,
            emailProvider: 'gmail',
            emailTrigger: 'manual',
            emailSentTo: decoded.email,
        });
        debugSendEmail('delivery metadata updated', {
            notificationPath,
            emailSentTo: decoded.email,
            sentAt: now,
        });

        return NextResponse.json({ ok: true, email: decoded.email, sentAt: now });
    } catch (error) {
        console.error('[send-email] route failed', {
            message: getErrorMessage(error),
            error,
        });
        debugSendEmail('route failed', getErrorMessage(error));
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}