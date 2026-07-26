import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Empty, Loading, OutlineButton, PrimaryButton, Screen, colors } from '@/components/mobile-ui';
import { pickAndExtractQuestions } from '@/lib/question-extraction';
import { pickAndUploadExamImage } from '@/lib/exam-images';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type QuestionType = 'mcq' | 'true_false' | 'numerical' | 'theoretical';
type Difficulty = 'easy' | 'medium' | 'hard';
type Batch = { id: string; name: string };
type Section = { id: string; title: string };
type DraftQuestion = { id: string; sectionId: string; question_text: string; question_type: QuestionType; options: string[]; option_images: (string | null)[]; question_image: string | null; correct_answer: string; positive_marks: string; negative_marks: string; difficulty: Difficulty; is_pyq: boolean; chapter_tag: string };

const id = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const types: QuestionType[] = ['mcq', 'true_false', 'numerical', 'theoretical'];
const blankQuestion = (sectionId: string): DraftQuestion => ({ id: id(), sectionId, question_text: '', question_type: 'mcq', options: ['', ''], option_images: [null, null], question_image: null, correct_answer: '', positive_marks: '1', negative_marks: '0', difficulty: 'medium', is_pyq: false, chapter_tag: '' });

export default function ExamBuilderScreen() {
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId?: string }>();
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState('60');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [isInstant, setIsInstant] = useState(true);
  const [scheduledAt, setScheduledAt] = useState('');
  const [noReverseBack, setNoReverseBack] = useState(false);
  const [questionTimer, setQuestionTimer] = useState('');
  const [sections, setSections] = useState<Section[]>([{ id: 'section-1', title: 'Section 1' }]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([blankQuestion('section-1')]);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  const totalMarks = useMemo(() => questions.reduce((sum, question) => sum + (Number(question.positive_marks) || 0), 0), [questions]);

  const loadBatches = useCallback(async () => {
    if (!user || profile?.role !== 'teacher') return;
    const [{ data }, { data: exam }, { data: questionRows }] = await Promise.all([
      supabase.from('batches').select('id, name').eq('teacher_id', user.id).order('created_at', { ascending: false }),
      examId ? supabase.from('exams').select('id, title, subject, duration_minutes, batch_id, batch_ids, is_instant, scheduled_at, no_reverse_back, per_question_time_seconds').eq('id', examId).eq('teacher_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      examId ? supabase.from('questions').select('id, question_text, question_type, options, option_images, question_image, correct_answer, positive_marks, negative_marks, difficulty, is_pyq, chapter_tag, section_title, order_index').eq('exam_id', examId).order('order_index') : Promise.resolve({ data: null }),
    ]);
    setBatches((data ?? []) as Batch[]);
    if (exam) {
      const sectionMap = new Map<string, string>();
      const loadedSections: Section[] = [];
      const sectionId = (sectionTitle: string | null) => {
        const label = sectionTitle?.trim() || 'Section 1';
        if (!sectionMap.has(label)) { const section = { id: id(), title: label }; sectionMap.set(label, section.id); loadedSections.push(section); }
        return sectionMap.get(label)!;
      };
      const loadedQuestions = (questionRows ?? []).map((question) => {
        const options = Array.isArray(question.options) ? question.options.filter((item): item is string => typeof item === 'string') : [];
        const optionImages = Array.isArray(question.option_images) ? question.option_images.map((item) => typeof item === 'string' ? item : null) : options.map(() => null);
        return { id: question.id, sectionId: sectionId(question.section_title), question_text: question.question_text, question_type: question.question_type as QuestionType, options, option_images: optionImages, question_image: question.question_image, correct_answer: question.correct_answer ?? '', positive_marks: String(question.positive_marks ?? 1), negative_marks: String(question.negative_marks ?? 0), difficulty: (question.difficulty ?? 'medium') as Difficulty, is_pyq: Boolean(question.is_pyq), chapter_tag: question.chapter_tag ?? '' };
      });
      setEditingExamId(exam.id); setTitle(exam.title); setSubject(exam.subject ?? ''); setDuration(String(exam.duration_minutes)); setSelectedBatches((exam.batch_ids?.length ? exam.batch_ids : [exam.batch_id]) as string[]); setIsInstant(Boolean(exam.is_instant)); setScheduledAt(exam.scheduled_at ? new Date(exam.scheduled_at).toISOString().slice(0, 16) : ''); setNoReverseBack(Boolean(exam.no_reverse_back)); setQuestionTimer(exam.per_question_time_seconds ? String(exam.per_question_time_seconds) : ''); setSections(loadedSections.length ? loadedSections : [{ id: 'section-1', title: 'Section 1' }]); setQuestions(loadedQuestions.length ? loadedQuestions : [blankQuestion('section-1')]);
    }
    setLoading(false);
  }, [examId, profile?.role, user]);

  useEffect(() => { void loadBatches(); }, [loadBatches]);

  const updateQuestion = (questionId: string, patch: Partial<DraftQuestion>) => setQuestions((current) => current.map((question) => question.id === questionId ? { ...question, ...patch } : question));
  const updateOption = (questionId: string, optionIndex: number, option: string) => setQuestions((current) => current.map((question) => question.id === questionId ? { ...question, options: question.options.map((value, index) => index === optionIndex ? option : value) } : question));
  const addSection = () => { const section = { id: id(), title: `Section ${sections.length + 1}` }; setSections((current) => [...current, section]); setQuestions((current) => [...current, blankQuestion(section.id)]); };
  const removeSection = (sectionId: string) => {
    if (sections.length === 1) return;
    setSections((current) => current.filter((section) => section.id !== sectionId));
    setQuestions((current) => current.filter((question) => question.sectionId !== sectionId));
  };

  const importQuestions = async () => {
    setExtracting(true);
    const result = await pickAndExtractQuestions();
    setExtracting(false);
    if (!result) return;
    if (result.error) { Alert.alert('Import failed', result.error); return; }
    const titles = [...new Set(result.questions.map((question) => question.section_title?.trim()).filter(Boolean) as string[])];
    const sectionByTitle = new Map(sections.map((section) => [section.title, section.id]));
    const newSections = [...sections];
    titles.forEach((sectionTitle) => {
      if (!sectionByTitle.has(sectionTitle)) { const section = { id: id(), title: sectionTitle }; newSections.push(section); sectionByTitle.set(sectionTitle, section.id); }
    });
    setSections(newSections);
    setQuestions((current) => [...current.filter((question) => question.question_text.trim()), ...result.questions.map((question) => ({ id: id(), sectionId: sectionByTitle.get(question.section_title?.trim() ?? '') ?? newSections[0].id, question_text: question.question_text, question_type: question.question_type, options: question.question_type === 'mcq' ? question.options.length >= 2 ? question.options : [...question.options, ''] : [], option_images: question.question_type === 'mcq' ? question.options.map(() => null) : [], question_image: null, correct_answer: question.correct_answer, positive_marks: String(question.positive_marks || question.marks || 1), negative_marks: String(question.negative_marks || 0), difficulty: question.difficulty, is_pyq: false, chapter_tag: question.chapter_tag ?? '' }))]);
    Alert.alert('Questions imported', `${result.questions.length} extracted questions are ready for review.`);
  };

  const validate = () => {
    if (!title.trim() || !subject.trim() || !selectedBatches.length) return 'Add the exam title, subject, and at least one batch.';
    if (!questions.length || questions.some((question) => !question.question_text.trim())) return 'Every question needs text.';
    for (const question of questions) {
      const validOptions = question.options.filter((option) => option.trim());
      if (question.question_type === 'mcq' && (validOptions.length < 2 || !question.correct_answer.trim())) return 'Each MCQ needs two options and a correct answer.';
      if ((question.question_type === 'true_false' || question.question_type === 'numerical') && !question.correct_answer.trim()) return 'True/False and numerical questions need a correct answer.';
    }
    if (!isInstant && Number.isNaN(new Date(scheduledAt).getTime())) return 'Use a valid scheduled date, such as 2026-07-30T10:00:00.';
    return null;
  };

  const uploadImage = async (questionId: string, optionIndex?: number) => {
    setUploadingQuestionId(questionId);
    const result = await pickAndUploadExamImage();
    setUploadingQuestionId(null);
    if (!result) return;
    if (result.error || !result.url) { Alert.alert('Image upload failed', result.error ?? 'Please try again.'); return; }
    if (optionIndex === undefined) updateQuestion(questionId, { question_image: result.url });
    else setQuestions((current) => current.map((question) => question.id === questionId ? { ...question, option_images: question.option_images.map((image, index) => index === optionIndex ? result.url! : image) } : question));
  };

  const saveAndPublish = async () => {
    if (!user) return;
    const validation = validate();
    if (validation) { Alert.alert('Complete the exam', validation); return; }
    setSaving(true);
    const scheduled = isInstant ? new Date() : new Date(scheduledAt);
    const examPayload = {
      teacher_id: user.id, batch_id: selectedBatches[0], batch_ids: selectedBatches, title: title.trim(), subject: subject.trim(), duration_minutes: Number(duration) || 60, total_marks: totalMarks,
      is_published: true, status: isInstant ? 'active' : 'scheduled', is_instant: isInstant, instant_expires_at: isInstant ? new Date(Date.now() + 60 * 60 * 1_000).toISOString() : null, scheduled_at: scheduled.toISOString(),
      no_reverse_back: noReverseBack, per_question_time_seconds: Number(questionTimer) || null, negative_marking: false, negative_marks_per_wrong: 0,
    };
    const { data: exam, error: examError } = editingExamId ? await supabase.from('exams').update(examPayload).eq('id', editingExamId).eq('teacher_id', user.id).select('id, exam_key, exam_pin').single() : await supabase.from('exams').insert(examPayload).select('id, exam_key, exam_pin').single();
    if (examError || !exam) { setSaving(false); Alert.alert('Could not publish exam', examError?.message ?? 'Please try again.'); return; }
    const sectionTitles = new Map(sections.map((section) => [section.id, section.title]));
    if (editingExamId) {
      const { count, error: submissionsError } = await supabase.from('exam_submissions').select('*', { count: 'exact', head: true }).eq('exam_id', editingExamId);
      if (submissionsError || count) { setSaving(false); Alert.alert('Exam updated', 'Questions were not replaced because this exam already has student submissions.'); router.back(); return; }
      const { error: deleteError } = await supabase.from('questions').delete().eq('exam_id', editingExamId);
      if (deleteError) { setSaving(false); Alert.alert('Could not update questions', deleteError.message); return; }
    }
    const { error: questionsError } = await supabase.from('questions').insert(questions.map((question, orderIndex) => ({
      exam_id: exam.id, question_text: question.question_text.trim(), question_type: question.question_type,
      options: question.question_type === 'mcq' ? question.options.filter((option) => option.trim()) : question.question_type === 'true_false' ? ['True', 'False'] : null,
      option_images: question.question_type === 'mcq' ? question.option_images.slice(0, question.options.filter((option) => option.trim()).length) : null,
      question_image: question.question_image,
      correct_answer: question.question_type === 'theoretical' ? null : question.correct_answer.trim() || null,
      marks: Number(question.positive_marks) || 1, positive_marks: Number(question.positive_marks) || 1, negative_marks: Math.max(0, Number(question.negative_marks) || 0),
      difficulty: question.difficulty, chapter_tag: question.chapter_tag.trim() || null, is_pyq: question.is_pyq, section_title: sectionTitles.get(question.sectionId) ?? null, order_index: orderIndex,
    })));
    setSaving(false);
    if (questionsError) { Alert.alert('Exam created but questions failed', questionsError.message); return; }
    Alert.alert(editingExamId ? 'Exam updated' : 'Exam published', exam.exam_key ? `Key: ${exam.exam_key}\nPIN: ${exam.exam_pin ?? '—'}` : 'Your students can now see this exam.');
    router.back();
  };

  const duplicateQuestion = (question: DraftQuestion) => setQuestions((current) => {
    const copy = { ...question, id: id(), options: [...question.options], option_images: [...question.option_images] };
    const index = current.findIndex((item) => item.id === question.id);
    return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
  });

  if (loading || profile?.role !== 'teacher') return <Loading />;
    return <Screen><View style={styles.header}><View><Text style={styles.title}>Build Exam</Text><Text style={styles.subtitle}>{questions.length} questions · {totalMarks} marks</Text></View><OutlineButton label={extracting ? 'Extracting…' : 'Import with AI'} onPress={() => void importQuestions()} disabled={extracting} /></View><View style={styles.card}><Text style={styles.sectionLabel}>Exam Details</Text><TextInput value={title} onChangeText={setTitle} placeholder="Exam title" style={styles.input} /><TextInput value={subject} onChangeText={setSubject} placeholder="Subject" style={styles.input} /><TextInput value={duration} onChangeText={setDuration} placeholder="Duration (minutes)" keyboardType="number-pad" style={styles.input} /><Text style={styles.label}>Batches</Text><View style={styles.pills}>{batches.map((batch) => <Pressable key={batch.id} onPress={() => setSelectedBatches((current) => current.includes(batch.id) ? current.filter((item) => item !== batch.id) : [...current, batch.id])} style={[styles.pill, selectedBatches.includes(batch.id) && styles.pillActive]}><Text style={[styles.pillText, selectedBatches.includes(batch.id) && styles.pillTextActive]}>{batch.name}</Text></Pressable>)}</View>{!batches.length && <Empty title="Create a batch first" detail="Students must belong to a batch before you can publish an exam." />}<View style={styles.switchRow}><Text style={styles.label}>Instant exam</Text><Switch value={isInstant} onValueChange={setIsInstant} /></View>{!isInstant && <TextInput value={scheduledAt} onChangeText={setScheduledAt} placeholder="2026-07-30T10:00:00" style={styles.input} />}<View style={styles.switchRow}><Text style={styles.label}>No reverse back</Text><Switch value={noReverseBack} onValueChange={setNoReverseBack} /></View><TextInput value={questionTimer} onChangeText={setQuestionTimer} placeholder="Per-question timer in seconds (optional)" keyboardType="number-pad" style={styles.input} /></View>{sections.map((section) => <View key={section.id} style={styles.card}><View style={styles.sectionHeader}><TextInput value={section.title} onChangeText={(value) => setSections((current) => current.map((item) => item.id === section.id ? { ...item, title: value } : item))} style={styles.sectionInput} /><Pressable onPress={() => removeSection(section.id)}><Text style={styles.delete}>Remove</Text></Pressable></View>{questions.filter((question) => question.sectionId === section.id).map((question, questionIndex) => <QuestionEditor key={question.id} question={question} index={questionIndex} onUpdate={updateQuestion} onOption={updateOption} onUploadImage={uploadImage} uploading={uploadingQuestionId === question.id} onDuplicate={() => duplicateQuestion(question)} onRemove={() => setQuestions((current) => current.filter((item) => item.id !== question.id))} />)}<OutlineButton label="Add question" onPress={() => setQuestions((current) => [...current, blankQuestion(section.id)])} /></View>)}<OutlineButton label="Add section" onPress={addSection} /><PrimaryButton label={saving ? 'Publishing…' : 'Publish exam'} onPress={() => void saveAndPublish()} disabled={saving || !batches.length} /></Screen>;
}

function QuestionEditor({ question, index, onUpdate, onOption, onUploadImage, uploading, onDuplicate, onRemove }: { question: DraftQuestion; index: number; onUpdate: (id: string, patch: Partial<DraftQuestion>) => void; onOption: (id: string, index: number, value: string) => void; onUploadImage: (id: string, optionIndex?: number) => Promise<void>; uploading: boolean; onDuplicate: () => void; onRemove: () => void }) {
  const addOption = () => onUpdate(question.id, { options: [...question.options, ''], option_images: [...question.option_images, null] });
  const removeOption = (optionIndex: number) => onUpdate(question.id, { options: question.options.filter((_, index) => index !== optionIndex), option_images: question.option_images.filter((_, index) => index !== optionIndex) });
  return <View style={styles.question}><View style={styles.questionTop}><Text style={styles.questionTitle}>Question {index + 1}</Text><View style={styles.questionActions}><Pressable onPress={onDuplicate}><Text style={styles.duplicate}>Duplicate</Text></Pressable><Pressable onPress={onRemove}><Text style={styles.delete}>Delete</Text></Pressable></View></View><View style={styles.pills}>{types.map((type) => <Pressable key={type} onPress={() => onUpdate(question.id, { question_type: type, options: type === 'mcq' ? question.options.length ? question.options : ['', ''] : [], option_images: type === 'mcq' ? question.option_images.length ? question.option_images : [null, null] : [] })} style={[styles.type, type === question.question_type && styles.pillActive]}><Text style={[styles.pillText, type === question.question_type && styles.pillTextActive]}>{type.replace('_', ' ')}</Text></Pressable>)}</View><TextInput value={question.question_text} onChangeText={(value) => onUpdate(question.id, { question_text: value })} placeholder="Question text" multiline style={[styles.input, styles.textarea]} />{question.question_image ? <Image source={{ uri: question.question_image }} style={styles.preview} /> : null}<OutlineButton label={uploading ? 'Uploading image…' : question.question_image ? 'Change question image' : 'Add question image'} onPress={() => void onUploadImage(question.id)} disabled={uploading} />{question.question_type === 'mcq' && question.options.map((option, optionIndex) => <View key={optionIndex} style={styles.optionRow}><TextInput value={option} onChangeText={(value) => onOption(question.id, optionIndex, value)} placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`} style={[styles.input, styles.optionInput]} />{question.option_images[optionIndex] ? <Image source={{ uri: question.option_images[optionIndex]! }} style={styles.optionPreview} /> : null}<Pressable onPress={() => void onUploadImage(question.id, optionIndex)} disabled={uploading}><Text style={styles.imageAction}>{uploading ? '…' : 'Image'}</Text></Pressable>{question.options.length > 2 && <Pressable onPress={() => removeOption(optionIndex)}><Text style={styles.delete}>×</Text></Pressable>}</View>)}{question.question_type === 'mcq' && <Pressable onPress={addOption}><Text style={styles.addOption}>+ Add option</Text></Pressable>}{question.question_type !== 'theoretical' && <TextInput value={question.correct_answer} onChangeText={(value) => onUpdate(question.id, { correct_answer: value })} placeholder={question.question_type === 'true_false' ? 'Correct answer: True or False' : 'Correct answer'} style={styles.input} />}<View style={styles.row}><TextInput value={question.positive_marks} onChangeText={(value) => onUpdate(question.id, { positive_marks: value })} placeholder="Positive" keyboardType="decimal-pad" style={[styles.input, styles.half]} /><TextInput value={question.negative_marks} onChangeText={(value) => onUpdate(question.id, { negative_marks: value })} placeholder="Negative" keyboardType="decimal-pad" style={[styles.input, styles.half]} /></View><TextInput value={question.chapter_tag} onChangeText={(value) => onUpdate(question.id, { chapter_tag: value })} placeholder="Chapter / topic (optional)" style={styles.input} /><View style={styles.switchRow}><Text style={styles.label}>Previous-year question</Text><Switch value={question.is_pyq} onValueChange={(value) => onUpdate(question.id, { is_pyq: value })} /></View></View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, subtitle: { color: colors.slate, marginTop: 4 }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, gap: 11 }, sectionLabel: { color: colors.text, fontSize: 16, fontWeight: '800' }, sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, sectionInput: { flex: 1, fontSize: 17, fontWeight: '800', color: colors.text, borderBottomWidth: 1, borderColor: '#C7D2FE', minHeight: 42 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 48, paddingHorizontal: 12, color: colors.text, backgroundColor: '#FFFFFF', fontSize: 15 }, textarea: { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' }, label: { color: colors.text, fontWeight: '700', fontSize: 14 }, pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999 }, type: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8 }, pillActive: { backgroundColor: '#EEF2FF', borderColor: colors.indigo }, pillText: { color: colors.slate, fontWeight: '700', fontSize: 12 }, pillTextActive: { color: colors.indigo }, switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, question: { borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 14, gap: 9 }, questionTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, questionActions: { flexDirection: 'row', gap: 14 }, questionTitle: { color: colors.text, fontWeight: '800' }, duplicate: { color: colors.indigo, fontWeight: '700', fontSize: 13 }, delete: { color: '#DC2626', fontWeight: '700', fontSize: 13 }, addOption: { color: colors.indigo, fontWeight: '800', fontSize: 13, paddingVertical: 3 }, row: { flexDirection: 'row', gap: 10 }, half: { flex: 1 }, preview: { width: '100%', height: 180, borderRadius: 10, resizeMode: 'contain', backgroundColor: '#F8FAFC' }, optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, optionInput: { flex: 1 }, optionPreview: { width: 40, height: 40, borderRadius: 6, resizeMode: 'cover' }, imageAction: { color: colors.indigo, fontWeight: '800', fontSize: 12 },
});
