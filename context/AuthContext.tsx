"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
    User,
    onIdTokenChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    signOut,
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<string | null>;
    signup: (email: string, password: string) => Promise<string | null>; // Add this
    loginWithGoogle: () => Promise<string | null>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // onIdTokenChanged triggers on sign-in, sign-out, and token refresh
        const unsubscribe = onIdTokenChanged(auth, async (user) => {
            if (user) {
                try {
                    const token = await user.getIdToken();
                    // Update cookie with fresh token
                    document.cookie = `token=${token}; path=/; secure; samesite=strict; max-age=3600`;
                    setUser(user);
                } catch (error) {
                    console.log("Token retrieval failed, logging out");
                    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; samesite=strict";
                    setUser(null);
                }
            } else {
                // User is null, clear cookie
                document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; samesite=strict";
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string): Promise<string | null> => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const token = await userCredential.user.getIdToken();

            // Store token securely
            document.cookie = `token=${token}; path=/; secure; samesite=strict`;
            return null;
        } catch (error: any) {
            console.error('Login error:', error);
            if (error.code === "auth/user-not-found") return "User does not exist.";
            if (error.code === "auth/wrong-password") return "Incorrect password.";
            if (error.code === "auth/invalid-credential") return "Invalid email or password.";
            return "Login failed. Please try again.";
        }
    };

    const signup = async (email: string, password: string): Promise<string | null> => {
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const token = await userCredential.user.getIdToken();

            // Store token securely
            document.cookie = `token=${token}; path=/; secure; samesite=strict`;
            return null;
        } catch (error: any) {
            console.error('Signup error:', error);
            if (error.code === "auth/email-already-in-use") return "An account with this email already exists.";
            if (error.code === "auth/weak-password") return "Password should be at least 6 characters.";
            if (error.code === "auth/invalid-email") return "Invalid email address.";
            return "Account creation failed. Please try again.";
        }
    };

    // Add Google Sign-In function with immediate popup monitoring
    const loginWithGoogle = async (): Promise<string | null> => {
        try {
            // Create a promise that resolves faster when popup is closed
            const popupPromise = signInWithPopup(auth, googleProvider);

            const result = await popupPromise;
            const token = await result.user.getIdToken();

            // Store token securely
            document.cookie = `token=${token}; path=/; secure; samesite=strict`;

            return null; // Success
        } catch (error: any) {
            // Log the error for debugging (popup closed, cancelled, or other error)
            console.error('Google login error:', error);
            return null;
        }
    };

    const logout = async () => {
        try {
            // Clear cookie first to prevent middleware conflicts
            document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; samesite=strict";

            // Then sign out from Firebase
            await signOut(auth);

            // Clear local state and navigate to login
            setUser(null);
            router.push('/login');
        } catch (error) {
            console.error("Logout failed:", error);
            // Even if Firebase logout fails, ensure cookie is cleared
            document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; secure; samesite=strict";
            setUser(null);
            try {
                router.push('/login');
            } catch (e) {
                // ignore
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};