import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Empty, Loading, OutlineButton, Screen, colors } from '@/components/mobile-ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type Upcoming = { id: string; title: string; subject: string | null; scheduled_at: string | null; duration_minutes: number; total_marks: number; batch_ids: string[] | null; batch_id: string; students: number };

export default function UpcomingScreen() {
  const { user, profile } = useAuth(); const [loading, setLoading] = useState(true); const [exams, setExams] = useState<Upcoming[]>([]);
  const load = useCallback(async () => { if (!user || profile?.role !== 'teacher') return; setLoading(true); const { data, error } = await supabase.from('exams').select('id, title, subject, scheduled_at, duration_minutes, total_marks, batch_ids, batch_id').eq('teacher_id', user.id).eq('is_published', true).gte('scheduled_at', new Date().toISOString()).order('scheduled_at'); if (error) Alert.alert('Could not load upcoming exams', error.message); else { const prepared = await Promise.all((data ?? []).map(async (exam) => { const ids = exam.batch_ids?.length ? exam.batch_ids : [exam.batch_id]; const { count } = await supabase.from('batch_enrollments').select('*', { count: 'exact', head: true }).in('batch_id', ids).eq('is_active', true); return { ...exam, students: count ?? 0 } as Upcoming; })); setExams(prepared); } setLoading(false); }, [profile?.role, user]);
  useEffect(() => { void load(); }, [load]);
  if (loading || profile?.role !== 'teacher') return <Loading />;
  return <Screen><View style={styles.header}><View><Text style={styles.title}>Upcoming Exams</Text><Text style={styles.subtitle}>Published tests and assigned student reach.</Text></View><OutlineButton label="Refresh" onPress={() => void load()} /></View>{exams.length ? exams.map((exam) => <View key={exam.id} style={styles.card}><Text style={styles.cardTitle}>{exam.title}</Text><Text style={styles.detail}>{exam.subject || 'General'} · {exam.duration_minutes} min · {exam.total_marks} marks</Text><Text style={styles.info}>{exam.scheduled_at ? new Date(exam.scheduled_at).toLocaleString() : 'Starts immediately'} · {exam.students} enrolled students</Text></View>) : <Empty title="No upcoming exams" detail="Publish a scheduled exam to see it here." />}</Screen>;
}
const styles = StyleSheet.create({ header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, subtitle: { color: colors.slate, marginTop: 4 }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, gap: 5 }, cardTitle: { color: colors.text, fontWeight: '800', fontSize: 16 }, detail: { color: colors.slate, fontSize: 13 }, info: { color: colors.indigo, fontWeight: '700', fontSize: 13 }, });
