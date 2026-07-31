import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot Password — Xpert',
  description: 'Reset your Xpert account password via email.',
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
