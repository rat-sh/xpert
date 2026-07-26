import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Empty, Loading, OutlineButton, PrimaryButton, Screen, colors } from '@/components/mobile-ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Batch = { id: string; name: string };
type Exam = { id: string; title: string; subject: string | null; duration_minutes: number; total_marks: number; batch_id: string; batch_ids: string[] | null; is_published: boolean; is_instant: boolean; instant_expires_at: string | null; scheduled_at: string | null; no_reverse_back: boolean; per_question_time_seconds: number | null; status?: string; submitted?: boolean };
type QuestionType = 'mcq' | 'true_false' | 'numerical' | 'theoretical';
type Question = { id: string; question_text: string; question_type: QuestionType; options: string[] | null; option_images: (string | null)[] | null; question_image: string | null; marks: number; positive_marks: number | null; negative_marks: number | null; section_title: string | null };

const questionTypes: QuestionType[] = ['mcq', 'true_false', 'numerical', 'theoretical'];
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export default function ExamsScreen() {
  const router = useRouter();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState('60');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [instant, setInstant] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [noReverse, setNoReverse] = useState(false);
  const [perQuestionSeconds, setPerQuestionSeconds] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionType, setQuestionType] = useState<QuestionType>('mcq');
  const [optionOne, setOptionOne] = useState('');
  const [optionTwo, setOptionTwo] = useState('');
  const [optionThree, setOptionThree] = useState('');
  const [optionFour, setOptionFour] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [positiveMarks, setPositiveMarks] = useState('1');
  const [negativeMarks, setNegativeMarks] = useState('0');
  const [saving, setSaving] = useState(false);

  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [questionTimeRemaining, setQuestionTimeRemaining] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionIdRef = useRef<string | null>(null);
  const questionsRef = useRef<Question[]>([]);
  const answersRef = useRef<Record<string, string>>({});
  const activeIndexRef = useRef(0);
  const remainingRef = useRef(0);
  const questionTimesRef = useRef<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const load = useCallback(async () => {
    if (!profile || !user) return;
    setLoading(true);
    if (profile.role === 'teacher') {
      const [{ data: examRows }, { data: batchRows }] = await Promise.all([
        supabase.from('exams').select('*').eq('teacher_id', user.id).neq('status', 'archived').order('created_at', { ascending: false }),
        supabase.from('batches').select('id, name').eq('teacher_id', user.id).order('created_at', { ascending: false }),
      ]);
      setExams((examRows ?? []) as Exam[]);
      setBatches((batchRows ?? []) as Batch[]);
    } else {
      const { data: enrollmentRows } = await supabase.from('batch_enrollments').select('batch_id').eq('student_id', user.id).eq('is_active', true);
      const batchIds = (enrollmentRows ?? []).map((row) => row.batch_id);
      if (!batchIds.length) setExams([]);
      else {
        const selection = 'id, title, subject, duration_minutes, total_marks, batch_id, batch_ids, is_published, is_instant, instant_expires_at, scheduled_at, no_reverse_back, per_question_time_seconds, exam_submissions(submitted_at)';
        const [legacy, multi] = await Promise.all([
          supabase.from('exams').select(selection).eq('is_published', true).in('batch_id', batchIds).order('created_at', { ascending: false }),
          supabase.from('exams').select(selection).eq('is_published', true).overlaps('batch_ids', batchIds).order('created_at', { ascending: false }),
        ]);
        const combined = [...(legacy.data ?? []), ...(multi.data ?? [])];
        setExams(Array.from(new Map(combined.map((exam) => [exam.id, exam])).values()).map((exam) => {
          const submissions = Array.isArray(exam.exam_submissions) ? exam.exam_submissions : [];
          return { ...exam, submitted: Boolean(submissions[0]?.submitted_at) } as Exam;
        }));
      }
    }
    setLoading(false);
  }, [profile, user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => clearTimer(), []);

  const closeRunner = useCallback(() => {
    clearTimer();
    setActiveExam(null);
    setQuestions([]);
    questionsRef.current = [];
    submissionIdRef.current = null;
  }, []);

  const submitExam = useCallback(async (exam: Exam) => {
    if (submittingRef.current || !submissionIdRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    clearTimer();
    const { data, error } = await supabase.rpc('submit_exam', {
      p_submission_id: submissionIdRef.current,
      p_answers: questionsRef.current.map((question) => ({ question_id: question.id, student_answer: answersRef.current[question.id] ?? '' })),
    });
    if (error) {
      Alert.alert('Could not submit', error.message);
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    Alert.alert('Exam submitted', `Score: ${result?.total_score ?? 0}/${exam.total_marks}`);
    submittingRef.current = false;
    setSubmitting(false);
    closeRunner();
    void load();
  }, [closeRunner, load]);

  useEffect(() => {
    if (!activeExam || !questions.length || timerRef.current) return;
    timerRef.current = setInterval(() => {
      const nextOverall = Math.max(0, remainingRef.current - 1);
      remainingRef.current = nextOverall;
      setTimeRemaining(nextOverall);
      if (nextOverall === 0) { clearTimer(); void submitExam(activeExam); return; }
      if (!activeExam.per_question_time_seconds) return;
      const activeQuestion = questionsRef.current[activeIndexRef.current];
      if (!activeQuestion) return;
      const currentQuestionTime = questionTimesRef.current[activeQuestion.id] ?? activeExam.per_question_time_seconds;
      const nextQuestionTime = currentQuestionTime - 1;
      if (nextQuestionTime > 0) {
        questionTimesRef.current[activeQuestion.id] = nextQuestionTime;
        setQuestionTimeRemaining(nextQuestionTime);
        return;
      }
      const nextIndex = activeIndexRef.current + 1;
      if (nextIndex >= questionsRef.current.length) { clearTimer(); void submitExam(activeExam); return; }
      activeIndexRef.current = nextIndex;
      setActiveQuestionIndex(nextIndex);
      setQuestionTimeRemaining(questionTimesRef.current[questionsRef.current[nextIndex].id] ?? activeExam.per_question_time_seconds);
    }, 1_000);
    return clearTimer;
  }, [activeExam, questions.length, submitExam]);

  const startExam = async (exam: Exam) => {
    const { data: startData, error: startError } = await supabase.rpc('start_exam', { p_exam_id: exam.id });
    if (startError || !startData?.[0]) { Alert.alert('Could not start exam', startError?.message ?? 'Please try again.'); return; }
    const { data: questionRows, error: questionError } = await supabase.from('student_questions_view').select('*').eq('exam_id', exam.id).order('order_index');
    if (questionError || !questionRows?.length) { Alert.alert('No questions found', questionError?.message ?? 'Your teacher has not added questions.'); return; }
    const parsed = (questionRows as Question[]).map((question) => ({ ...question, options: Array.isArray(question.options) ? question.options : null }));
    const submission = startData[0] as { submission_id: string; server_end_time: string };
    const remaining = Math.max(0, Math.floor((new Date(submission.server_end_time).getTime() - Date.now()) / 1_000));
    if (!remaining) { Alert.alert('Exam expired', 'The server exam window has closed.'); return; }
    submissionIdRef.current = submission.submission_id;
    questionsRef.current = parsed;
    answersRef.current = {};
    activeIndexRef.current = 0;
    remainingRef.current = remaining;
    questionTimesRef.current = Object.fromEntries(parsed.map((question) => [question.id, exam.per_question_time_seconds ?? 0]));
    setActiveExam(exam); setQuestions(parsed); setAnswers({}); setActiveQuestionIndex(0); setTimeRemaining(remaining); setQuestionTimeRemaining(exam.per_question_time_seconds);
  };

  const setAnswer = (questionId: string, value: string) => setAnswers((current) => { const next = { ...current, [questionId]: value }; answersRef.current = next; return next; });
  const moveQuestion = (nextIndex: number) => {
    if (!activeExam || nextIndex < 0 || nextIndex >= questions.length || (activeExam.no_reverse_back && nextIndex < activeIndexRef.current)) return;
    activeIndexRef.current = nextIndex; setActiveQuestionIndex(nextIndex);
    if (activeExam.per_question_time_seconds) setQuestionTimeRemaining(questionTimesRef.current[questions[nextIndex].id] ?? activeExam.per_question_time_seconds);
  };

  const publishExam = async () => {
    if (!user || !title.trim() || !selectedBatches.length || !questionText.trim()) { Alert.alert('Complete the exam', 'Add a title, at least one batch, and the first question.'); return; }
    const options = questionType === 'mcq' ? [optionOne, optionTwo, optionThree, optionFour].map((option) => option.trim()).filter(Boolean) : questionType === 'true_false' ? ['True', 'False'] : null;
    if (questionType === 'mcq' && (!options || options.length < 2 || !correctAnswer.trim())) { Alert.alert('Complete the MCQ', 'Add at least two options and the correct answer.'); return; }
    if ((questionType === 'true_false' || questionType === 'numerical') && !correctAnswer.trim()) { Alert.alert('Add the answer', 'This question type needs a correct answer.'); return; }
    const durationMinutes = Number(duration);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) { Alert.alert('Invalid duration', 'Use a duration in minutes.'); return; }
    const parsedSchedule = instant ? new Date() : new Date(scheduledAt);
    if (Number.isNaN(parsedSchedule.getTime())) { Alert.alert('Invalid schedule', 'Use a valid date and time, for example 2026-07-30T10:00:00.'); return; }
    setSaving(true);
    const examPayload = { teacher_id: user.id, batch_id: selectedBatches[0], batch_ids: selectedBatches, title: title.trim(), subject: subject.trim() || null, duration_minutes: durationMinutes, total_marks: Number(positiveMarks) || 1, is_published: true, status: instant ? 'active' : 'scheduled', is_instant: instant, instant_expires_at: instant ? new Date(Date.now() + 60 * 60 * 1_000).toISOString() : null, scheduled_at: parsedSchedule.toISOString(), no_reverse_back: noReverse, per_question_time_seconds: Number(perQuestionSeconds) || null, negative_marking: false, negative_marks_per_wrong: 0 };
    const { data: exam, error: examError } = await supabase.from('exams').insert(examPayload).select('id').single();
    if (examError || !exam) { setSaving(false); Alert.alert('Could not publish exam', examError?.message ?? 'Please try again.'); return; }
    const { error: questionError } = await supabase.from('questions').insert({ exam_id: exam.id, question_text: questionText.trim(), question_type: questionType, options, correct_answer: questionType === 'theoretical' ? null : correctAnswer.trim() || null, marks: Number(positiveMarks) || 1, positive_marks: Number(positiveMarks) || 1, negative_marks: Math.max(0, Number(negativeMarks) || 0), difficulty: 'medium', order_index: 0, is_pyq: false });
    setSaving(false);
    if (questionError) { Alert.alert('Exam draft created', `The question could not be saved: ${questionError.message}`); return; }
    Alert.alert('Exam published', instant ? 'Students can join for the next hour.' : 'The exam is scheduled.');
    setCreating(false); setTitle(''); setSubject(''); setSelectedBatches([]); setQuestionText(''); setCorrectAnswer(''); setOptionOne(''); setOptionTwo(''); setOptionThree(''); setOptionFour('');
    void load();
  };

  const archiveExam = (exam: Exam) => Alert.alert('Archive exam', `Archive ${exam.title}? Students will no longer see it.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Archive', style: 'destructive', onPress: () => void (async () => { const { error } = await supabase.from('exams').update({ status: 'archived' }).eq('id', exam.id); if (error) Alert.alert('Could not archive', error.message); else void load(); })() }]);
  const duplicateExam = async (exam: Exam) => {
    if (!user) return;
    const { data: created, error: examError } = await supabase.from('exams').insert({ teacher_id: user.id, batch_id: exam.batch_id, batch_ids: exam.batch_ids ?? [exam.batch_id], title: `${exam.title} (Copy)`, subject: exam.subject, duration_minutes: exam.duration_minutes, total_marks: 0, scheduled_at: exam.scheduled_at, no_reverse_back: exam.no_reverse_back, per_question_time_seconds: exam.per_question_time_seconds, negative_marking: false, negative_marks_per_wrong: 0, is_published: false, status: 'draft', is_instant: false, instant_expires_at: null }).select('id').single();
    if (examError || !created) { Alert.alert('Could not duplicate', examError?.message ?? 'Please try again.'); return; }
    const { data: sourceQuestions, error: sourceError } = await supabase.from('questions').select('question_text, question_type, options, option_images, question_image, correct_answer, marks, positive_marks, negative_marks, difficulty, chapter_tag, order_index, is_pyq, section_title').eq('exam_id', exam.id).order('order_index');
    if (sourceError) { Alert.alert('Exam copied', `Questions could not be copied: ${sourceError.message}`); return; }
    if (sourceQuestions?.length) {
      const { error: questionError } = await supabase.from('questions').insert(sourceQuestions.map((question) => ({ ...question, exam_id: created.id })));
      if (questionError) { Alert.alert('Exam copied', `Questions could not be copied: ${questionError.message}`); return; }
    }
    Alert.alert('Exam duplicated', 'The copy is saved as a draft.'); void load();
  };

  if (!profile || loading) return <Loading />;
  if (activeExam && questions.length) {
    const question = questions[activeQuestionIndex];
    const canBack = activeQuestionIndex > 0 && !activeExam.no_reverse_back;
    const canNext = activeQuestionIndex < questions.length - 1;
    return <Screen><View style={styles.runnerHeader}><View><Text style={styles.runnerTitle}>{activeExam.title}</Text><Text style={styles.subtle}>Question {activeQuestionIndex + 1} of {questions.length}</Text></View><View><Text style={styles.timer}>{formatTime(timeRemaining)}</Text>{questionTimeRemaining !== null && <Text style={styles.questionTimer}>Q: {formatTime(questionTimeRemaining)}</Text>}</View></View><View style={styles.questionCard}>{question.section_title && <Text style={styles.section}>{question.section_title}</Text>}<Text style={styles.question}>Q{activeQuestionIndex + 1}. {question.question_text}</Text>{question.question_image && <Image source={{ uri: question.question_image }} style={styles.questionImage} />}<Text style={styles.marks}>+{question.positive_marks ?? question.marks}{(question.negative_marks ?? 0) > 0 ? ` / −${question.negative_marks}` : ''}</Text>{question.question_type === 'mcq' && question.options?.map((option, optionIndex) => <Pressable key={`${option}-${optionIndex}`} onPress={() => setAnswer(question.id, option)} style={[styles.answer, answers[question.id] === option && styles.answerSelected]}>{question.option_images?.[optionIndex] && <Image source={{ uri: question.option_images[optionIndex]! }} style={styles.optionImage} />}<Text style={[styles.answerText, answers[question.id] === option && styles.answerTextSelected]}>{option}</Text></Pressable>)}{question.question_type === 'true_false' && ['True', 'False'].map((option) => <Pressable key={option} onPress={() => setAnswer(question.id, option)} style={[styles.answer, answers[question.id] === option && styles.answerSelected]}><Text style={[styles.answerText, answers[question.id] === option && styles.answerTextSelected]}>{option}</Text></Pressable>)}{(question.question_type === 'numerical' || question.question_type === 'theoretical') && <TextInput value={answers[question.id] ?? ''} onChangeText={(value) => setAnswer(question.id, value)} placeholder={question.question_type === 'numerical' ? 'Enter your answer' : 'Write your answer'} multiline={question.question_type === 'theoretical'} style={[styles.input, question.question_type === 'theoretical' && styles.textarea]} />}</View><View style={styles.navigation}><OutlineButton label="Back" onPress={() => moveQuestion(activeQuestionIndex - 1)} disabled={!canBack || submitting} />{canNext ? <PrimaryButton label="Next" onPress={() => moveQuestion(activeQuestionIndex + 1)} disabled={submitting} /> : <PrimaryButton label={submitting ? 'Submitting…' : 'Submit exam'} onPress={() => Alert.alert('Submit exam?', 'You cannot change answers after submission.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Submit', onPress: () => void submitExam(activeExam) }])} disabled={submitting} />}</View></Screen>;
  }

  if (profile.role === 'student') return <Screen><Text style={styles.title}>My Exams</Text><Text style={styles.subtle}>Exams from every batch you have joined.</Text>{exams.length ? exams.map((exam) => { const expired = exam.is_instant && exam.instant_expires_at && new Date(exam.instant_expires_at) < new Date(); const future = !exam.is_instant && exam.scheduled_at && new Date(exam.scheduled_at) > new Date(); return <View key={exam.id} style={styles.card}><Text style={styles.cardTitle}>{exam.title}</Text><Text style={styles.subtle}>{exam.subject || 'General'} · {exam.duration_minutes} min · {exam.total_marks} marks</Text><Text style={styles.status}>{exam.submitted ? 'Submitted' : expired ? 'Window closed' : future ? `Starts ${new Date(exam.scheduled_at!).toLocaleString()}` : 'Ready to start'}</Text>{!exam.submitted && !expired && !future && <PrimaryButton label="Start exam" onPress={() => void startExam(exam)} />}</View>; }) : <Empty title="No exams available" detail="Join a batch or wait for your teacher to publish an exam." />}</Screen>;

  return <Screen><View style={styles.header}><View><Text style={styles.title}>Exam Conduct</Text><Text style={styles.subtle}>Publish a focused exam from your phone.</Text></View><View style={styles.headerActions}><OutlineButton label="Full builder" onPress={() => router.push('/teacher/exam-builder')} /><OutlineButton label={creating ? 'Close' : 'Quick exam'} onPress={() => setCreating((value) => !value)} /></View></View>{creating && <View style={styles.builder}><Text style={styles.builderTitle}>Publish exam</Text><TextInput value={title} onChangeText={setTitle} placeholder="Exam title" style={styles.input} /><TextInput value={subject} onChangeText={setSubject} placeholder="Subject" style={styles.input} /><TextInput value={duration} onChangeText={setDuration} placeholder="Duration in minutes" keyboardType="number-pad" style={styles.input} /><Text style={styles.label}>Assign batches</Text><View style={styles.batchList}>{batches.map((batch) => <Pressable key={batch.id} onPress={() => setSelectedBatches((current) => current.includes(batch.id) ? current.filter((id) => id !== batch.id) : [...current, batch.id])} style={[styles.batchPill, selectedBatches.includes(batch.id) && styles.batchPillActive]}><Text style={[styles.batchPillText, selectedBatches.includes(batch.id) && styles.batchPillTextActive]}>{batch.name}</Text></Pressable>)}</View><View style={styles.switchRow}><Text style={styles.label}>Instant exam (one-hour join window)</Text><Switch value={instant} onValueChange={setInstant} /></View>{!instant && <TextInput value={scheduledAt} onChangeText={setScheduledAt} placeholder="Schedule: 2026-07-30T10:00:00" style={styles.input} />}<View style={styles.switchRow}><Text style={styles.label}>No reverse back</Text><Switch value={noReverse} onValueChange={setNoReverse} /></View><TextInput value={perQuestionSeconds} onChangeText={setPerQuestionSeconds} placeholder="Per-question timer in seconds (optional)" keyboardType="number-pad" style={styles.input} /><Text style={styles.builderTitle}>First question</Text><View style={styles.typeList}>{questionTypes.map((type) => <Pressable key={type} onPress={() => setQuestionType(type)} style={[styles.typePill, type === questionType && styles.batchPillActive]}><Text style={[styles.batchPillText, type === questionType && styles.batchPillTextActive]}>{type.replace('_', ' ')}</Text></Pressable>)}</View><TextInput value={questionText} onChangeText={setQuestionText} placeholder="Question text" multiline style={[styles.input, styles.textarea]} />{questionType === 'mcq' && <><TextInput value={optionOne} onChangeText={setOptionOne} placeholder="Option A" style={styles.input} /><TextInput value={optionTwo} onChangeText={setOptionTwo} placeholder="Option B" style={styles.input} /><TextInput value={optionThree} onChangeText={setOptionThree} placeholder="Option C (optional)" style={styles.input} /><TextInput value={optionFour} onChangeText={setOptionFour} placeholder="Option D (optional)" style={styles.input} /></>}{questionType !== 'theoretical' && <TextInput value={correctAnswer} onChangeText={setCorrectAnswer} placeholder={questionType === 'true_false' ? 'Correct answer: True or False' : 'Correct answer'} style={styles.input} />}<View style={styles.markRow}><TextInput value={positiveMarks} onChangeText={setPositiveMarks} placeholder="Positive marks" keyboardType="decimal-pad" style={[styles.input, styles.markInput]} /><TextInput value={negativeMarks} onChangeText={setNegativeMarks} placeholder="Negative marks" keyboardType="decimal-pad" style={[styles.input, styles.markInput]} /></View><PrimaryButton label={saving ? 'Publishing…' : 'Publish exam'} onPress={() => void publishExam()} disabled={saving} /></View>}{exams.length ? exams.map((exam) => <View key={exam.id} style={styles.card}><Text style={styles.cardTitle}>{exam.title}</Text><Text style={styles.subtle}>{exam.subject || 'General'} · {exam.duration_minutes} min · {exam.total_marks} marks</Text><Text style={styles.status}>{exam.is_published ? (exam.is_instant ? 'Instant exam active' : 'Published') : 'Draft'}</Text><View style={styles.examActions}><Pressable onPress={() => router.push({ pathname: '/teacher/exam-builder', params: { examId: exam.id } })}><Text style={styles.edit}>Edit</Text></Pressable><Pressable onPress={() => void duplicateExam(exam)}><Text style={styles.edit}>Duplicate</Text></Pressable><Pressable onPress={() => archiveExam(exam)}><Text style={styles.archive}>Archive</Text></Pressable></View></View>) : !creating && <Empty title="No exams created" detail="Use Full builder to create a multi-question, AI-imported exam." />}</Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }, headerActions: { gap: 8, alignItems: 'stretch' }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, subtle: { color: colors.slate, lineHeight: 20, marginTop: 4 }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, gap: 9 }, cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, status: { color: colors.indigo, fontWeight: '700', fontSize: 13 },
  builder: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 14, padding: 15, gap: 10 }, builderTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 3 }, label: { color: colors.text, fontSize: 14, fontWeight: '700' }, input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 48, paddingHorizontal: 13, color: colors.text, fontSize: 15, backgroundColor: '#FFFFFF' }, textarea: { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' }, batchList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, batchPill: { paddingVertical: 9, paddingHorizontal: 11, borderRadius: 999, borderWidth: 1, borderColor: colors.border }, batchPillActive: { borderColor: colors.indigo, backgroundColor: '#EEF2FF' }, batchPillText: { color: colors.slate, fontSize: 13, fontWeight: '700' }, batchPillTextActive: { color: colors.indigo }, switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, typeList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, typePill: { paddingVertical: 8, paddingHorizontal: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border }, markRow: { flexDirection: 'row', gap: 10 }, markInput: { flex: 1 }, examActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 4 }, edit: { color: colors.indigo, fontWeight: '800', fontSize: 13 }, archive: { color: '#B45309', fontWeight: '800', fontSize: 13 },
  runnerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, runnerTitle: { color: colors.text, fontSize: 18, fontWeight: '800', maxWidth: 220 }, timer: { color: colors.green, fontSize: 24, fontWeight: '800', fontVariant: ['tabular-nums'] }, questionTimer: { color: colors.indigo, fontSize: 13, fontWeight: '700', textAlign: 'right', marginTop: 3 }, questionCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 11 }, section: { color: colors.indigo, fontSize: 12, fontWeight: '800', textTransform: 'uppercase' }, question: { color: colors.text, fontSize: 17, lineHeight: 25, fontWeight: '600' }, marks: { color: colors.slate, fontSize: 13 }, questionImage: { width: '100%', height: 220, resizeMode: 'contain', borderRadius: 10, backgroundColor: '#F8FAFC' }, answer: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 10, gap: 8 }, optionImage: { width: '100%', height: 120, resizeMode: 'contain', borderRadius: 8, backgroundColor: '#F8FAFC' }, answerSelected: { borderColor: colors.indigo, backgroundColor: '#EEF2FF' }, answerText: { color: colors.text, fontSize: 15 }, answerTextSelected: { color: colors.indigo, fontWeight: '700' }, navigation: { flexDirection: 'row', gap: 10 },
});
