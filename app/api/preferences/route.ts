import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

function buildDefaultPreferences(email: string) {
    return {
        matrix: {
            critical: { in_app: true, email: true, sms: false },
            warning: { in_app: true, email: true, sms: false },
            info: { in_app: true, email: false, sms: false },
        },
        quietHours: {
            enabled: true,
            from: '22:00',
            to: '07:00',
            days: [0, 1, 2, 3, 4, 5, 6],
        },
        contact: {
            email,
            phone: '',
        },
    };
}

export async function GET() {
    try {
        const token = (await cookies()).get('token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const decoded = await getAdminAuth().verifyIdToken(token);
        if (!decoded?.uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const snapshot = await getAdminDb().ref(`user_notification_preferences/${decoded.uid}`).get();
        const storedPrefs = snapshot.val();

        return NextResponse.json({
            ok: true,
            prefs: storedPrefs || buildDefaultPreferences(decoded.email || ''),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const token = (await cookies()).get('token')?.value;
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const prefs = await request.json();
        if (!prefs || typeof prefs !== 'object') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const decoded = await getAdminAuth().verifyIdToken(token);
        if (!decoded?.uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!decoded.email) {
            return NextResponse.json(
                { error: 'Signed-in account does not have an email address.' },
                { status: 400 },
            );
        }

        const contact = prefs.contact && typeof prefs.contact === 'object' ? prefs.contact : {};

        const payload = {
            ...prefs,
            contact: {
                ...contact,
                email: decoded.email,
            },
            updatedAt: new Date().toISOString(),
        };

        await getAdminDb().ref(`user_notification_preferences/${decoded.uid}`).set(payload);

        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
