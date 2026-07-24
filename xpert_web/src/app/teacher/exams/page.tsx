'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, BookOpen, Clock, Calendar, ChevronRight, ChevronLeft,
  Check, X, Trash2, Edit2, Copy, Key, Eye, MoreVertical,
  Archive, RotateCcw, Users, Settings,
  AlertTriangle, ChevronDown, Save, Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, Batch, Exam } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  QuestionPaperBuilder, blankQuestion, questionsToPaperItems, getQuestionsFromItems,
  type PaperItem, type SectionItem,
} from '@/app/components/teacher/QuestionPaperBuilder';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExamStatus = 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';

interface ExamDetails {
  title: string;
  subject: string;
  batch_ids: string[];
  duration_minutes: number;
  scheduled_date: string;
  scheduled_time: string;
  is_instant: boolean;
  allow_pyq: boolean;
  no_reverse_back: boolean;
  per_question_time_enabled: boolean;
  per_question_time_seconds: number;
}

type Step = 'details' | 'questions';
type ActiveModal = null | 'settings' | 'preview' | 'confirm-delete' | 'regen-key';

interface ExamRow extends Exam {
  questionCount?: number;
  hasAttempts?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BLANK_DETAILS: ExamDetails = {
  title: '', subject: '', batch_ids: [], duration_minutes: 60,
  scheduled_date: '', scheduled_time: '', is_instant: false, allow_pyq: false,
  no_reverse_back: false, per_question_time_enabled: false, per_question_time_seconds: 60,
};

const INITIAL_PAPER: PaperItem[] = [blankQuestion('mcq', null)];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  return 'EXM' + Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function statusBadge(status: ExamStatus | undefined): { label: string; className: string } {
  switch (status) {
    case 'scheduled': return { label: 'Scheduled', className: 'bg-indigo-100 text-indigo-700' };
    case 'active':    return { label: 'Active',    className: 'bg-green-100 text-green-700' };
    case 'completed': return { label: 'Completed', className: 'bg-purple-100 text-purple-700' };
    case 'archived':  return { label: 'Archived',  className: 'bg-gray-100 text-gray-500' };
    default:          return { label: 'Draft',     className: 'bg-gray-100 text-gray-600' };
  }
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: 'details', label: 'Exam Details' },
    { id: 'questions', label: 'Add Questions' },
  ];
  const current = steps.findIndex((s) => s.id === step);
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
              ${i < current ? 'bg-indigo-600 text-white' : i === current ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i < current ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === current ? 'text-gray-900' : i < current ? 'text-indigo-600' : 'text-gray-400'}`}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 h-0.5 mx-3 ${i < current ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Multi-Batch Selector ─────────────────────────────────────────────────────

function BatchSelector({
  batches, selected, onChange,
}: { batches: Batch[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const selectedBatches = batches.filter((b) => selected.includes(b.id));

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-400 transition-colors"
      >
        <span className="flex-1 text-left truncate">
          {selectedBatches.length === 0
            ? <span className="text-gray-400">Select batches…</span>
            : selectedBatches.map((b) => b.name).join(', ')}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 ml-2 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Selected chips */}
      {selectedBatches.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedBatches.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
              {b.name}
              <button onClick={() => toggle(b.id)} className="hover:text-indigo-900">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
          {batches.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-500">
              No batches. <a href="/teacher/batches" className="underline text-indigo-600">Create one first.</a>
            </p>
          ) : (
            batches.map((b) => (
              <label key={b.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(b.id)}
                  onChange={() => toggle(b.id)}
                  className="w-4 h-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-900">{b.name}</span>
                {b.subject && <span className="text-xs text-gray-400 ml-auto">{b.subject}</span>}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Image Upload Helper ──────────────────────────────────────────────────────

async function uploadImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `exam-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('exam-images').upload(path, file, { upsert: true });
  if (error) { toast.error('Image upload failed: ' + error.message); return null; }
  const { data } = supabase.storage.from('exam-images').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Exam Action Menu ─────────────────────────────────────────────────────────

