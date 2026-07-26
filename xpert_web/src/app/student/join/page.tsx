'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/contexts/StudentContext';

export default function StudentJoinPage() {
  const router = useRouter();
  const { student, loading, joinBatch } = useStudent();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', code: '' });
  const [saving, setSaving] = useState(false);

  const createStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(), password: form.password,
      options: { 
        emailRedirectTo: `${window.location.origin}/login`,
        data: { full_name: form.fullName.trim(), role: 'student' } 
      },
    });
    setSaving(false);
    if (error || !data.user) { toast.error(error?.message ?? 'Could not create student account.'); return; }
    if (!data.session) toast.success('Check your email to confirm your account, then sign in.');
    else toast.success('Account created. You can now join your batch.');
  };

  const submitJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const joined = await joinBatch(form.code);
    setSaving(false);
    if (!joined) { toast.error('Could not join this batch. Check the code and try again.'); return; }
    toast.success(`Joined ${joined.batchName}`);
    router.replace('/student');
  };

  if (loading) return <div className="min-h-screen grid place-items-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (student) return (
    <div className="max-w-md mx-auto mt-12 bg-white rounded-2xl border border-gray-200 p-7 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">Join another batch</h1>
      <p className="text-sm text-gray-500 mt-1">Enter the code from your teacher.</p>
      <form onSubmit={submitJoin} className="mt-6 space-y-4">
        <input value={form.code} onChange={(event) => setForm((value) => ({ ...value, code: event.target.value.toUpperCase() }))} placeholder="BATCH CODE" required className="w-full p-3 border rounded-lg font-mono uppercase tracking-widest" />
        <button disabled={saving} className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50">{saving ? 'Joining…' : 'Join batch'}</button>
      </form>
    </div>
  );
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 grid place-items-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-7"><div className="mx-auto w-14 h-14 rounded-full bg-indigo-100 grid place-items-center"><BookOpen className="w-7 h-7 text-indigo-600" /></div><h1 className="mt-4 text-2xl font-bold text-gray-900">Student account</h1><p className="text-sm text-gray-500 mt-1">Create an account to join batches and keep your results.</p></div>
        <form onSubmit={createStudent} className="space-y-4">
          <input required value={form.fullName} onChange={(event) => setForm((value) => ({ ...value, fullName: event.target.value }))} placeholder="Full name" className="w-full p-3 border rounded-lg text-sm" />
          <input required type="email" value={form.email} onChange={(event) => setForm((value) => ({ ...value, email: event.target.value }))} placeholder="Email address" className="w-full p-3 border rounded-lg text-sm" />
          <input required minLength={6} type="password" value={form.password} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} placeholder="Password (at least 6 characters)" className="w-full p-3 border rounded-lg text-sm" />
          <button disabled={saving} className="w-full py-3 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"><UserPlus className="w-4 h-4" />{saving ? 'Creating…' : 'Create student account'}</button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-6">Already have an account? <Link href="/login" className="text-indigo-600 font-medium">Sign in</Link></p>
      </div>
    </div>
  );
}
