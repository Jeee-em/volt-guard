'use client';

import { ReactNode } from 'react';

/**
 * AppProvider Component
 * 
 * Wraps the application with necessary providers and initializations.
 * This includes Firebase configuration and any other global setup.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