function ExamActionMenu({
  exam, hasAttempts,
  onEdit, onSettings, onPreview, onDuplicate, onRegenKey, onViewResults, onArchive, onDelete,
}: {
  exam: ExamRow; hasAttempts: boolean;
  onEdit: () => void; onSettings: () => void; onPreview: () => void;
  onDuplicate: () => void; onRegenKey: () => void; onViewResults: () => void;
  onArchive: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const actions = [
    { icon: Edit2, label: 'Edit', onClick: onEdit },
    { icon: Settings, label: 'Update Settings', onClick: onSettings },
    { icon: Eye, label: 'Preview', onClick: onPreview },
    { icon: Copy, label: 'Duplicate', onClick: onDuplicate },
    { icon: Key, label: exam.exam_key ? 'Regenerate Key & PIN' : 'Generate Key & PIN', onClick: onRegenKey },
    { icon: BookOpen, label: 'View Results', onClick: onViewResults },
    { icon: Archive, label: exam.status === 'archived' ? 'Unarchive' : 'Archive', onClick: onArchive },
    { icon: Trash2, label: 'Delete', onClick: onDelete, danger: true },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1 text-sm">
          {actions.map(({ icon: Icon, label, onClick, danger }) => (
            <button
              key={label}
              onClick={() => { setOpen(false); onClick(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left
                ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Update Settings Modal ────────────────────────────────────────────────────

function UpdateSettingsModal({
  exam, batches, onSave, onClose,
}: {
  exam: ExamRow; batches: Batch[];
  onSave: (updates: Partial<ExamDetails>) => Promise<void>;
  onClose: () => void;
}) {
  const scheduled = exam.scheduled_at ? new Date(exam.scheduled_at) : null;
  const [form, setForm] = useState({
    title: exam.title,
    subject: exam.subject ?? '',
    batch_ids: exam.batch_ids ?? (exam.batch_id ? [exam.batch_id] : []),
    duration_minutes: exam.duration_minutes,
    scheduled_date: scheduled ? scheduled.toISOString().slice(0, 10) : '',
    scheduled_time: scheduled ? scheduled.toTimeString().slice(0, 5) : '',
    allow_pyq: exam.allow_pyq ?? false,
    no_reverse_back: exam.no_reverse_back ?? false,
    per_question_time_enabled: !!(exam.per_question_time_seconds),
    per_question_time_seconds: exam.per_question_time_seconds ?? 60,
  });
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-gray-900">Update Exam Settings</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
            <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
            <input value={form.subject} onChange={(e) => setForm(p => ({ ...p, subject: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Batches</label>
            <BatchSelector batches={batches} selected={form.batch_ids} onChange={(ids) => setForm(p => ({ ...p, batch_ids: ids }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (min)</label>
              <input type="number" min={5} max={300} value={form.duration_minutes}
                onChange={(e) => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input type="date" value={form.scheduled_date}
                onChange={(e) => setForm(p => ({ ...p, scheduled_date: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
            <input type="time" value={form.scheduled_time}
              onChange={(e) => setForm(p => ({ ...p, scheduled_time: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {/* Toggles */}
          <div className="space-y-3 pt-1">
            {[
              { key: 'allow_pyq', label: 'Allow PYQ Practice', desc: 'Students can practice in PYQ section' },
              { key: 'no_reverse_back', label: 'No Reverse Back', desc: 'Students cannot return to previous questions' },
            ].map(({ key, label, desc }) => (
              <label key={key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
                <button onClick={() => setForm(p => ({ ...p, [key]: !(p as Record<string, unknown>)[key] }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(form as Record<string, unknown>)[key] ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${(form as Record<string, unknown>)[key] ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </label>
            ))}
            <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <div>
                <p className="text-sm font-medium text-gray-900">Per Question Timer</p>
                <p className="text-xs text-gray-500">Auto-advance on timeout</p>
              </div>
              <button onClick={() => setForm(p => ({ ...p, per_question_time_enabled: !p.per_question_time_enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.per_question_time_enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.per_question_time_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>
            {form.per_question_time_enabled && (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                <label className="text-sm text-gray-700 whitespace-nowrap font-medium">Seconds per question:</label>
                <input type="number" min={10} max={600} value={form.per_question_time_seconds}
                  onChange={(e) => setForm(p => ({ ...p, per_question_time_seconds: parseInt(e.target.value) || 60 }))}
                  className="w-24 px-2 py-1.5 border border-indigo-300 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            disabled={saving}
            onClick={async () => { setSaving(true); await onSave(form as unknown as Partial<ExamDetails>); setSaving(false); }}
            className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TeacherExamsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [details, setDetails] = useState<ExamDetails>(BLANK_DETAILS);
  const [savedExamId, setSavedExamId] = useState<string | null>(null);
  const [paperItems, setPaperItems] = useState<PaperItem[]>(INITIAL_PAPER);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [questionsDirty, setQuestionsDirty] = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeExam, setActiveExam] = useState<ExamRow | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchExams = useCallback(async () => {
    if (!user) return;
    setLoadingExams(true);
    const { data } = await supabase
      .from('exams')
      .select('*, batches(*)')
      .eq('teacher_id', user.id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });

    if (data) {
      const withCounts = await Promise.all(
        data.map(async (exam) => {
          const [{ count: qCount }, { count: aCount }] = await Promise.all([
            supabase.from('questions').select('*', { count: 'exact', head: true }).eq('exam_id', exam.id),
            supabase.from('exam_submissions').select('*', { count: 'exact', head: true }).eq('exam_id', exam.id),
          ]);
          return { ...exam, questionCount: qCount ?? 0, hasAttempts: (aCount ?? 0) > 0 };
        })
      );
      setExams(withCounts);
    }
    setLoadingExams(false);
  }, [user]);

  const fetchBatches = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('batches').select('*').eq('teacher_id', user.id);
    setBatches(data ?? []);
  }, [user]);

  useEffect(() => {
    void (async () => { await fetchExams(); await fetchBatches(); })();
  }, [fetchExams, fetchBatches]);

  // ── Exam Details Save ──────────────────────────────────────────────────────

  const handleSaveExamDetails = async () => {
    if (!user) return;
    const needsSchedule = !details.is_instant;
    if (!details.title.trim() || !details.subject.trim() || details.batch_ids.length === 0) {
      toast.error('Please fill title, subject, and select at least one batch.');
      return;
    }
    if (needsSchedule && (!details.scheduled_date || !details.scheduled_time)) {
      toast.error('Please set scheduled date and time, or enable Instant Exam.');
      return;
    }
    const now = new Date();
    const scheduled_at = details.is_instant
      ? now.toISOString()
      : new Date(`${details.scheduled_date}T${details.scheduled_time}`).toISOString();
    const instant_expires_at = details.is_instant
      ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
      : null;
    const payload = {
      teacher_id: user.id,
      batch_id: details.batch_ids[0],
      batch_ids: details.batch_ids,
      title: details.title,
      subject: details.subject,
      duration_minutes: details.duration_minutes,
      total_marks: 0,
      scheduled_at,
      is_instant: details.is_instant,
      instant_expires_at,
      allow_pyq: details.allow_pyq,
      no_reverse_back: details.no_reverse_back,
      per_question_time_seconds: details.per_question_time_enabled ? details.per_question_time_seconds : null,
      negative_marking: false,
      negative_marks_per_wrong: 0,
      is_published: false,
      status: 'draft',
    };

    if (editingExamId) {
      const { error } = await supabase.from('exams').update(payload).eq('id', editingExamId);
      if (error) { toast.error('Failed to update: ' + error.message); return; }
      setSavedExamId(editingExamId);
    } else {
      const { data, error } = await supabase.from('exams').insert(payload).select().single();
      if (error || !data) { toast.error('Failed to create exam: ' + error?.message); return; }
      setSavedExamId(data.id);
    }
    setStep('questions');
    toast.success('Exam details saved! Now add questions.');
  };

  // ── Question Load (for edit) ───────────────────────────────────────────────

  const loadQuestionsForExam = async (examId: string) => {
    const { data } = await supabase.from('questions').select('*').eq('exam_id', examId).order('order_index');
    if (!data || data.length === 0) {
      setPaperItems(INITIAL_PAPER);
    } else {
      setPaperItems(questionsToPaperItems(data));
    }
    setQuestionsDirty(false);
  };

  const handlePaperChange = (items: PaperItem[]) => {
    setPaperItems(items);
    setQuestionsDirty(true);
  };

  const handleSaveAllQuestions = async (): Promise<boolean> => {
    if (!savedExamId) return false;
    const questions = getQuestionsFromItems(paperItems);
    if (questions.length === 0) {
      toast.error('Add at least one question.');
      return false;
    }
    for (const q of questions) {
      if (!q.question_text.trim() && !q.question_image) {
        toast.error('Each question needs text or an image.');
        return false;
      }
    }

    setSavingQuestions(true);
    try {
      const sectionTitleMap = new Map<string, string>();
      for (const item of paperItems) {
        if (item.itemType === 'section') sectionTitleMap.set(item.id, (item as SectionItem).title);
      }

      const existingIds = questions.filter((q) => q.dbId).map((q) => q.dbId!);
      const { data: dbQuestions } = await supabase.from('questions').select('id').eq('exam_id', savedExamId);
      const toDelete = (dbQuestions ?? []).map((r) => r.id).filter((id) => !existingIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('questions').delete().in('id', toDelete);
      }

      let orderIndex = 0;
      for (const q of questions) {
        const sectionTitle = q.sectionId ? sectionTitleMap.get(q.sectionId) ?? null : null;
        const optionTexts = q.options.map((o) => o.text);
        const optionImages = q.options.map((o) => o.imageUrl);
        const payload = {
          exam_id: savedExamId,
          question_text: q.question_text,
          question_image: q.question_image,
          question_type: q.question_type,
          options: q.question_type === 'mcq' ? optionTexts : null,
          option_images: q.question_type === 'mcq' ? optionImages : null,
          correct_answer: q.correct_answer || null,
          marks: q.positive_marks,
          positive_marks: q.positive_marks,
          negative_marks: q.negative_marks,
          chapter_tag: null,
          difficulty: q.difficulty,
          is_pyq: q.is_pyq,
          section_title: sectionTitle,
          order_index: orderIndex++,
        };

        if (q.dbId) {
          const { error } = await supabase.from('questions').update(payload).eq('id', q.dbId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('questions').insert(payload).select('id').single();
          if (error || !data) throw error ?? new Error('Insert failed');
          q.dbId = data.id;
        }
      }

      const totalMarks = questions.reduce((s, q) => s + q.positive_marks, 0);
      await supabase.from('exams').update({ total_marks: totalMarks }).eq('id', savedExamId);

      setPaperItems([...paperItems]);
      setQuestionsDirty(false);
      toast.success('Questions saved!');
      return true;
    } catch (err) {
      toast.error('Failed to save questions: ' + (err instanceof Error ? err.message : 'Unknown error'));
      return false;
    } finally {
      setSavingQuestions(false);
    }
  };

  // ── Generate Key ───────────────────────────────────────────────────────────

  const handleGenerateKey = async (examId: string): Promise<{ key: string; pin: string } | null> => {
    const key = generateKey();
    const pin = generatePin();
    const questions = getQuestionsFromItems(paperItems);
    const totalMarks = questions.reduce((s, q) => s + q.positive_marks, 0);
    const instantExpires = details.is_instant
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : null;
    const updatePayload: Record<string, unknown> = {
      exam_key: key,
      exam_pin: pin,
      status: details.is_instant ? 'active' : 'scheduled',
      is_published: true,
      total_marks: totalMarks,
      is_instant: details.is_instant,
      instant_expires_at: instantExpires,
    };
    if (details.is_instant) {
      updatePayload.scheduled_at = new Date().toISOString();
    }
    const { error } = await supabase.from('exams').update(updatePayload).eq('id', examId);
    if (error) { toast.error('Failed to generate key: ' + error.message); return null; }
    return { key, pin };
  };

  const handleSaveAndGenerateKey = async () => {
    if (!savedExamId) return;
    const saved = await handleSaveAllQuestions();
    if (!saved) return;
    const questions = getQuestionsFromItems(paperItems);
    if (questions.length === 0) {
      toast.error('Add at least one question before generating the key.');
      return;
    }
    const result = await handleGenerateKey(savedExamId);
    if (!result) return;
    toast.success(
      details.is_instant
        ? `Instant Exam live! Key: ${result.key} · PIN: ${result.pin} · 60 min join window`
        : `Exam Key: ${result.key} · PIN: ${result.pin}`
    );
    setCreating(false);
    setEditingExamId(null);
    setSavedExamId(null);
    setStep('details');
    setPaperItems(INITIAL_PAPER);
    setDetails(BLANK_DETAILS);
    fetchExams();
  };

  // ── Dashboard Actions ──────────────────────────────────────────────────────

  const handleEditExam = async (exam: ExamRow) => {
    const scheduled = exam.scheduled_at ? new Date(exam.scheduled_at) : null;
    setDetails({
      title: exam.title,
      subject: exam.subject ?? '',
      batch_ids: exam.batch_ids ?? (exam.batch_id ? [exam.batch_id] : []),
      duration_minutes: exam.duration_minutes,
      scheduled_date: scheduled ? scheduled.toISOString().slice(0, 10) : '',
      scheduled_time: scheduled ? scheduled.toTimeString().slice(0, 5) : '',
      is_instant: (exam as ExamRow & { is_instant?: boolean }).is_instant ?? false,
      allow_pyq: exam.allow_pyq ?? false,
      no_reverse_back: exam.no_reverse_back ?? false,
      per_question_time_enabled: !!(exam.per_question_time_seconds),
      per_question_time_seconds: exam.per_question_time_seconds ?? 60,
    });
    setSavedExamId(exam.id);
    setEditingExamId(exam.id);
    await loadQuestionsForExam(exam.id);
    setStep('questions');
    setCreating(true);
  };

  const handleDuplicate = async (exam: ExamRow) => {
    if (!user) return;
    const { data: newExam, error: examErr } = await supabase.from('exams').insert({
      teacher_id: user.id,
      batch_id: exam.batch_id,
      batch_ids: exam.batch_ids,
      title: `${exam.title} (Copy)`,
      subject: exam.subject,
      duration_minutes: exam.duration_minutes,
      total_marks: 0,
      scheduled_at: exam.scheduled_at,
      allow_pyq: exam.allow_pyq,
      no_reverse_back: exam.no_reverse_back,
      per_question_time_seconds: exam.per_question_time_seconds,
      negative_marking: false,
      negative_marks_per_wrong: 0,
      is_published: false,
      status: 'draft',
    }).select().single();
    if (examErr || !newExam) { toast.error('Duplicate failed'); return; }

    const { data: srcQuestions } = await supabase.from('questions').select('*').eq('exam_id', exam.id).order('order_index');
    if (srcQuestions && srcQuestions.length > 0) {
      await supabase.from('questions').insert(
        srcQuestions.map(({ id: _id, ...q }) => ({ ...q, exam_id: newExam.id }))
      );
    }
    toast.success('Exam duplicated!');
    fetchExams();
  };

  const handleArchive = async (exam: ExamRow) => {
    const newStatus = exam.status === 'archived' ? 'draft' : 'archived';
    const { error } = await supabase.from('exams').update({ status: newStatus }).eq('id', exam.id);
    if (error) { toast.error('Failed'); return; }
    toast.success(newStatus === 'archived' ? 'Exam archived.' : 'Exam restored.');
    fetchExams();
  };

  const handleDelete = async (exam: ExamRow) => {
    await supabase.from('questions').delete().eq('exam_id', exam.id);
    const { error } = await supabase.from('exams').delete().eq('id', exam.id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Exam deleted.');
    setActiveModal(null);
    setActiveExam(null);
    fetchExams();
  };

  const handleUpdateSettings = async (updates: Partial<ExamDetails>) => {
    if (!activeExam) return;
    const u = updates as ExamDetails;
    const scheduled_at = u.scheduled_date && u.scheduled_time
      ? new Date(`${u.scheduled_date}T${u.scheduled_time}`).toISOString()
      : activeExam.scheduled_at;
    const { error } = await supabase.from('exams').update({
      title: u.title,
      subject: u.subject,
      batch_id: u.batch_ids?.[0] ?? activeExam.batch_id,
      batch_ids: u.batch_ids,
      duration_minutes: u.duration_minutes,
      scheduled_at,
      allow_pyq: u.allow_pyq,
      no_reverse_back: u.no_reverse_back,
      per_question_time_seconds: u.per_question_time_enabled ? u.per_question_time_seconds : null,
    }).eq('id', activeExam.id);
    if (error) { toast.error('Update failed: ' + error.message); return; }
    toast.success('Settings updated!');
    setActiveModal(null);
    setActiveExam(null);
    fetchExams();
  };

  const startCreating = () => {
    setDetails(BLANK_DETAILS);
    setPaperItems(INITIAL_PAPER);
    setSavedExamId(null);
    setEditingExamId(null);
    setStep('details');
    setQuestionsDirty(false);
    setCreating(true);
  };

  const cancel = () => {
    if (savedExamId && !editingExamId) {
      supabase.from('exams').delete().eq('id', savedExamId).then(() => {});
    }
    setCreating(false);
    setEditingExamId(null);
    setSavedExamId(null);
    setStep('details');
    setPaperItems(INITIAL_PAPER);
    setDetails(BLANK_DETAILS);
    setQuestionsDirty(false);
  };

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setUploadingImg(true);
    const url = await uploadImage(file);
    setUploadingImg(false);
    return url;
  };

  // ─── Create / Edit Mode ────────────────────────────────────────────────────

  if (creating) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-gray-900 text-xl font-semibold">
              {editingExamId ? 'Edit Exam' : 'Create New Exam'}
            </h2>
            <p className="text-gray-500 text-sm mt-0.5">Build and schedule your question paper</p>
          </div>
          <button onClick={cancel} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <StepIndicator step={step} />

        {/* ── Step 1: Exam Details ── */}
        {step === 'details' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-gray-900 font-semibold text-base">Exam Details</h3>
              <p className="text-gray-500 text-sm mt-0.5">Set up the basic information for this exam</p>
            </div>
            <div className="p-6 space-y-5">
              {/* Title + Subject */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Title <span className="text-red-500">*</span></label>
                  <input type="text" value={details.title}
                    onChange={(e) => setDetails((p) => ({ ...p, title: e.target.value }))}
                    placeholder="e.g., Physics Mid-Term Test"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject <span className="text-red-500">*</span></label>
                  <input type="text" value={details.subject}
                    onChange={(e) => setDetails((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="e.g., Physics"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {/* Batch + Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Batches <span className="text-red-500">*</span></label>
                  <BatchSelector batches={batches} selected={details.batch_ids}
                    onChange={(ids) => setDetails((p) => ({ ...p, batch_ids: ids }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (minutes)</label>
                  <input type="number" min={5} max={300} value={details.duration_minutes}
                    onChange={(e) => setDetails((p) => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              {/* Instant vs Scheduled */}
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 rounded-xl border-2 border-green-200 bg-green-50 cursor-pointer hover:bg-green-100/80 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Play className="w-4 h-4 text-green-600" /> Instant Exam
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">Skip schedule — students can join immediately for 60 minutes after you publish</p>
                  </div>
                  <button type="button"
                    onClick={() => setDetails((p) => ({ ...p, is_instant: !p.is_instant }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${details.is_instant ? 'bg-green-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${details.is_instant ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </label>
              </div>
              {/* Date + Time (hidden for instant) */}
              {!details.is_instant && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Scheduled Date <span className="text-red-500">*</span></label>
                  <input type="date" value={details.scheduled_date}
                    onChange={(e) => setDetails((p) => ({ ...p, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Scheduled Time <span className="text-red-500">*</span></label>
                  <input type="time" value={details.scheduled_time}
                    onChange={(e) => setDetails((p) => ({ ...p, scheduled_time: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              )}
              {/* Exam Rules */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Exam Rules</h4>
                <div className="space-y-2">
                  {/* Allow PYQ */}
                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Allow PYQ Practice</p>
                      <p className="text-xs text-gray-500">Students can practice in PYQ section</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetails((p) => ({ ...p, allow_pyq: !p.allow_pyq }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${details.allow_pyq ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${details.allow_pyq ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </label>
                  {/* No Reverse Back */}
                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">No Reverse Back</p>
                      <p className="text-xs text-gray-500">Students cannot return to a previous question</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetails((p) => ({ ...p, no_reverse_back: !p.no_reverse_back }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${details.no_reverse_back ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${details.no_reverse_back ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </label>
                  {/* Per Question Timer */}
                  <label className="flex items-center justify-between p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Per Question Timer</p>
                      <p className="text-xs text-gray-500">Auto-advance to next question on timeout</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetails((p) => ({ ...p, per_question_time_enabled: !p.per_question_time_enabled }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${details.per_question_time_enabled ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${details.per_question_time_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </label>
                  {details.per_question_time_enabled && (
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-lg ml-3">
                      <label className="text-sm text-gray-700 whitespace-nowrap font-medium">Seconds per question:</label>
                      <input type="number" min={10} max={600} value={details.per_question_time_seconds}
                        onChange={(e) => setDetails((p) => ({ ...p, per_question_time_seconds: parseInt(e.target.value) || 60 }))}
                        className="w-24 px-2 py-1.5 border border-indigo-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400 font-semibold" />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button onClick={cancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
              <button onClick={handleSaveExamDetails}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                Next: Add Questions <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Questions ── */}
        {step === 'questions' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-gray-900 font-semibold text-lg">
                    {details.title || 'Question Paper'}
                    {details.subject && <span className="text-indigo-600 font-normal text-sm ml-2">— {details.subject}</span>}
                  </h3>
                  <p className="text-gray-500 text-sm mt-0.5">Add sections and multiple questions — save when ready</p>
                </div>
                {questionsDirty && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">Unsaved changes</span>
                )}
              </div>
              <div className="p-4">
                <QuestionPaperBuilder
                  items={paperItems}
                  onChange={handlePaperChange}
                  onUploadImage={handleUploadImage}
                  uploading={uploadingImg}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
              <button onClick={async () => {
                if (questionsDirty) {
                  const ok = await handleSaveAllQuestions();
                  if (!ok) return;
                }
                setStep('details');
              }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <div className="flex items-center gap-2">
                <button onClick={handleSaveAllQuestions} disabled={savingQuestions}
                  className="flex items-center gap-2 px-5 py-2.5 border border-indigo-300 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-50 disabled:opacity-50 transition-colors">
                  <Save className="w-4 h-4" /> {savingQuestions ? 'Saving…' : 'Save Questions'}
                </button>
                <button onClick={handleSaveAndGenerateKey}
                  disabled={getQuestionsFromItems(paperItems).length === 0 || savingQuestions}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Key className="w-4 h-4" /> {details.is_instant ? 'Publish Instant Exam' : 'Save & Generate Key'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-gray-900 text-xl font-semibold">Exams</h2>
          <p className="text-gray-500 text-sm mt-0.5">Manage question papers, keys, and share links</p>
        </div>
        <button onClick={startCreating}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> New Exam
        </button>
      </div>

      {loadingExams ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-gray-900 font-semibold text-lg mb-1">No exams yet</h3>
          <p className="text-gray-500 text-sm mb-6">Create your first exam to share with students</p>
          <button onClick={startCreating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" /> Create Exam
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => {
            const badge = statusBadge(exam.status as ExamStatus);
            const batchNames = (() => {
              // Try to get from joins or batch_ids — show as many as possible
              if (exam.batches) return exam.batches.name;
              return `${exam.batch_ids?.length ?? 1} batch${(exam.batch_ids?.length ?? 1) !== 1 ? 'es' : ''}`;
            })();

            return (
              <div key={exam.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                {/* Top row */}
                <div className="p-5 pb-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-semibold text-gray-900 text-base">{exam.title}</h3>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${badge.className}`}>{badge.label}</span>
                        {(exam as ExamRow & { is_instant?: boolean }).is_instant && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-green-100 text-green-700 border border-green-200">Instant</span>
                        )}
                        {exam.allow_pyq && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">PYQ</span>
                        )}
                        {exam.hasAttempts && (
                          <span className="text-xs px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-600 border border-blue-200 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Attempts
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" />{exam.subject}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{exam.duration_minutes} mins</span>
                        {exam.scheduled_at && (
                          <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />{new Date(exam.scheduled_at).toLocaleString()}</span>
                        )}
                        <span className="text-gray-700 font-medium">{exam.questionCount} Questions · {exam.total_marks} marks</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{batchNames}</span>
                      </div>
                    </div>
                    {/* Action menu */}
                    <ExamActionMenu
                      exam={exam}
                      hasAttempts={exam.hasAttempts ?? false}
                      onEdit={() => handleEditExam(exam)}
                      onSettings={() => { setActiveExam(exam); setActiveModal('settings'); }}
                      onPreview={() => { setActiveExam(exam); setActiveModal('preview'); }}
                      onDuplicate={() => handleDuplicate(exam)}
                      onRegenKey={() => { setActiveExam(exam); setActiveModal('regen-key'); }}
                      onViewResults={() => window.location.href = `/teacher/results?exam=${exam.id}`}
                      onArchive={() => handleArchive(exam)}
                      onDelete={() => { setActiveExam(exam); setActiveModal('confirm-delete'); }}
                    />
                  </div>
                </div>

                {/* Key & PIN zone */}
                {exam.exam_key && (
                  <div className="mx-5 mb-5 rounded-lg bg-gray-50 border border-gray-200 divide-y divide-gray-200 overflow-hidden">
                    {[
                      { label: 'Exam Key', value: exam.exam_key, icon: Key },
                      { label: 'PIN', value: exam.exam_pin ?? '—', icon: Key },
                    ].map(({ label, value, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                        <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="text-xs text-gray-500 w-20 shrink-0">{label}:</span>
                        <span className="text-sm font-mono font-semibold text-indigo-700 flex-1">{value}</span>
                        <button
                          onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copied!`); }}
                          className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-colors"
                          title={`Copy ${label}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* No key yet — show generate option inline */}
                {!exam.exam_key && (
                  <div className="mx-5 mb-5">
                    <button
                      onClick={async () => {
                        // load questions count to compute total marks
                        const { data: qs } = await supabase.from('questions').select('positive_marks, marks').eq('exam_id', exam.id);
                        const totalMarks = (qs ?? []).reduce((s: number, q: { positive_marks?: number; marks?: number }) => s + (q.positive_marks ?? q.marks ?? 1), 0);
                        const key = generateKey();
                        const pin = generatePin();
                        const { error } = await supabase.from('exams').update({
                          exam_key: key, exam_pin: pin,
                          status: 'scheduled', is_published: true, total_marks: totalMarks,
                        }).eq('id', exam.id);
                        if (error) { toast.error('Failed: ' + error.message); return; }
                        toast.success(`Key generated: ${key} · PIN: ${pin}`);
                        fetchExams();
                      }}
                      className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 border border-dashed border-indigo-300 rounded-lg px-4 py-2 hover:bg-indigo-50 transition-colors w-full justify-center"
                    >
                      <Key className="w-4 h-4" /> Generate Key & PIN
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Update Settings Modal */}
      {activeModal === 'settings' && activeExam && (
        <UpdateSettingsModal
          exam={activeExam}
          batches={batches}
          onSave={handleUpdateSettings}
          onClose={() => { setActiveModal(null); setActiveExam(null); }}
        />
      )}

      {/* Regen Key Confirm */}
      {activeModal === 'regen-key' && activeExam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Regenerate Key & PIN?</h3>
                <p className="text-xs text-gray-500">Old key will no longer work</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">Students who had the old key will need the new one. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => { setActiveModal(null); setActiveExam(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={async () => {
                const key = generateKey(); const pin = generatePin();
                const { error } = await supabase.from('exams').update({ exam_key: key, exam_pin: pin }).eq('id', activeExam.id);
                if (error) { toast.error('Failed'); return; }
                toast.success(`New Key: ${key} · PIN: ${pin}`);
                setActiveModal(null); setActiveExam(null); fetchExams();
              }} className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {activeModal === 'preview' && activeExam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="font-semibold text-gray-900">{activeExam.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Student Preview · {activeExam.duration_minutes} min · {activeExam.total_marks} marks</p>
              </div>
              <button onClick={() => { setActiveModal(null); setActiveExam(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <ExamPreviewContent examId={activeExam.id} />
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {activeModal === 'confirm-delete' && activeExam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete Exam?</h3>
                <p className="text-xs text-gray-500">This cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              You are about to permanently delete <span className="font-semibold text-gray-900">"{activeExam.title}"</span> and all its questions.
            </p>
            {activeExam.hasAttempts && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                ⚠ Students have already attempted this exam. Their submission data will remain but the exam will be removed.
              </p>
            )}
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setActiveModal(null); setActiveExam(null); }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={() => handleDelete(activeExam)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exam Preview Content ──────────────────────────────────────────────────────

function ExamPreviewContent({ examId }: { examId: string }) {
  const [questions, setQuestions] = useState<Array<{
    id: string; question_text: string; question_image?: string | null;
    question_type: string; options: string[] | null; option_images?: (string | null)[] | null;
    positive_marks?: number; marks: number; negative_marks?: number;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('questions').select('*').eq('exam_id', examId).order('order_index').then(({ data }) => {
      setQuestions(data ?? []);
      setLoading(false);
    });
  }, [examId]);

  if (loading) return <div className="flex justify-center py-12"><div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 space-y-5">
      {questions.length === 0 && <p className="text-center text-gray-500 py-8">No questions added yet.</p>}
      {questions.map((q, i) => (
        <div key={q.id} className="border border-gray-200 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-3">
            <span className="shrink-0 text-xs font-bold bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-lg">Q{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm text-gray-900 font-medium">{q.question_text}</p>
              {q.question_image && <img src={q.question_image} alt="" className="mt-2 max-h-48 rounded-lg object-contain border border-gray-100" />}
            </div>
            <div className="text-xs text-gray-400 shrink-0 text-right">
              <span className="text-green-600 font-semibold">+{q.positive_marks ?? q.marks}</span>
              {(q.negative_marks ?? 0) > 0 && <span className="text-red-500 font-semibold ml-1">−{q.negative_marks}</span>}
            </div>
          </div>
          {q.question_type === 'mcq' && q.options && (
            <div className="space-y-2 mt-3">
              {q.options.map((opt, j) => {
                const imgUrl = q.option_images?.[j];
                return (
                  <div key={j} className="flex items-center gap-3 px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300 shrink-0" />
                    {imgUrl
                      ? <img src={imgUrl} alt={`opt ${j + 1}`} className="h-14 rounded object-contain" />
                      : <span className="text-sm text-gray-700">{opt || <span className="text-gray-400 italic">Empty option</span>}</span>
                    }
                  </div>
                );
              })}
            </div>
          )}
          {q.question_type === 'true_false' && (
            <div className="flex gap-3 mt-3">
              {['True', 'False'].map((o) => (
                <div key={o} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                  <span className="text-sm text-gray-700">{o}</span>
                </div>
              ))}
            </div>
          )}
          {(q.question_type === 'numerical' || q.question_type === 'theoretical') && (
            <div className="mt-3 px-3 py-3 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-400 italic">
              {q.question_type === 'numerical' ? 'Student enters a number here…' : 'Student writes their answer here…'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
