'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Zap } from 'lucide-react';

// ─── Google icon (inline SVG to avoid extra deps) ─────────────────────────────

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
        or
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, loginWithGoogle, loading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password) {
      setLocalError('Please fill in all fields.');
      return;
    }
    let authError = null;
    try {
      if (isSignup) {
        authError = await signup(email, password);
      } else {
        authError = await login(email, password);
      }
      
      if (authError) {
        setLocalError(authError);
        return;
      }
      
      router.push('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Authentication failed.');
    }
  };

  const handleGoogle = async () => {
    setLocalError('');
    try {
      const authError = await loginWithGoogle();
      if (authError) {
        setLocalError(authError);
        return;
      }
      router.push('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Google sign-in failed.');
    }
  };

  const displayError = localError;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/40 p-4">

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-8 shadow-sm">

        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <h1 className="text-[24px] font-semibold tracking-tight text-foreground">
            VoltGuard
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {isSignup ? 'Create an account to get started' : 'Sign in to your dashboard'}
          </p>
        </div>

        {/* Google button */}
        <Button
          type="button"
          variant="outline"
          className="mb-5 w-full gap-2 text-[13px] font-medium"
          onClick={handleGoogle}
          disabled={loading}
        >
          <GoogleIcon />
          Continue with Google
        </Button>

        <Divider />

        {/* Email / password form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-[12px] font-medium text-muted-foreground"
            >
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="example@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-10 text-[13px]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-[12px] font-medium text-muted-foreground"
            >
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-10 pr-10 text-[13px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {displayError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-[12px] text-destructive">
              {displayError}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="mt-1 h-10 w-full text-[13px] font-medium"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-background/40 border-t-background" />
                {isSignup ? 'Creating account…' : 'Signing in…'}
              </span>
            ) : isSignup ? (
              'Create account'
            ) : (
              'Sign in'
            )}
          </Button>
        </form>

        {/* Toggle sign up / sign in */}
        <p className="mt-5 text-center text-[12px] text-muted-foreground">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          <button
            onClick={() => {
              setIsSignup((v) => !v);
              setLocalError('');
            }}
            disabled={loading}
            className="ml-1.5 font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            {isSignup ? 'Sign in' : 'Sign up'}
          </button>
        </p>

        {/* Demo credentials */}
        <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Demo credentials
          </p>
          <div className="space-y-0.5 font-mono text-[12px] text-foreground">
            <p>demo@example.com</p>
            <p>demo123456</p>
          </div>
        </div>
      </div>
    </div>
  );
}