# Developer Guide - IoT Monitoring Dashboard

## Project Structure

```
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home/redirect page
│   ├── login/                  # Login page
│   │   └── page.tsx
│   └── dashboard/              # Protected dashboard
│       ├── layout.tsx          # Dashboard layout with sidebar
│       ├── page.tsx            # Overview page
│       ├── analytics/          # Analytics section
│       │   └── page.tsx
│       └── notifications/      # Notifications section
│           └── page.tsx
├── components/
│   ├── ui/                     # shadcn/ui components
│   └── AppProvider.tsx         # App provider component
├── hooks/
│   ├── useAuth.ts              # Authentication hook
│   ├── useSensorData.ts        # Sensor data hook
│   └── use-mobile.tsx          # Mobile detection hook
├── lib/
│   ├── firebase.ts             # Firebase configuration
│   └── utils.ts                # Utility functions
├── scripts/
│   └── seed-firebase.js        # Database seeding script
└── public/                     # Static assets
```

## Key Components

### Hooks

#### `useAuth()`
Manages user authentication state and operations.

```typescript
const { user, loading, error, login, signup, logout } = useAuth();
```

Properties:
- `user`: Current Firebase user object or null
- `loading`: Boolean indicating if auth state is being checked
- `error`: Any authentication error message
- `login(email, password)`: Sign in user
- `signup(email, password)`: Create new user
- `logout()`: Sign out current user

#### `useSensorData(sensorId)`
Fetches real-time sensor data from Firebase Realtime Database.

```typescript
const { currentReading, historicalData, loading, error } = useSensorData(sensorId);
```

Properties:
- `currentReading`: Latest sensor reading with timestamp, voltage, current, power, temperature, humidity
- `historicalData`: Array of all readings for the sensor
- `loading`: Boolean indicating if data is being fetched
- `error`: Any data fetching error message

### Firebase Database Structure

```
sensors/
  device_1/
    readings/
      reading_TIMESTAMP/
        timestamp: number
        voltage: number (V)
        current: number (A)
        power: number (W)
        temperature: number (°C)
        humidity: number (%)
```

## Pages

### Login Page (`/login`)
- Email/password authentication
- Sign in and sign up modes
- Error handling and validation
- Demo credentials display

### Dashboard Overview (`/dashboard`)
- Real-time metrics in cards
- Sensor selection dropdown
- Voltage and power charts (Recharts)
- All metrics overview chart
- Responsive grid layout

### Analytics (`/dashboard/analytics`)
- Historical data analysis
- Time range selection (24h, 7d, 30d)
- Statistics cards (average, peak values)
- Voltage analysis line chart
- Power consumption bar chart
- Multi-metric overview

### Notifications (`/dashboard/notifications`)
- Real-time alert generation
- Alert filtering by device
- Alert management (read/unread)
- Summary statistics
- Automatic threshold monitoring

## Styling

- **Framework**: Tailwind CSS
- **Components**: shadcn/ui
- **Icons**: lucide-react
- **Charts**: Recharts
- **Color Scheme**: Blue/Slate professional theme

## Adding a New Page

1. Create directory: `app/dashboard/newpage/`
2. Create `page.tsx` with layout:

```typescript
'use client';

import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';

export default function NewPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">New Page</h1>
      {/* Your content */}
    </div>
  );
}
```

3. Add navigation link in `app/dashboard/layout.tsx` sidebar

## Adding a New Feature

### Database Access
```typescript
import { useSensorData } from '@/hooks/useSensorData';

const { currentReading, historicalData } = useSensorData('device_1');
```

### Authentication Check
```typescript
import { useAuth } from '@/hooks/useAuth';

const { user, loading } = useAuth();

if (!user && !loading) {
  // Redirect to login
}
```

### Database Writing (Advanced)
```typescript
import { ref, set } from 'firebase/database';
import { database } from '@/lib/firebase';

await set(ref(database, 'path/to/data'), { /* data */ });
```

## Performance Optimization

1. **Lazy Loading**: Charts only render when needed
2. **Data Limiting**: Only show last 288 readings (24 hours) by default
3. **Memoization**: Use `useMemo` for expensive calculations
4. **Real-time Updates**: Firebase listeners auto-update without polling

## Adding Custom Alerts

Edit `app/dashboard/notifications/page.tsx` in the `useMemo` hook:

```typescript
const activeAlerts = useMemo(() => {
  const newAlerts: Alert[] = [];

  if (currentReading) {
    // Add your conditions
    if (currentReading.voltage > 30) {
      newAlerts.push({
        id: `voltage_${Date.now()}`,
        type: 'critical',
        title: 'Critical Voltage',
        message: `Voltage: ${currentReading.voltage}V`,
        timestamp: Date.now(),
        sensor: selectedSensor,
        read: false,
      });
    }
  }

  return newAlerts;
}, [currentReading, selectedSensor]);
```

## Testing

### Local Testing
1. Run `npm run dev`
2. Navigate to `http://localhost:3000`
3. Use demo credentials to log in
4. Test responsive design with browser dev tools

### Firebase Testing
1. Check data in Firebase Console → Realtime Database
2. Verify authentication in Firebase Console → Authentication
3. Test database rules in Realtime Database → Rules

## Environment Variables

Create `.env.local` with:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
```

## Common Issues

### Data Not Showing
1. Check Firebase connection with environment variables
2. Verify data exists in Firebase Console
3. Check browser console for errors

### Charts Not Rendering
1. Ensure `historicalData` array has values
2. Check `formatChartData()` function returns correct format
3. Verify Recharts is properly imported

### Authentication Not Working
1. Verify Firebase Authentication is enabled
2. Check user exists in Firebase Console
3. Verify security rules allow operations

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Recharts Documentation](https://recharts.org)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)
