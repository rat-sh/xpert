import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Empty, Loading, OutlineButton, Screen, colors } from '@/components/mobile-ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type BankQuestion = { id: string; question_text: string; question_type: string; marks: number; difficulty: string | null; chapter_tag: string | null; is_pyq: boolean; exams: { title: string } | null };

export default function BankScreen() {
  const router = useRouter(); const { user, profile } = useAuth(); const [loading, setLoading] = useState(true); const [questions, setQuestions] = useState<BankQuestion[]>([]); const [search, setSearch] = useState('');
  const load = useCallback(async () => { if (!user || profile?.role !== 'teacher') return; setLoading(true); const { data } = await supabase.from('questions').select('id, question_text, question_type, marks, difficulty, chapter_tag, is_pyq, exams!inner(title, teacher_id)').eq('exams.teacher_id', user.id).order('created_at', { ascending: false }); setQuestions((data ?? []).map((question) => ({ ...question, exams: Array.isArray(question.exams) ? question.exams[0] : question.exams })) as BankQuestion[]); setLoading(false); }, [profile?.role, user]);
  useEffect(() => { void load(); }, [load]);
  if (loading || profile?.role !== 'teacher') return <Loading />;
  const filtered = questions.filter((question) => `${question.question_text} ${question.chapter_tag ?? ''} ${question.exams?.title ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <Screen><View style={styles.header}><View><Text style={styles.title}>Question Bank</Text><Text style={styles.subtitle}>{questions.length} reusable questions from your exams.</Text></View><OutlineButton label="Build exam" onPress={() => router.push('/teacher/exam-builder')} /></View><TextInput value={search} onChangeText={setSearch} placeholder="Search question, chapter, or exam" style={styles.input} />{filtered.length ? filtered.map((question) => <View key={question.id} style={styles.card}><Text style={styles.question}>{question.question_text}</Text><Text style={styles.detail}>{question.question_type} · {question.marks} marks · {question.difficulty ?? 'medium'}{question.is_pyq ? ' · PYQ' : ''}</Text><Text style={styles.detail}>{question.chapter_tag || 'General'} · {question.exams?.title ?? 'Exam'}</Text></View>) : <Empty title="No questions found" detail="Build an exam or import a document with AI to create questions." />}</Screen>;
}
const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, subtitle: { color: colors.slate, marginTop: 4 }, input: { minHeight: 48, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, gap: 6 }, question: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 21 }, detail: { color: colors.slate, fontSize: 12 }, });
