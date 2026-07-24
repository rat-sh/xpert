'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, UserPlus, Hash, Phone, ArrowRight, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useStudent } from '@/contexts/StudentContext';
import { getStudentSession } from '@/lib/studentSession';

/** Strip everything except digits; strip leading 91 if 12 digits */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

export default function StudentJoinPage() {
  const router = useRouter();
  const { student, register, joinBatch } = useStudent();
  const existing = student ?? (typeof window !== 'undefined' ? getStudentSession() : null);

  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'name' | 'join'>(existing ? 'join' : 'name');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    const norm = normalizePhone(phone);
    if (!norm || norm.length !== 10) {
      toast.error('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    const sess = await register(name.trim(), norm);
    setLoading(false);
    if (!sess) {
      toast.error('Could not create student profile. Try again.');
      return;
    }
    toast.success(`Welcome${sess.name !== name.trim() ? `, ${sess.name}` : ''}! Student ID: ${sess.student_code}`);
    setStep('join');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      toast.error('Enter the batch join code from your teacher.');
      return;
    }
    setLoading(true);
    const ok = await joinBatch(joinCode.trim());
    setLoading(false);
    if (!ok) {
      toast.error('Invalid join code. Check with your teacher.');
      return;
    }
    toast.success('Joined batch successfully!');
    router.push('/student');
  };

  const skipToDashboard = () => router.push('/student');

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Student Access</h1>
          <p className="text-indigo-200 text-sm">No sign-up needed — just your name &amp; mobile</p>
        </div>

        <div className="px-8 py-6">

          {/* Existing student banner */}
          {existing && step === 'join' && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">{existing.name}</p>
                <p className="text-xs text-green-700 font-mono mt-0.5">ID: {existing.student_code}</p>
                {existing.phone && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    📱 {existing.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 1 — Registration */}
          {step === 'name' && !existing && (
            <form onSubmit={handleRegister} className="space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Rahul Sharma"
                  required
                  autoComplete="name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm transition"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400 select-none">
                    <Phone className="w-4 h-4" />
                    <span className="text-sm font-medium text-gray-500">+91</span>
                  </div>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    required
                    autoComplete="tel"
                    maxLength={10}
                    className="w-full pl-16 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono transition"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Used to reconnect you if you switch devices — never shared.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium text-sm transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'Setting up…' : 'Continue'}
                {!loading && <ArrowRight className="w-4 h-4 ml-auto" />}
              </button>
            </form>
          )}

          {/* Step 2 — Join Batch */}
          {(step === 'join' || existing) && (
            <form onSubmit={handleJoin} className="space-y-5">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Batch Join Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="code"
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g., A7KD91"
                    required
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono uppercase tracking-widest transition"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Ask your teacher for this code</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium text-sm transition-colors"
              >
                {loading ? 'Joining…' : 'Join Batch'}
              </button>

              {existing && (
                <button
                  type="button"
                  onClick={skipToDashboard}
                  className="w-full text-sm text-gray-500 hover:text-gray-800 py-2 transition-colors"
                >
                  Skip — go to my dashboard
                </button>
              )}
            </form>
          )}

          {/* Step indicator */}
          {!existing && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <span className={`w-2 h-2 rounded-full transition-colors ${step === 'name' ? 'bg-indigo-600' : 'bg-gray-300'}`} />
              <span className={`w-2 h-2 rounded-full transition-colors ${step === 'join' ? 'bg-indigo-600' : 'bg-gray-300'}`} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 text-center">
          <p className="text-sm text-gray-500">
            Are you a teacher?{' '}
            <Link href="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
