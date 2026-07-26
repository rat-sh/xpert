import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Empty, Loading, OutlineButton, Screen, colors } from '@/components/mobile-ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Result = { id: string; studentName: string; examTitle: string; score: number | null; total: number; percentage: number | null; submittedAt: string | null };
type AnswerReview = { id: string; student_answer: string | null; is_correct: boolean | null; marks_awarded: number | null; question: string; correctAnswer: string | null; maxMarks: number };

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);

export default function ResultsScreen() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Result[]>([]);
  const [selected, setSelected] = useState<Result | null>(null);
  const [answers, setAnswers] = useState<AnswerReview[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user || !profile) return;
    setLoading(true);
    if (profile.role === 'student') {
      const { data, error } = await supabase.from('exam_submissions').select('id, total_score, percentage, submitted_at, exams(title, total_marks)').eq('student_id', user.id).not('submitted_at', 'is', null).order('submitted_at', { ascending: false });
      if (error) Alert.alert('Could not load results', error.message);
      else setResults((data ?? []).map((row) => { const exam = Array.isArray(row.exams) ? row.exams[0] : row.exams; return { id: row.id, studentName: '', examTitle: exam?.title ?? 'Exam', score: row.total_score, total: exam?.total_marks ?? 0, percentage: row.percentage, submittedAt: row.submitted_at }; }));
    } else {
      const { data: exams } = await supabase.from('exams').select('id, title, total_marks').eq('teacher_id', user.id);
      const examMap = new Map((exams ?? []).map((exam) => [exam.id, exam]));
      const examIds = [...examMap.keys()];
      if (!examIds.length) setResults([]);
      else {
        const { data: submissions, error } = await supabase.from('exam_submissions').select('id, exam_id, student_id, total_score, percentage, submitted_at').in('exam_id', examIds).not('submitted_at', 'is', null).order('submitted_at', { ascending: false });
        if (error) Alert.alert('Could not load results', error.message);
        else {
          const studentIds = [...new Set((submissions ?? []).map((submission) => submission.student_id))];
          const { data: users } = studentIds.length ? await supabase.from('users').select('id, full_name').in('id', studentIds) : { data: [] };
          const names = new Map((users ?? []).map((student) => [student.id, student.full_name]));
          setResults((submissions ?? []).map((submission) => { const exam = examMap.get(submission.exam_id); return { id: submission.id, studentName: names.get(submission.student_id) ?? 'Student', examTitle: exam?.title ?? 'Exam', score: submission.total_score, total: exam?.total_marks ?? 0, percentage: submission.percentage, submittedAt: submission.submitted_at }; }));
        }
      }
    }
    setLoading(false);
  }, [profile, user]);

  useEffect(() => { void load(); const timer = setInterval(() => { void load(); }, 15_000); return () => clearInterval(timer); }, [load]);
  const review = async (result: Result) => {
    setSelected(result); setReviewLoading(true);
    const { data, error } = await supabase.from('submission_answers').select('id, student_answer, is_correct, marks_awarded, questions(question_text, correct_answer, marks)').eq('submission_id', result.id);
    setReviewLoading(false);
    if (error) { Alert.alert('Could not load answer review', error.message); return; }
    setAnswers((data ?? []).map((answer) => { const question = Array.isArray(answer.questions) ? answer.questions[0] : answer.questions; return { id: answer.id, student_answer: answer.student_answer, is_correct: answer.is_correct, marks_awarded: answer.marks_awarded, question: question?.question_text ?? 'Question', correctAnswer: question?.correct_answer ?? null, maxMarks: question?.marks ?? 0 }; }));
  };
  const exportPdf = async () => {
    if (!selected) return;
    const html = `<!DOCTYPE html><html><body style="font-family:Arial;padding:20px"><h1>Exam Result</h1><p><b>${escapeHtml(selected.examTitle)}</b></p>${selected.studentName ? `<p>Student: ${escapeHtml(selected.studentName)}</p>` : ''}<p>Score: ${selected.score ?? 0}/${selected.total} (${Math.round(selected.percentage ?? 0)}%)</p><hr/>${answers.map((answer, index) => `<section style="margin:16px 0"><b>Q${index + 1}. ${escapeHtml(answer.question)}</b><p>Your answer: ${escapeHtml(answer.student_answer || '—')}</p><p>Correct answer: ${escapeHtml(answer.correctAnswer || '—')}</p><p>Marks: ${answer.marks_awarded ?? 0}/${answer.maxMarks}</p></section>`).join('')}</body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf', dialogTitle: 'Share result PDF' });
    else Alert.alert('PDF created', uri);
  };
  const filteredResults = results.filter((result) => `${result.studentName} ${result.examTitle}`.toLowerCase().includes(search.trim().toLowerCase()));
  const average = filteredResults.length ? Math.round(filteredResults.reduce((sum, result) => sum + (result.percentage ?? 0), 0) / filteredResults.length) : 0;
  const passRate = filteredResults.length ? Math.round((filteredResults.filter((result) => (result.percentage ?? 0) >= 40).length / filteredResults.length) * 100) : 0;
  if (loading) return <Loading />;
  return <Screen><View style={styles.header}><View><Text style={styles.title}>{profile?.role === 'teacher' ? 'Student Results' : 'My Results'}</Text><Text style={styles.subtitle}>Updates automatically every 15 seconds.</Text></View><OutlineButton label="Refresh" onPress={() => void load()} /></View>{profile?.role === 'teacher' && <View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{filteredResults.length}</Text><Text style={styles.statLabel}>Submissions</Text></View><View style={styles.stat}><Text style={styles.statValue}>{average}%</Text><Text style={styles.statLabel}>Average</Text></View><View style={styles.stat}><Text style={styles.statValue}>{passRate}%</Text><Text style={styles.statLabel}>Pass rate</Text></View></View>}<TextInput value={search} onChangeText={setSearch} placeholder={profile?.role === 'teacher' ? 'Search student or exam' : 'Search exam'} style={styles.search} />{filteredResults.length ? filteredResults.map((result) => <Pressable key={result.id} onPress={() => void review(result)} style={styles.card}>{profile?.role === 'teacher' && <Text style={styles.student}>{result.studentName}</Text>}<Text style={styles.exam}>{result.examTitle}</Text><View style={styles.row}><Text style={styles.score}>{result.score ?? 0}/{result.total}</Text><Text style={[styles.badge, (result.percentage ?? 0) >= 40 ? styles.pass : styles.fail]}>{Math.round(result.percentage ?? 0)}%</Text></View><Text style={styles.date}>{result.submittedAt ? new Date(result.submittedAt).toLocaleString() : ''}</Text></Pressable>) : <Empty title={search ? 'No matching results' : 'No submitted exams'} detail={search ? 'Change the search text and try again.' : 'Completed student exams will appear here.'} />}{selected && <View style={styles.review}><View style={styles.reviewHeader}><View><Text style={styles.exam}>{selected.examTitle}</Text><Text style={styles.subtitle}>{selected.score ?? 0}/{selected.total} · {Math.round(selected.percentage ?? 0)}%</Text></View><OutlineButton label="Close" onPress={() => setSelected(null)} /></View><OutlineButton label="Share PDF" onPress={() => void exportPdf()} disabled={reviewLoading} />{reviewLoading ? <Text style={styles.date}>Loading answer review…</Text> : answers.map((answer, index) => <View key={answer.id} style={styles.answer}><Text style={styles.answerQuestion}>Q{index + 1}. {answer.question}</Text><Text style={styles.date}>Your answer: {answer.student_answer || '—'}</Text><Text style={styles.date}>Correct: {answer.correctAnswer || '—'}</Text><Text style={[styles.answerMarks, answer.is_correct === true ? styles.correct : answer.is_correct === false ? styles.incorrect : undefined]}>{answer.is_correct === null ? 'Manual grading pending' : answer.is_correct ? 'Correct' : 'Incorrect'} · {answer.marks_awarded ?? 0}/{answer.maxMarks}</Text></View>)}</View>}</Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, subtitle: { color: colors.slate, marginTop: 4 }, search: { minHeight: 48, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, color: colors.text, fontSize: 15 }, stats: { flexDirection: 'row', gap: 8 }, stat: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 11, gap: 2 }, statValue: { color: colors.text, fontWeight: '800', fontSize: 19 }, statLabel: { color: colors.slate, fontSize: 11 }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, gap: 7 }, student: { color: colors.indigo, fontWeight: '800' }, exam: { color: colors.text, fontSize: 16, fontWeight: '800' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, score: { color: colors.text, fontSize: 18, fontWeight: '800' }, badge: { fontWeight: '800', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, overflow: 'hidden' }, pass: { color: '#166534', backgroundColor: '#DCFCE7' }, fail: { color: '#B91C1C', backgroundColor: '#FEE2E2' }, date: { color: colors.slate, fontSize: 12 },
  review: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 14, padding: 15, gap: 10 }, reviewHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }, answer: { borderTopWidth: 1, borderColor: '#E2E8F0', paddingTop: 12, gap: 4 }, answerQuestion: { color: colors.text, fontWeight: '700', lineHeight: 20 }, answerMarks: { fontWeight: '700', fontSize: 13 }, correct: { color: colors.green }, incorrect: { color: colors.red },
});
