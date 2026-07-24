'use client';
import { useState, useEffect } from 'react';
import {
  Users, Copy, Trash2, Plus, CheckCircle,
  X, Calendar, Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────
interface Batch {
  id: string;
  name: string;
  subject: string | null;
  join_code: string;
  is_active: boolean;
  created_at: string;
  studentCount?: number;
}

interface BatchStudent {
  student_id: string;
  student_code: string;
  name: string;
  joined_at: string;
  batch_id: string;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const BLANK_BATCH_FORM = {
  name: '',
  subject: '',
  selectedDays: [] as number[], // 0=Sun, 1=Mon ... 6=Sat
  classTime: '',
  duration: '1 hour',
  startDate: '',
  endDate: '',
};

// ─── Helpers ─────────────────────────────────────────────────
function generateJoinCode(name: string) {
  const prefix = name.replace(/\s+/g, '').substring(0, 3).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${rand}`;
}

/** Returns all dates between start and end (inclusive) that fall on any of the given day-of-week values */
function getDatesForDays(startDate: string, endDate: string, days: number[]): string[] {
  if (!startDate || !endDate || days.length === 0) return [];
  const dates: string[] = [];
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    if (days.includes(cur.getDay())) {
      dates.push(cur.toISOString().slice(0, 10));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Component ───────────────────────────────────────────────
export default function BatchesPage() {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStudents, setBatchStudents] = useState<BatchStudent[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [showAddBatch, setShowAddBatch] = useState(false);
  const [form, setForm] = useState({ ...BLANK_BATCH_FORM });
  const [saving, setSaving] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);

      // Batches
      const { data: batchData } = await supabase
        .from('batches')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      const withCounts = await Promise.all(
        (batchData ?? []).map(async (b: Batch) => {
          const { data: students } = await supabase.rpc('get_batch_students', { p_batch_id: b.id });
          return {
            ...b,
            studentCount: (students ?? []).length,
          };
        })
      );

      const allStudents: BatchStudent[] = [];
      for (const b of batchData ?? []) {
        const { data: students } = await supabase.rpc('get_batch_students', { p_batch_id: b.id });
        (students ?? []).forEach((s: { student_id: string; student_code: string; name: string; joined_at: string }) => {
          allStudents.push({ ...s, batch_id: b.id });
        });
      }

      setBatches(withCounts);
      setBatchStudents(allStudents);
      setLoading(false);
    }
    load();
  }, [user]);

  // ── Create Batch ───────────────────────────────────────────
  const handleCreateBatch = async () => {
    if (!form.name.trim()) {
      toast.error('Batch name is required.');
      return;
    }
    if (!user) return;
    setSaving(true);

    const joinCode = generateJoinCode(form.name);

    // 1. Insert batch
    const { data: newBatch, error: batchErr } = await supabase
      .from('batches')
      .insert({
        teacher_id: user.id,
        name: form.name.trim(),
        subject: form.subject.trim() || null,
        join_code: joinCode,
        is_active: true,
      })
      .select()
      .single();

    if (batchErr || !newBatch) {
      toast.error('Failed to create batch: ' + batchErr?.message);
      setSaving(false);
      return;
    }

    // 2. If schedule provided, create calendar entries
    if (
      form.classTime &&
      form.startDate &&
      form.endDate &&
      form.selectedDays.length > 0
    ) {
      const dates = getDatesForDays(form.startDate, form.endDate, form.selectedDays);
      if (dates.length > 0) {
        const calRows = dates.map((d) => ({
          teacher_id: user.id,
          batch_name: form.name.trim(),
          subject: form.subject.trim() || form.name.trim(),
          schedule_date: d,
          start_time: form.classTime,
          duration: form.duration || '1 hour',
          type: 'class' as const,
        }));

        const { error: calErr } = await supabase
          .from('calendar_schedules')
          .insert(calRows);

        if (calErr) {
          toast.error('Batch created but calendar sync failed: ' + calErr.message);
        } else {
          toast.success(`Batch created! ${dates.length} class sessions added to Calendar.`);
        }
      }
    } else {
      toast.success('Batch created! Students can join with code: ' + joinCode);
    }

    setBatches((prev) => [{ ...newBatch, studentCount: 0 }, ...prev]);
    setShowAddBatch(false);
    setForm({ ...BLANK_BATCH_FORM });
    setSaving(false);
  };

  // ── Remove Student ─────────────────────────────────────────
  const handleRemoveStudent = async (studentId: string, batchId: string, studentName: string) => {
    if (!confirm(`Remove ${studentName} from this batch?`)) return;
    const { error } = await supabase
      .from('batch_students')
      .update({ is_active: false })
      .eq('student_id', studentId)
      .eq('batch_id', batchId);
    if (error) { toast.error('Failed to remove student.'); return; }
    setBatchStudents((prev) => prev.filter((s) => !(s.student_id === studentId && s.batch_id === batchId)));
    setBatches((prev) => prev.map((b) => b.id === batchId ? { ...b, studentCount: Math.max(0, (b.studentCount ?? 1) - 1) } : b));
    toast.success(`${studentName} removed from batch.`);
  };

  // ── Delete Batch ───────────────────────────────────────────
  const handleDeleteBatch = async (batchId: string, batchName: string) => {
    if (!confirm(`Delete batch "${batchName}"? This will remove all enrollments and calendar entries.`)) return;
    const { error } = await supabase.from('batches').delete().eq('id', batchId);
    if (error) { toast.error('Failed to delete batch.'); return; }
    setBatches((prev) => prev.filter((b) => b.id !== batchId));
    setBatchStudents((prev) => prev.filter((s) => s.batch_id !== batchId));
    toast.success('Batch deleted.');
  };

  // ── Toggle Day ─────────────────────────────────────────────
  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter((d) => d !== day)
        : [...prev.selectedDays, day],
    }));
  };

  // ── Derived data ───────────────────────────────────────────
  const filteredStudents =
    selectedBatch === 'all'
      ? batchStudents
      : batchStudents.filter((s) => s.batch_id === selectedBatch);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-gray-900 text-xl font-semibold">Students &amp; Batches</h2>
          <p className="text-gray-500 text-sm mt-0.5">Manage your batches and enrolled students</p>
        </div>
        <button
          onClick={() => setShowAddBatch(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Batch
        </button>
      </div>

      {/* Batch Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : batches.length === 0 ? (
        <div className="text-center py-14 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-gray-900 font-semibold text-lg mb-1">No batches yet</h3>
          <p className="text-gray-500 text-sm mb-6">Create your first batch to start adding students</p>
          <button
            onClick={() => setShowAddBatch(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> Create Batch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {batches.map((batch) => (
            <div key={batch.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium truncate">{batch.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {batch.subject && <span className="mr-2">{batch.subject}</span>}
                    {batch.studentCount} student{batch.studentCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteBatch(batch.id, batch.name)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete batch"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm font-mono truncate">
                  {batch.join_code}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(batch.join_code);
                    toast.success('Join code copied!');
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Copy join code"
                >
                  <Copy className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student List */}
      {batches.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Filter */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 flex-wrap">
            <h3 className="text-gray-900 font-semibold text-sm">
              Students ({filteredStudents.length})
            </h3>
            <select
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="ml-auto px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider hidden sm:table-cell">Batch</th>
                  <th className="px-4 py-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider hidden md:table-cell">Student ID</th>
                  <th className="px-4 py-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Joined</th>
                  <th className="px-4 py-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.map((student) => {
                  const batchName = batches.find((b) => b.id === student.batch_id)?.name ?? '—';
                  return (
                    <tr key={`${student.batch_id}-${student.student_id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-gray-900 text-sm font-medium">{student.name}</p>
                        <p className="text-gray-500 text-xs sm:hidden">{batchName}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-sm hidden sm:table-cell">{batchName}</td>
                      <td className="px-4 py-3 text-indigo-600 text-sm font-mono hidden md:table-cell">{student.student_code}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(student.joined_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleRemoveStudent(student.student_id, student.batch_id, student.name)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <div className="text-center py-10 text-gray-500 text-sm">
                No students enrolled yet. Share the join code with your students.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create Batch Modal ─────────────────────────────── */}
      {showAddBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
              <div>
                <h3 className="text-gray-900 font-semibold text-base">Create New Batch</h3>
                <p className="text-gray-500 text-xs mt-0.5">Set up a batch with optional recurring class schedule</p>
              </div>
              <button onClick={() => { setShowAddBatch(false); setForm({ ...BLANK_BATCH_FORM }); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Batch Info */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" /> Batch Details
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Batch Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., Batch A - Physics"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                    <input
                      type="text"
                      value={form.subject}
                      onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                      placeholder="e.g., Physics, Mathematics"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" /> Class Schedule
                  <span className="text-xs font-normal text-gray-400">(optional — shows on Calendar)</span>
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  Select recurring class days and they will be automatically added to the Calendar.
                </p>

                {/* Day selector */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(idx)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                        form.selectedDays.includes(idx)
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />Class Time
                    </label>
                    <input
                      type="time"
                      value={form.classTime}
                      onChange={(e) => setForm((p) => ({ ...p, classTime: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration</label>
                    <input
                      type="text"
                      value={form.duration}
                      onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
                      placeholder="e.g., 2 hours"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule From</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule Until</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Preview count */}
                {form.classTime && form.startDate && form.endDate && form.selectedDays.length > 0 && (
                  <p className="text-xs text-indigo-600 mt-2 font-medium">
                    ✓ {getDatesForDays(form.startDate, form.endDate, form.selectedDays).length} class sessions will be added to Calendar
                  </p>
                )}
              </div>

              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                A unique join code will be auto-generated for this batch. Share it with students so they can enroll themselves.
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateBatch}
                  disabled={saving}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {saving ? 'Creating…' : 'Create Batch'}
                </button>
                <button
                  onClick={() => { setShowAddBatch(false); setForm({ ...BLANK_BATCH_FORM }); }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
