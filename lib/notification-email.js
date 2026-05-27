'use strict';

const nodemailer = require('nodemailer');

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

function getAppBaseUrl(options = {}) {
    return options.appBaseUrl || process.env.APP_BASE_URL || '';
}

function buildAnalyticsUrl(item, options = {}) {
    if (!item?.analyticsHref) return null;
    if (/^https?:\/\//.test(item.analyticsHref)) return item.analyticsHref;
    const appBaseUrl = getAppBaseUrl(options);
    if (!appBaseUrl) return item.analyticsHref;
    return `${appBaseUrl.replace(/\/$/, '')}${item.analyticsHref}`;
}

function buildNotificationEmailSubject(item) {
    const severity = String(item?.severity || 'info').toUpperCase();
    const title = item?.title || 'Notification';
    return `[${severity}] ${title}`;
}

function buildNotificationEmailText(item, options = {}) {
    const analyticsUrl = buildAnalyticsUrl(item, options);
    const value = Number(item?.value || 0);
    return [
        `${item?.title || 'Notification'}`,
        '',
        `${item?.description || ''}`,
        '',
        `Rule: ${item?.ruleName || 'Rule'}`,
        `Metric: ${item?.metric || 'metric'}`,
        `Value: ${value.toFixed(2)} ${item?.unit || ''}`,
        `Threshold: ${item?.threshold || 0} ${item?.unit || ''}`,
        `Received: ${item?.receivedAt || new Date().toISOString()}`,
        analyticsUrl ? `View: ${analyticsUrl}` : null,
    ].filter(Boolean).join('\n');
}

function buildNotificationEmailHtml(item, options = {}) {
    const analyticsUrl = buildAnalyticsUrl(item, options);
    const value = Number(item?.value || 0);
    const description = item?.description || '';
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
            <h2 style="margin: 0 0 8px;">${item?.title || 'Notification'}</h2>
            <p style="margin: 0 0 12px; color: #4b5563;">${description}</p>
            <table style="border-collapse: collapse; width: 100%; margin-bottom: 12px; color: #111827;">
                <tr><td style="padding: 4px 8px 4px 0;"><strong>Rule</strong></td><td style="padding: 4px 0;">${item?.ruleName || 'Rule'}</td></tr>
                <tr><td style="padding: 4px 8px 4px 0;"><strong>Metric</strong></td><td style="padding: 4px 0;">${item?.metric || 'metric'}</td></tr>
                <tr><td style="padding: 4px 8px 4px 0;"><strong>Value</strong></td><td style="padding: 4px 0;">${value.toFixed(2)} ${item?.unit || ''}</td></tr>
                <tr><td style="padding: 4px 8px 4px 0;"><strong>Threshold</strong></td><td style="padding: 4px 0;">${item?.threshold || 0} ${item?.unit || ''}</td></tr>
                <tr><td style="padding: 4px 8px 4px 0;"><strong>Received</strong></td><td style="padding: 4px 0;">${item?.receivedAt || new Date().toISOString()}</td></tr>
            </table>
            ${analyticsUrl ? `<a href="${analyticsUrl}" style="color: #2563eb; text-decoration: none;">View in analytics</a>` : ''}
        </div>
    `;
}

function buildNotificationEmailMessage(item, options = {}) {
    return {
        subject: buildNotificationEmailSubject(item),
        text: buildNotificationEmailText(item, options),
        html: buildNotificationEmailHtml(item, options),
    };
}

function createNotificationEmailTransport() {
    const host = requireEnv('SMTP_HOST');
    const port = Number(requireEnv('SMTP_PORT'));
    const secure = requireEnv('SMTP_SECURE') === 'true';
    const user = requireEnv('SMTP_USER');
    const pass = requireEnv('SMTP_PASS').replace(/\s+/g, '');

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
    });
}

module.exports = {
    buildNotificationEmailMessage,
    buildNotificationEmailSubject,
    buildNotificationEmailText,
    buildNotificationEmailHtml,
    buildAnalyticsUrl,
    createNotificationEmailTransport,
};