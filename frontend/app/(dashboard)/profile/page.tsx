'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Loader2, Save, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';
import { getInitials } from '@/lib/utils';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format (e.g., ABCDE1234F)')
    .optional()
    .or(z.literal('')),
});

type ProfileForm = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      pan: user?.pan || '',
    },
  });

  const onSubmit = async (data: ProfileForm) => {
    setIsSaving(true);
    try {
      const updated = await authApi.updateProfile(data);
      setUser(updated);
      toast({ title: 'Profile updated!', description: 'Your changes have been saved.' });
    } catch {
      toast({ title: 'Error', description: 'Could not update profile.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="mt-1 text-slate-600">Manage your account details.</p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-navy-700 text-xl font-bold text-white">
          {user ? getInitials(user.name) : 'U'}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{user?.name}</p>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <Badge variant="success" className="mt-1 text-xs">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Verified Account
          </Badge>
        </div>
      </div>

      <Separator />

      {/* Profile form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Information
          </CardTitle>
          <CardDescription>Update your name, phone, and PAN.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" {...register('name')} placeholder="Your full name" />
              {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="bg-slate-50 text-slate-500"
              />
              <p className="text-xs text-slate-400">Email cannot be changed.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                {...register('phone')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pan">PAN Number</Label>
              <Input
                id="pan"
                placeholder="ABCDE1234F"
                className="uppercase"
                {...register('pan')}
              />
              {errors.pan && <p className="text-xs text-red-500">{errors.pan.message}</p>}
              <p className="text-xs text-slate-400">
                Your PAN is securely encrypted and never shared.
              </p>
            </div>

            <Button type="submit" disabled={isSaving || !isDirty} className="gap-2">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Password</p>
              <p className="text-xs text-slate-500">Last changed: Never</p>
            </div>
            <Button variant="outline" size="sm">Change Password</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Two-Factor Authentication</p>
              <p className="text-xs text-slate-500">Add an extra layer of security</p>
            </div>
            <Button variant="outline" size="sm">Enable 2FA</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Delete Account</p>
              <p className="text-xs text-slate-500">Permanently delete all data</p>
            </div>
            <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
