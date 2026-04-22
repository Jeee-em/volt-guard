'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { DeviceProvider } from '@/context/DeviceContext';

/**
 * AppProvider Component
 * 
 * Wraps the application with necessary providers and initializations.
 * This includes Firebase configuration and any other global setup.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DeviceProvider>
        {children}
      </DeviceProvider>
    </AuthProvider>
  );
}
