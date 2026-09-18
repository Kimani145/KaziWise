'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../features/auth/hooks';
import { isLearner } from '../../lib/permissions';
import { Button } from '../../components/ui/button';
import { FormField } from '../../components/forms/FormField';
import { Input } from '../../components/ui/input';
import Link from 'next/link';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please enter both your work email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await login({ email: email.trim(), password });
      if (isLearner(res.user)) {
        router.push('/home');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-md">
            K
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          KaziWise LMS
        </h2>
        <p className="mt-1 text-center text-xs font-semibold text-emerald-700 tracking-wider uppercase">
          Employee Compliance & Training Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-200 sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2.5 font-medium"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <FormField label="Work Email" required htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="min-h-[44px]"
              />
            </FormField>

            <FormField label="Password" required htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="min-h-[44px]"
              />
            </FormField>

            <div className="flex items-center justify-between text-xs">
              <Link
                href="/forgot-password"
                className="font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
              >
                Forgot your password?
              </Link>
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                className="w-full min-h-[44px] text-sm font-semibold"
              >
                Sign In to Workspace
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Server-Authoritative Multi-Tenant RBAC</span>
          </div>
        </div>
      </div>
    </div>
  );
}
