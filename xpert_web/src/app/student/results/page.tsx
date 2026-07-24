'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/contexts/StudentContext';

interface ResultRow {
  submission_id: string;
  exam_id: string;
  exam_title: string;
  batch_name: string;
  total_score: number;
  total_marks: number;
  started_at: string;
  submitted_at: string;
}

export default function StudentResultsPage() {
  const { student } = useStudent();
  const [submissions, setSubmissions] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student) return;
    supabase.rpc('get_student_submissions', { p_student_id: student.id }).then(({ data }) => {
      setSubmissions((data as ResultRow[]) ?? []);
      setLoading(false);
    });
  }, [student]);

  const timeTaken = (s: ResultRow) => {
    const diff = (new Date(s.submitted_at).getTime() - new Date(s.started_at).getTime()) / 60000;
    return `${Math.floor(diff)}m ${Math.round((diff % 1) * 60)}s`;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-gray-900 text-xl font-semibold">My Results</h2>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 text-gray-500">
          No results yet. Complete an exam to see your results here.
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Exam', 'Batch', 'Score', 'Status', 'Submitted', 'Time'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {submissions.map((s) => {
                  const pct = s.total_marks ? Math.round((s.total_score / s.total_marks) * 100) : 0;
                  const passed = pct >= 40;
                  return (
                    <tr key={s.submission_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{s.exam_title}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{s.batch_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {s.total_score}/{s.total_marks}
                        <span className="ml-1 text-xs text-gray-500">({pct}%)</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {passed ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {passed ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{new Date(s.submitted_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{timeTaken(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
