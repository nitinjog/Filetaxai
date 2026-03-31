'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Eye, EyeOff, IndianRupee, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

const perks = [
  'Free Old vs New Regime comparison',
  'AI-powered document parsing',
  'Step-by-step filing guide',
  'Secure & encrypted storage',
];

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const response = await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      login(response.user, response.token);
      toast({
        title: 'Account created!',
        description: `Welcome to FileTaxAI, ${response.user.name}!`,
      });
      router.push('/upload');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: 'Registration failed',
        description: err?.response?.data?.message || 'Could not create account. Try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid gap-8 lg:grid-cols-2 items-center">
        {/* Left side - Perks */}
        <div className="hidden lg:block text-white">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-saffron-500">
              <IndianRupee className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">
              FileTax<span className="text-saffron-400">AI</span>
            </span>
          </div>
          <h2 className="text-4xl font-bold leading-tight">
            File your ITR with<br />
            <span className="text-gradient">AI confidence</span>
          </h2>
          <p className="mt-4 text-slate-300 text-lg">
            The smartest way for salaried Indians to compute and file income tax returns.
          </p>
          <div className="mt-8 space-y-4">
            {perks.map((perk) => (
              <div key={perk} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-saffron-400 shrink-0" />
                <span className="text-slate-300">{perk}</span>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-xl glass-card p-4">
            <p className="text-sm text-slate-400 italic">
              "FileTaxAI saved me ₹22,000 by recommending the New Regime. The comparison was crystal clear!"
            </p>
            <p className="mt-2 text-xs text-slate-500">— Priya S., Software Engineer, Bengaluru</p>
          </div>
        </div>

        {/* Right side - Form */}
        <div>
          {/* Mobile logo */}
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-saffron-500">
              <IndianRupee className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">
              FileTax<span className="text-saffron-400">AI</span>
            </h1>
          </div>

          <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Create your account</CardTitle>
              <CardDescription className="text-slate-400">
                Free to use. No credit card required.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-300">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Rahul Sharma"
                    autoComplete="name"
                    className="border-white/10 bg-white/10 text-white placeholder:text-slate-500 focus:border-saffron-400"
                    {...register('name')}
                  />
                  {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="rahul@example.com"
                    autoComplete="email"
                    className="border-white/10 bg-white/10 text-white placeholder:text-slate-500 focus:border-saffron-400"
                    {...register('email')}
                  />
                  {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-300">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 chars, 1 uppercase, 1 number"
                      autoComplete="new-password"
                      className="border-white/10 bg-white/10 text-white placeholder:text-slate-500 pr-10 focus:border-saffron-400"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-red-400">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-300">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      className="border-white/10 bg-white/10 text-white placeholder:text-slate-500 pr-10 focus:border-saffron-400"
                      {...register('confirmPassword')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-400">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="saffron"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Free Account'
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-400">
                Already have an account?{' '}
                <Link href="/login" className="text-saffron-400 hover:text-saffron-300 font-medium">
                  Sign in
                </Link>
              </div>
            </CardContent>
          </Card>

          <p className="mt-4 text-center text-xs text-slate-500">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-slate-400 hover:text-slate-300">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-slate-400 hover:text-slate-300">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
