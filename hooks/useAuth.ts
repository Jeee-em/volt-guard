import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthState({
        user,
        loading: false,
        error: null,
      });
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await signInWithEmailAndPassword(auth, email, password);
      setAuthState({
        user: result.user,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState({
        user: null,
        loading: false,
        error: error.message || 'Failed to login',
      });
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const result = await createUserWithEmailAndPassword(auth, email, password);
      setAuthState({
        user: result.user,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState({
        user: null,
        loading: false,
        error: error.message || 'Failed to create account',
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      await signOut(auth);
      setAuthState({
        user: null,
        loading: false,
        error: null,
      });
    } catch (error: any) {
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to logout',
      }));
      throw error;
    }
  };

  return {
    ...authState,
    login,
    signup,
    logout,
  };
};
