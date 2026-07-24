'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Clock,
  BookOpen,
  FileText,
  Users,
  Pencil,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────
interface Schedule {
  id: string;
  teacher_id: string;
  batch_name: string;
  subject: string;
  schedule_date: string; // 'YYYY-MM-DD'
  start_time: string;    // 'HH:MM'
  duration: string;
  type: 'class' | 'exam';
  created_at: string;
}

type ModalMode = 'add' | 'edit';

const BLANK_FORM = {
  batch_name: '',
  subject: '',
  schedule_date: '',
  start_time: '',
  duration: '',
  type: 'class' as 'class' | 'exam',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Helpers ─────────────────────────────────────────────────
function formatTime(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function toLocalDateString(date: Date) {
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ─── Component ───────────────────────────────────────────────
export default function TeacherCalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  // ── Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    async function fetchSchedules() {
      if (!user) return;
      
      const { data, error } = await supabase
        .from('calendar_schedules')
        .select('*')
        .eq('teacher_id', user.id)
        .order('schedule_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) {
        toast.error('Failed to load schedules: ' + error.message);
      } else {
        setSchedules((data as Schedule[]) ?? []);
      }
      setLoading(false);
    }

    fetchSchedules();
  }, [user]);

  // ── Realtime Subscription ──────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('calendar_schedules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_schedules',
          filter: `teacher_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSchedules((prev) => [...prev, payload.new as Schedule]);
          } else if (payload.eventType === 'UPDATE') {
            setSchedules((prev) =>
              prev.map((s) => (s.id === payload.new.id ? (payload.new as Schedule) : s))
            );
          } else if (payload.eventType === 'DELETE') {
            setSchedules((prev) => prev.filter((s) => s.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // ── Calendar helpers ───────────────────────────────────────
  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate();
  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay();

  const previousMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const getSchedulesForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.filter((s) => s.schedule_date === dateStr);
  };

  const todaySchedules = schedules.filter((s) => s.schedule_date === todayStr);
  const todayClasses = todaySchedules.filter((s) => s.type === 'class');
  const todayExams = todaySchedules.filter((s) => s.type === 'exam');
  const todayBatches = [...new Set(todaySchedules.map((s) => s.batch_name))];

  // ── Modal helpers ──────────────────────────────────────────
  const openAddModal = () => {
    setModalMode('add');
    setEditingId(null);
    setForm({ ...BLANK_FORM });
    setShowModal(true);
  };

  const openEditModal = (s: Schedule) => {
    setModalMode('edit');
    setEditingId(s.id);
    setForm({
      batch_name: s.batch_name,
      subject: s.subject,
      schedule_date: s.schedule_date,
      start_time: s.start_time.slice(0, 5),
      duration: s.duration,
      type: s.type,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...BLANK_FORM });
  };

  // ── Save (Add / Edit) ──────────────────────────────────────
  const handleSave = async () => {
    if (!form.batch_name || !form.subject || !form.schedule_date || !form.start_time) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (!user) return;
    setSaving(true);

    if (modalMode === 'add') {
      const { error } = await supabase.from('calendar_schedules').insert({
        teacher_id: user.id,
        batch_name: form.batch_name,
        subject: form.subject,
        schedule_date: form.schedule_date,
        start_time: form.start_time,
        duration: form.duration || '1 hour',
        type: form.type,
      });
      if (error) toast.error('Failed to add: ' + error.message);
      else toast.success('Schedule added!');
    } else {
      const { error } = await supabase
        .from('calendar_schedules')
        .update({
          batch_name: form.batch_name,
          subject: form.subject,
          schedule_date: form.schedule_date,
          start_time: form.start_time,
          duration: form.duration || '1 hour',
          type: form.type,
        })
        .eq('id', editingId!);
      if (error) toast.error('Failed to update: ' + error.message);
      else toast.success('Schedule updated!');
    }

    setSaving(false);
    closeModal();
  };

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    const { error } = await supabase
      .from('calendar_schedules')
      .delete()
      .eq('id', id);
    if (error) toast.error('Failed to delete: ' + error.message);
    else toast.success('Schedule deleted.');
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-gray-900 text-xl font-semibold">Class Schedule</h2>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Schedule
        </button>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        {/* Month Nav */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-gray-900 font-semibold">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          <div className="flex gap-2">
            <button onClick={previousMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center text-gray-600 py-2 text-xs sm:text-sm">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}

          {/* Empty cells */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = index + 1;
            const dayStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const daySchedules = getSchedulesForDay(day);
            const isToday = dayStr === todayStr;

            return (
              <div
                key={day}
                className={`aspect-square border rounded-lg p-1 sm:p-2 ${
                  isToday
                    ? 'bg-indigo-50 border-indigo-300'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div
                  className={`text-center mb-1 text-xs sm:text-sm font-medium ${
                    isToday ? 'text-indigo-600' : 'text-gray-900'
                  }`}
                >
                  {day}
                </div>
                {daySchedules.length > 0 && (
                  <div className="space-y-0.5">
                    {daySchedules.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className={`text-xs px-1 py-0.5 rounded truncate hidden sm:block cursor-pointer ${
                          s.type === 'exam'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-indigo-100 text-indigo-700'
                        }`}
                        title={`${s.batch_name} - ${formatTime(s.start_time)}`}
                        onClick={() => openEditModal(s)}
                      >
                        {s.subject.length > 8 ? s.subject.substring(0, 8) + '...' : s.subject}
                      </div>
                    ))}
                    <div
                      className={`w-1.5 h-1.5 rounded-full mx-auto sm:hidden ${
                        daySchedules.some((s) => s.type === 'exam')
                          ? 'bg-red-500'
                          : 'bg-indigo-500'
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Today's Quick Reminder */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center gap-2">
          <Clock className="w-5 h-5 text-white" />
          <h3 className="text-white font-semibold">Today&apos;s Quick Reminder</h3>
          <span className="ml-auto text-indigo-200 text-sm">
            {toLocalDateString(today)}
          </span>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading…</div>
        ) : todaySchedules.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p>No classes or exams scheduled for today</p>
          </div>
        ) : (
          <div className="p-4 sm:p-6 space-y-4">
            {/* Active Batches */}
            {todayBatches.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <p className="text-gray-700 text-sm font-medium">Active Batches Today</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {todayBatches.map((b, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Classes */}
            {todayClasses.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-green-600" />
                  <p className="text-gray-700 text-sm font-medium">Classes Today</p>
                </div>
                <div className="space-y-2">
                  {todayClasses.map((cls) => (
                    <div
                      key={cls.id}
                      className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg group"
                    >
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                        <Clock className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-medium truncate">{cls.subject}</p>
                        <p className="text-gray-600 text-sm truncate">{cls.batch_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-green-700 text-sm">{formatTime(cls.start_time)}</p>
                        <p className="text-gray-500 text-xs">{cls.duration}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEditModal(cls)}
                          className="p-1 hover:bg-green-200 rounded text-green-700"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(cls.id)}
                          className="p-1 hover:bg-red-100 rounded text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exams */}
            {todayExams.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-red-600" />
                  <p className="text-gray-700 text-sm font-medium">Exams Today</p>
                </div>
                <div className="space-y-2">
                  {todayExams.map((exam) => (
                    <div
                      key={exam.id}
                      className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg group"
                    >
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-medium truncate">{exam.subject}</p>
                        <p className="text-gray-600 text-sm truncate">{exam.batch_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-red-700 text-sm">{formatTime(exam.start_time)}</p>
                        <p className="text-gray-500 text-xs">{exam.duration}</p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => openEditModal(exam)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(exam.id)}
                          className="p-1 hover:bg-red-200 rounded text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 font-semibold">
                {modalMode === 'add' ? 'Add Schedule' : 'Edit Schedule'}
              </h3>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type toggle */}
              <div>
                <label className="block text-sm text-gray-700 mb-1 font-medium">Type</label>
                <div className="flex gap-2">
                  {(['class', 'exam'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm({ ...form, type: t })}
                      className={`flex-1 py-2 rounded-lg border-2 capitalize text-sm font-medium transition-colors ${
                        form.type === t
                          ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                          : 'border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Batch */}
              <div>
                <label className="block text-sm text-gray-700 mb-1 font-medium">Batch Name</label>
                <input
                  type="text"
                  value={form.batch_name}
                  onChange={(e) => setForm({ ...form, batch_name: e.target.value })}
                  placeholder="e.g., Batch A - Physics"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm text-gray-700 mb-1 font-medium">
                  Subject / Title
                </label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g., Quantum Mechanics"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Time + Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1 font-medium">Time</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1 font-medium">Duration</label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) => setForm({ ...form, duration: e.target.value })}
                    placeholder="e.g., 2 hours"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-gray-700 mb-1 font-medium">Date</label>
                <input
                  type="date"
                  value={form.schedule_date}
                  onChange={(e) => setForm({ ...form, schedule_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {saving
                  ? 'Saving…'
                  : modalMode === 'add'
                  ? 'Add Schedule'
                  : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
