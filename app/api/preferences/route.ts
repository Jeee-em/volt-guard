import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

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
