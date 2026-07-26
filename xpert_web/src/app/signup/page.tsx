'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function SignupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    subject: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name.trim() || !formData.email.trim() || !formData.password.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.full_name,
          role: 'teacher',
          phone: formData.phone || null,
        },
      },
    });

    if (authError || !authData.user) {
      toast.error(authError?.message ?? 'Signup failed.');
      setLoading(false);
      return;
    }

    if (!authData.session) {
      toast.success('Teacher account created. Confirm your email, then sign in.');
      setLoading(false);
      router.push('/login');
      return;
    }

    const { error: teacherError } = await supabase.from('teachers').update({
      institution_name: formData.subject ? `Subject: ${formData.subject}` : null,
    }).eq('id', authData.user.id);
    if (teacherError) {
      toast.error('Account created, but teacher profile setup failed: ' + teacherError.message);
      setLoading(false);
      return;
    }

    toast.success('Teacher account created! Redirecting…');
    setLoading(false);
    router.push('/teacher');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <GraduationCap className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-indigo-900 mb-2">Teacher Sign Up</h1>
          <p className="text-gray-600">Create your teacher account on Xpert</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name <span className="text-red-500">*</span></label>
            <input type="text" value={formData.full_name} onChange={(e) => handleChange('full_name', e.target.value)}
              placeholder="Your full name" required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input type="tel" value={formData.phone} onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+91 9876543210"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email <span className="text-red-500">*</span></label>
            <input type="email" value={formData.email} onChange={(e) => handleChange('email', e.target.value)}
              placeholder="you@example.com" required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" value={formData.subject} onChange={(e) => handleChange('subject', e.target.value)}
              placeholder="e.g., Physics"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                placeholder="••••••••" required minLength={6}
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium text-sm mt-2">
            {loading ? 'Creating account…' : 'Create Teacher Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-700">Sign in</Link>
        </p>
        <p className="text-center text-sm text-gray-500 mt-3">
          Student? <Link href="/student/join" className="text-green-600 font-medium hover:text-green-700">Create a student account</Link>
        </p>
      </div>
    </div>
  );
}
