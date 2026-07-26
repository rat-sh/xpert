'use client';
import Link from 'next/link';
import { ClipboardCheck, FileText } from 'lucide-react';
import { BatchStatusControl } from '@/app/components/student/BatchStatusControl';
import { useStudent } from '@/contexts/StudentContext';

const quickLinks = [
  { label: 'My Exams', href: '/student/exams', icon: ClipboardCheck, color: 'bg-green-100 text-green-600', desc: 'Take exams from your batches' },
  { label: 'My Results', href: '/student/results', icon: FileText, color: 'bg-blue-100 text-blue-600', desc: 'View your performance' },
];

export default function StudentHomePage() {
  const { student } = useStudent();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Hello, {student?.full_name?.split(' ')[0] ?? 'Student'} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">Your exams and results, all in one place.</p>
        </div>
        <BatchStatusControl />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.label} href={link.href} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow group">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${link.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">{link.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{link.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
