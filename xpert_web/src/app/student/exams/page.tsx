'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Clock, Calendar, CheckCircle, AlertCircle, BookOpen, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useStudent } from '@/contexts/StudentContext';

type ExamView = 'list' | 'taking';

interface StudentExamRow {
  id: string;
  title: string;
  subject: string | null;
  duration_minutes: number;
  total_marks: number;
  scheduled_at: string | null;
  is_instant: boolean;
  instant_expires_at: string | null;
  batch_name: string;
  submitted: boolean;
  total_score: number | null;
}

interface ExamQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  option_images?: (string | null)[] | null;
  question_image?: string | null;
  marks: number;
  positive_marks?: number;
  negative_marks?: number;
  section_title?: string | null;
}

export default function StudentExamsPage() {
  const { student } = useStudent();
  const [view, setView] = useState<ExamView>('list');
  const [exams, setExams] = useState<StudentExamRow[]>([]);
  const [currentExam, setCurrentExam] = useState<StudentExamRow | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submissionIdRef = useRef<string | null>(null);
  const lastStartAttemptRef = useRef<number>(0);

  const fetchExams = useCallback(async () => {
    if (!student) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_student_exams', { p_student_id: student.id });
    if (error) {
      toast.error('Could not load exams');
      setLoading(false);
      return;
    }
    setExams((data ?? []) as StudentExamRow[]);
    setLoading(false);
  }, [student]);

  useEffect(() => { fetchExams(); }, [fetchExams]);

  const getStatus = (exam: StudentExamRow) => {
    if (exam.submitted) return 'completed';
    if (exam.is_instant) {
      if (exam.instant_expires_at && new Date(exam.instant_expires_at) < new Date()) return 'expired';
      return 'ready';
    }
    if (!exam.scheduled_at) return 'ready';
    if (new Date(exam.scheduled_at) > new Date()) return 'upcoming';
    return 'ready';
  };

  const startExam = async (exam: StudentExamRow) => {
    if (!student) return;

    const now = Date.now();
    if (now - lastStartAttemptRef.current < 26000) {
      const wait = Math.ceil((26000 - (now - lastStartAttemptRef.current)) / 1000);
      toast.error(`For security purposes, please wait ${wait} seconds before trying again.`);
      return;
    }
    lastStartAttemptRef.current = now;

    setStarting(true);
    const { data: qData, error: qErr } = await supabase.rpc('get_exam_questions_for_student', {
      p_exam_id: exam.id,
      p_student_id: student.id,
    });
    if (qErr || !qData?.length) {
      toast.error(qErr?.message ?? 'This exam has no questions yet.');
      setStarting(false);
      return;
    }

    const parsed = (qData as ExamQuestion[]).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : (q.options ? JSON.parse(q.options as unknown as string) : null),
    }));

    const { data: startData, error: startErr } = await supabase.rpc('start_exam_as_student', {
      p_exam_id: exam.id,
      p_student_id: student.id,
    });

    if (startErr || !startData?.[0]) {
      toast.error(startErr?.message ?? 'Could not start exam');
      setStarting(false);
      return;
    }

    const sub = startData[0] as { submission_id: string; server_end_time: string };
    submissionIdRef.current = sub.submission_id;

    const endMs = new Date(sub.server_end_time).getTime();
    const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));

    setCurrentExam(exam);
    setQuestions(parsed);
    setAnswers({});
    setTimeRemaining(remaining || exam.duration_minutes * 60);
    setView('taking');
    setStarting(false);

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          void submitExam(exam, {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const submitExam = async (exam: StudentExamRow, ans: Record<string, string>) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const submissionId = submissionIdRef.current;
    if (!submissionId || !student) return;

    const answerPayload = questions.map((q) => ({
      question_id: q.id,
      student_answer: ans[q.id] ?? '',
    }));

    const { data: score, error } = await supabase.rpc('submit_exam_as_student', {
      p_submission_id: submissionId,
      p_student_id: student.id,
      p_answers: answerPayload,
    });

    if (error) {
      toast.error('Submit failed: ' + error.message);
      return;
    }

    toast.success(`Exam submitted! You scored ${score ?? 0}/${exam.total_marks}`);
    setView('list');
    setCurrentExam(null);
    setQuestions([]);
    submissionIdRef.current = null;
    fetchExams();
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (view === 'taking' && currentExam && questions.length > 0) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 mb-6 p-4 rounded-lg shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-gray-900 font-semibold">{currentExam.title}</h3>
              <p className="text-sm text-gray-600">{currentExam.subject}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Time Remaining</p>
              <p className={`text-2xl font-mono font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-green-600'}`}>
                {formatTime(timeRemaining)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((q, i) => {
            const showSection = q.section_title && (i === 0 || questions[i - 1].section_title !== q.section_title);
            return (
            <div key={q.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {showSection && q.section_title && (
                <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">{q.section_title}</p>
              )}
              <div className="flex items-start gap-3 mb-4">
                <span className="text-sm font-semibold text-gray-900 bg-gray-100 px-3 py-1 rounded shrink-0">Q{i + 1}</span>
                <div className="flex-1">
                  <p className="text-gray-900 mb-1">{q.question_text}</p>
                  {q.question_image && (
                    <img src={q.question_image} alt="" className="mt-2 max-h-48 rounded-lg object-contain border border-gray-100" />
                  )}
                  <p className="text-xs text-gray-500 mt-1">+{q.positive_marks ?? q.marks}{(q.negative_marks ?? 0) > 0 ? ` / −${q.negative_marks}` : ''}</p>
                </div>
              </div>

              {q.question_type === 'mcq' && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const imgUrl = q.option_images?.[oi];
                    return (
                      <label key={oi} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${answers[q.id] === opt ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name={`q-${q.id}`} value={opt} checked={answers[q.id] === opt}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                          className="w-4 h-4 text-indigo-600 shrink-0" />
                        {imgUrl ? <img src={imgUrl} alt="" className="h-14 rounded object-contain" /> : <span className="text-sm text-gray-900">{opt}</span>}
                      </label>
                    );
                  })}
                </div>
              )}
              {q.question_type === 'true_false' && (
                <div className="space-y-2">
                  {['True', 'False'].map((opt) => (
                    <label key={opt} className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer ${answers[q.id] === opt ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}>
                      <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === opt}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))} className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.question_type === 'numerical' && (
                <input type="text" value={answers[q.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Enter your answer" className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm" />
              )}
              {q.question_type === 'theoretical' && (
                <textarea value={answers[q.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder="Write your answer…" rows={5} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm" />
              )}
            </div>
            );
          })}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">Answered: {Object.keys(answers).length} / {questions.length}</p>
            <button onClick={() => {
              if (!confirm('Submit the exam? You cannot change answers after submission.')) return;
              void submitExam(currentExam, answers);
            }} className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="w-5 h-5" /> Submit Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-gray-900 text-2xl font-semibold">My Exams</h2>
        <p className="text-gray-600 text-sm mt-1">Exams from batches you joined</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Upcoming', val: exams.filter((e) => getStatus(e) === 'upcoming').length, color: 'bg-blue-100 text-blue-600', Icon: Clock },
          { label: 'Ready', val: exams.filter((e) => getStatus(e) === 'ready').length, color: 'bg-green-100 text-green-600', Icon: Play },
          { label: 'Completed', val: exams.filter((e) => getStatus(e) === 'completed').length, color: 'bg-purple-100 text-purple-600', Icon: CheckCircle },
        ].map(({ label, val, color, Icon }) => (
          <div key={label} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-6 h-6" /></div>
              <div>
                <p className="text-sm text-gray-600">{label}</p>
                <p className="text-2xl text-gray-900 font-semibold">{val}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : exams.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium">No exams found</p>
          <p className="text-gray-500 text-sm mt-1">Join a batch with your teacher&apos;s code to see exams.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => {
            const status = getStatus(exam);
            return (
              <div key={exam.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="text-gray-900 font-semibold text-lg">{exam.title}</h3>
                      {exam.is_instant && (
                        <span className="text-xs px-2 py-1 rounded font-medium bg-green-100 text-green-700 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Instant
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded font-medium ${
                        status === 'ready' ? 'bg-green-100 text-green-700' :
                        status === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                        status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {status === 'ready' ? 'Ready' : status === 'upcoming' ? 'Upcoming' : status === 'expired' ? 'Expired' : 'Completed'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                      <div><span className="text-gray-500">Subject:</span> {exam.subject}</div>
                      <div><span className="text-gray-500">Duration:</span> {exam.duration_minutes} mins</div>
                      <div><span className="text-gray-500">Marks:</span> {exam.total_marks}</div>
                      <div><span className="text-gray-500">Batch:</span> {exam.batch_name}</div>
                    </div>
                    {exam.is_instant && exam.instant_expires_at && status === 'ready' && (
                      <p className="text-xs text-green-700 mt-2">Join before {new Date(exam.instant_expires_at).toLocaleTimeString()}</p>
                    )}
                    {status === 'completed' && exam.total_score != null && (
                      <p className="mt-2 text-sm"><span className="font-medium">Score: </span><span className="text-indigo-600 font-semibold">{exam.total_score}/{exam.total_marks}</span></p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {status === 'ready' && (
                      <button onClick={() => startExam(exam)} disabled={starting}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm font-medium disabled:opacity-50">
                        <Play className="w-4 h-4" /> {starting ? 'Starting…' : 'Start Exam'}
                      </button>
                    )}
                    {status === 'upcoming' && (
                      <button disabled className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed text-sm">Not Started Yet</button>
                    )}
                    {status === 'expired' && (
                      <span className="text-sm text-red-600">Window closed</span>
                    )}
                    {status === 'completed' && (
                      <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600" /> Submitted
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
