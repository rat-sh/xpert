import type { Metadata } from 'next';
import { SignupForm } from '@/features/auth/components/SignupForm';

export const metadata: Metadata = {
  title: 'Create Teacher Account — Xpert',
  description: 'Register as a teacher on Xpert and start managing your classes.',
};

export default function SignupPage() {
  return <SignupForm />;
}
