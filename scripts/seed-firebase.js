/**
 * Firebase Sample Data Generator
 * 
 * This script generates sample sensor data for the IoT monitoring dashboard.
 * Before running this script, you need to:
 * 1. Set up a Firebase project at https://firebase.google.com
 * 2. Enable Realtime Database in your Firebase project
 * 3. Set these environment variables:
 *    - NEXT_PUBLIC_FIREBASE_API_KEY
 *    - NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *    - NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *    - NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *    - NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *    - NEXT_PUBLIC_FIREBASE_APP_ID
 *    - NEXT_PUBLIC_FIREBASE_DATABASE_URL
 * 
 * To run this script:
 * npx tsx scripts/seed-firebase.js
 * 
 * Or if using Node.js directly:
 * node scripts/seed-firebase.js
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function generateSensorData(sensorId, baseVoltage = 24, days = 7) {
  const readings = {};
  const now = Date.now();
  
  for (let i = days * 24 * 60; i >= 0; i -= 5) {
    const timestamp = now - i * 60 * 1000;
    const variation = Math.sin(i / 100) * 0.5;
    
    readings[`reading_${timestamp}`] = {
      timestamp,
      voltage: baseVoltage + (Math.random() - 0.5) + variation,
      current: 5 + Math.random() * 3 + variation,
      power: (baseVoltage + (Math.random() - 0.5) + variation) * (5 + Math.random() * 3),
      temperature: 25 + Math.random() * 5,
      humidity: 45 + Math.random() * 20,
    };
  }
  
  return readings;
}

async function seedDatabase() {
  try {
    console.log('Seeding Firebase with sample sensor data...');
    
    // Create sample data for 3 sensors
    const devices = [
      { id: 'device_1', name: 'Device 1', voltage: 24 },
      { id: 'device_2', name: 'Device 2', voltage: 48 },
      { id: 'device_3', name: 'Device 3', voltage: 12 },
    ];
    
    for (const device of devices) {
      console.log(`Creating data for ${device.name}...`);
      const readings = generateSensorData(device.id, device.voltage);
      
      await set(ref(database, `sensors/${device.id}/readings`), readings);
      console.log(`✓ Created ${Object.keys(readings).length} readings for ${device.name}`);
    }
    
    console.log('✓ Firebase seeding complete!');
    console.log('\nYou can now use the following device IDs in the dashboard:');
    devices.forEach(device => {
      console.log(`  - ${device.id}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
