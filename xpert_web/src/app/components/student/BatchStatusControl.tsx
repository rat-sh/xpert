'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Plus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/contexts/StudentContext';

type JoinedBatch = { id: string; name: string; subject: string | null; teacherName: string };

export function BatchStatusControl() {
  const { student, joinBatch } = useStudent();
  const [batches, setBatches] = useState<JoinedBatch[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!student) return;
    const { data, error } = await supabase
      .from('batch_enrollments')
      .select('batch_id, batches(id, name, subject, teacher_id)')
      .eq('student_id', student.id)
      .eq('is_active', true);
    if (error) return;
    const raw = (data ?? []).map((row) => row.batches).filter(Boolean) as unknown as Array<{ id: string; name: string; subject: string | null; teacher_id: string }>;
    const teacherIds = [...new Set(raw.map((batch) => batch.teacher_id))];
    const { data: teachers } = teacherIds.length
      ? await supabase.from('users').select('id, full_name').in('id', teacherIds)
      : { data: [] as Array<{ id: string; full_name: string }> };
    const teacherNames = new Map((teachers ?? []).map((teacher) => [teacher.id, teacher.full_name]));
    setBatches(raw.map((batch) => ({ ...batch, teacherName: teacherNames.get(batch.teacher_id) ?? 'Your teacher' })));
  }, [student]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [load]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setSaving(true);
    const joined = await joinBatch(code);
    setSaving(false);
    if (!joined) { toast.error('Could not join this batch. Check the code and try again.'); return; }
    toast.success(`Joined ${joined.batchName}`);
    setCode('');
    setAdding(false);
    await load();
  };

  const primaryBatch = batches[0];
  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen((value) => !value)} aria-label="Batch status"
        className={`flex items-center gap-2 h-10 transition-colors ${primaryBatch ? 'rounded-full bg-indigo-50 border border-indigo-200 pl-3 pr-4 text-indigo-800 hover:bg-indigo-100' : 'w-10 justify-center rounded-full bg-gray-100 border border-gray-200 text-gray-600 hover:bg-gray-200'}`}>
        <BookOpen className="w-4 h-4" />
        {primaryBatch && <span className="max-w-40 truncate text-sm font-medium">{primaryBatch.name}{batches.length > 1 ? ` +${batches.length - 1}` : ''}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl z-30 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div><p className="font-semibold text-gray-900 text-sm">Your batches</p><p className="text-xs text-gray-500">Classes available to your account</p></div>
            <button className="p-1 text-gray-400 hover:text-gray-700" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          {batches.length === 0 ? (
            <div className="rounded-lg bg-gray-50 text-center py-5 text-sm text-gray-500">No batch joined yet.</div>
          ) : <div className="space-y-2">{batches.map((batch) => (
            <div key={batch.id} className="rounded-lg border border-gray-100 p-3">
              <p className="font-medium text-sm text-gray-900">{batch.name}</p>
              <p className="text-xs text-gray-500 mt-0.5"><Users className="inline w-3 h-3 mr-1" />{batch.teacherName}{batch.subject ? ` · ${batch.subject}` : ''}</p>
            </div>
          ))}</div>}
          {adding ? <form onSubmit={handleJoin} className="mt-3 space-y-2">
            <input autoFocus value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter batch code"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <div className="flex gap-2"><button type="button" onClick={() => setAdding(false)} className="flex-1 py-2 text-sm text-gray-600">Cancel</button><button disabled={saving} className="flex-1 py-2 text-sm rounded-lg bg-indigo-600 text-white disabled:opacity-50">{saving ? 'Joining…' : 'Join'}</button></div>
          </form> : <button onClick={() => setAdding(true)} className="w-full mt-3 py-2.5 rounded-lg border border-dashed border-indigo-300 text-sm text-indigo-700 hover:bg-indigo-50 flex items-center justify-center gap-2"><Plus className="w-4 h-4" />Add another batch</button>}
        </div>
      )}
    </div>
  );
}
