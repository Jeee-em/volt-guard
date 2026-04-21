# IoT Monitoring Dashboard - Setup Guide

Welcome to your IoT Monitoring Dashboard! This guide will help you set up the application with Firebase.

## Prerequisites

- Node.js 18+ and npm/pnpm installed
- A Firebase account (free at https://firebase.google.com)

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Name your project (e.g., "IoT Monitor")
4. Accept the terms and create the project

## Step 2: Enable Firebase Services

### Enable Realtime Database:
1. In the Firebase console, go to "Build" → "Realtime Database"
2. Click "Create Database"
3. Choose your location (closest to you)
4. Start in **test mode** (for development)
5. Click "Enable"

### Enable Authentication:
1. Go to "Build" → "Authentication"
2. Click "Get Started"
3. Click "Email/Password"
4. Enable "Email/Password" and click "Save"

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to Project Settings (⚙️ icon)
2. Under "Your apps", click "Web" or create a new web app
3. Copy the configuration object
4. You'll need these values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`
   - `databaseURL` (from Realtime Database page)

## Step 4: Set Environment Variables

Create a `.env.local` file in the project root with your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_database_url
```

**Important**: These variables start with `NEXT_PUBLIC_` which means they're exposed to the client. Never put secret keys here - Firebase security rules protect your data.

## Step 5: Configure Firebase Database Rules

1. Go to Realtime Database → Rules
2. Replace the default rules with this:

```json
{
  "rules": {
    "sensors": {
      "$sensorId": {
        "readings": {
          ".read": true,
          ".write": true,
          ".validate": "newData.hasChildren(['timestamp', 'voltage', 'current', 'power', 'temperature', 'humidity'])"
        }
      }
    }
  }
}
```

3. Click "Publish"

## Step 6: Create Demo User

1. Go to Authentication → Users
2. Click "Add user"
3. Email: `demo@example.com`
4. Password: `demo123456`
5. Click "Add user"

## Step 7: Seed Sample Data

Run the sample data script to populate your database with realistic sensor data:

```bash
npx tsx scripts/seed-firebase.js
```

This script creates sample readings for 3 devices with the IDs:
- `device_1` (24V system)
- `device_2` (48V system)
- `device_3` (12V system)

## Step 8: Run the Application

```bash
npm run dev
# or
pnpm dev
```

The application will be available at `http://localhost:3000`

## Login

Use the demo credentials:
- Email: `demo@example.com`
- Password: `demo123456`

## Features

### Dashboard Overview
- Real-time sensor metrics (voltage, current, power, temperature)
- Live charts showing voltage and power trends
- Device selection dropdown
- Status indicators with color coding

### Analytics
- Historical data analysis (last 24 hours, 7 days, 30 days)
- Performance statistics (average, peak, minimum values)
- Voltage and power consumption charts
- Multi-metric overview

### Notifications
- Alert monitoring system
- Critical and warning alerts based on thresholds
- Automatic alerts for:
  - Voltage out of range (20-28V)
  - High temperature (>35°C)
  - High current draw (>8A)
- Alert management (read/unread, delete)

## Firebase Structure

The database is organized as follows:

```
sensors/
  device_1/
    readings/
      reading_1234567890000/
        timestamp: 1234567890000
        voltage: 24.5
        current: 5.2
        power: 127.4
        temperature: 25.5
        humidity: 45.2
```

## Customization

### Change Sensor Names
Edit the sensors array in the relevant pages:
- `app/dashboard/page.tsx`
- `app/dashboard/analytics/page.tsx`
- `app/dashboard/notifications/page.tsx`

### Adjust Alert Thresholds
Edit the alert logic in `app/dashboard/notifications/page.tsx` within the `useMemo` hook.

### Modify Chart Data
Adjust the chart data formatting in each page's component functions.

## Troubleshooting

### "Cannot connect to Firebase"
- Check that all environment variables are correctly set in `.env.local`
- Verify that your Firebase project is active
- Make sure your database rules allow read/write access

### "No data showing on dashboard"
- Run the seed script again: `npx tsx scripts/seed-firebase.js`
- Check Firebase Console → Realtime Database to verify data exists
- Check browser console for any errors

### "Login fails"
- Verify the demo user exists in Firebase Authentication
- Check that Authentication is enabled in your Firebase project
- Ensure password matches exactly: `demo123456`

### "CORS errors"
- These are normal for local development
- The app uses Firebase which handles CORS correctly
- If issues persist, check your Firebase domain settings

## Production Deployment

When deploying to production:

1. Update Firebase security rules to restrict access:
```json
{
  "rules": {
    "sensors": {
      "$sensorId": {
        "readings": {
          ".read": "auth != null",
          ".write": "auth != null"
        }
      }
    }
  }
}
```

2. Create environment variables in your hosting platform (Vercel, etc.)
3. Ensure all `NEXT_PUBLIC_*` variables are set correctly

## Support

For issues with:
- **Firebase**: Visit [Firebase Documentation](https://firebase.google.com/docs)
- **Next.js**: Visit [Next.js Documentation](https://nextjs.org/docs)
- **This App**: Check the code comments and inline documentation

Happy monitoring!
