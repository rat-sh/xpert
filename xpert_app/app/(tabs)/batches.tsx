import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Empty, Loading, OutlineButton, PrimaryButton, Screen, colors } from '@/components/mobile-ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

type TeacherBatch = { id: string; name: string; subject: string | null; join_code: string; studentCount: number };
type StudentBatch = { id: string; name: string; subject: string | null; teacherName: string };
type Student = { id: string; full_name: string; phone: string | null; batchId: string };

export default function BatchesScreen() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<TeacherBatch[]>([]);
  const [studentBatches, setStudentBatches] = useState<StudentBatch[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [classTime, setClassTime] = useState('');
  const [classDuration, setClassDuration] = useState('1 hour');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!profile || !user) return;
    setLoading(true);
    if (profile.role === 'teacher') {
      const { data: batchRows } = await supabase.from('batches').select('id, name, subject, join_code').eq('teacher_id', user.id).order('created_at', { ascending: false });
      const rows = batchRows ?? [];
      const members: Student[] = [];
      const withCounts = await Promise.all(rows.map(async (batch) => {
        const { data: enrollments } = await supabase.from('batch_enrollments').select('student_id, users(full_name, phone)').eq('batch_id', batch.id).eq('is_active', true);
        (enrollments ?? []).forEach((enrollment) => {
          const person = Array.isArray(enrollment.users) ? enrollment.users[0] : enrollment.users;
          members.push({ id: enrollment.student_id, full_name: person?.full_name ?? 'Student', phone: person?.phone ?? null, batchId: batch.id });
        });
        return { ...batch, studentCount: (enrollments ?? []).length };
      }));
      setBatches(withCounts);
      setStudents(members);
    } else {
      const { data } = await supabase.from('batch_enrollments').select('batches(id, name, subject, teacher_id)').eq('student_id', user.id).eq('is_active', true);
      const raw = (data ?? []).map((row) => Array.isArray(row.batches) ? row.batches[0] : row.batches).filter(Boolean) as unknown as { id: string; name: string; subject: string | null; teacher_id: string }[];
      const teacherIds = [...new Set(raw.map((batch) => batch.teacher_id))];
      const { data: teachers } = teacherIds.length ? await supabase.from('users').select('id, full_name').in('id', teacherIds) : { data: [] };
      const teacherNames = new Map((teachers ?? []).map((teacher) => [teacher.id, teacher.full_name]));
      setStudentBatches(raw.map((batch) => ({ id: batch.id, name: batch.name, subject: batch.subject, teacherName: teacherNames.get(batch.teacher_id) ?? 'Your teacher' })));
    }
    setLoading(false);
  }, [profile, user]);

  useEffect(() => { void load(); }, [load]);

  const createBatch = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    const prefix = name.replace(/\s+/g, '').slice(0, 3).toUpperCase() || 'BCH';
    const code = `${prefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const { error } = await supabase.from('batches').insert({ teacher_id: user.id, name: name.trim(), subject: subject.trim() || null, join_code: code, is_active: true });
    setSaving(false);
    if (error) Alert.alert('Could not create batch', error.message);
    else {
      if (classTime && startDate && endDate && selectedDays.length) {
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${endDate}T00:00:00`);
        const rows: { teacher_id: string; batch_name: string; subject: string; schedule_date: string; start_time: string; duration: string; type: 'class' }[] = [];
        for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
          if (selectedDays.includes(cursor.getDay())) rows.push({ teacher_id: user.id, batch_name: name.trim(), subject: subject.trim() || name.trim(), schedule_date: cursor.toISOString().slice(0, 10), start_time: classTime, duration: classDuration || '1 hour', type: 'class' });
        }
        if (rows.length) {
          const { error: scheduleError } = await supabase.from('calendar_schedules').insert(rows);
          if (scheduleError) Alert.alert('Batch created', `Calendar sessions could not be added: ${scheduleError.message}`);
          else Alert.alert('Batch created', `${rows.length} recurring classes were added to your calendar.`);
        }
      }
      setName(''); setSubject(''); setClassTime(''); setClassDuration('1 hour'); setStartDate(''); setEndDate(''); setSelectedDays([]); setShowCreate(false); void load();
    }
  };

  const joinBatch = async () => {
    if (!joinCode.trim()) return;
    setSaving(true);
    const { error } = await supabase.rpc('join_batch_by_code', { p_join_code: joinCode.trim() });
    setSaving(false);
    if (error) Alert.alert('Could not join batch', error.message);
    else { setJoinCode(''); void load(); }
  };

  const removeStudent = (student: Student) => Alert.alert('Remove student', `Remove ${student.full_name} from this batch?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => void (async () => {
      const { error } = await supabase.from('batch_enrollments').update({ is_active: false }).eq('batch_id', student.batchId).eq('student_id', student.id);
      if (error) Alert.alert('Could not remove student', error.message); else void load();
    })() },
  ]);
  const deleteBatch = (batch: TeacherBatch) => Alert.alert('Delete batch', `Delete ${batch.name}? This removes its enrolments and associated records.`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void (async () => {
      const { error } = await supabase.from('batches').delete().eq('id', batch.id);
      if (error) Alert.alert('Could not delete batch', error.message); else void load();
    })() },
  ]);

  if (!profile) return <Loading />;
  if (loading) return <Loading />;
  if (profile.role === 'student') return <Screen><Text style={styles.title}>My Batches</Text><Text style={styles.subtitle}>Join your teacher&apos;s batches and receive their exams.</Text>{studentBatches.length ? studentBatches.map((batch) => <View key={batch.id} style={styles.card}><Text style={styles.cardTitle}>{batch.name}</Text><Text style={styles.detail}>{batch.subject || 'General'} · {batch.teacherName}</Text></View>) : <Empty title="No batches joined" detail="Ask your teacher for a batch code, then add it below." />}<TextInput value={joinCode} onChangeText={setJoinCode} placeholder="Enter batch code" autoCapitalize="characters" style={styles.input} /><PrimaryButton label={saving ? 'Joining…' : 'Join batch'} onPress={() => void joinBatch()} disabled={saving || !joinCode.trim()} /></Screen>;

  return <Screen><View style={styles.header}><View><Text style={styles.title}>Students & Batches</Text><Text style={styles.subtitle}>Monitor enrolment and share each batch&apos;s join code.</Text></View><OutlineButton label={showCreate ? 'Close' : 'Create'} onPress={() => setShowCreate((value) => !value)} /></View>{showCreate && <View style={styles.form}><Text style={styles.formTitle}>Create a batch</Text><TextInput value={name} onChangeText={setName} placeholder="Batch name" style={styles.input} /><TextInput value={subject} onChangeText={setSubject} placeholder="Subject (optional)" style={styles.input} /><Text style={styles.scheduleTitle}>Recurring classes (optional)</Text><TextInput value={classTime} onChangeText={setClassTime} placeholder="Class time: 18:00" style={styles.input} /><TextInput value={classDuration} onChangeText={setClassDuration} placeholder="Duration" style={styles.input} /><View style={styles.dateRow}><TextInput value={startDate} onChangeText={setStartDate} placeholder="Start: YYYY-MM-DD" style={[styles.input, styles.dateInput]} /><TextInput value={endDate} onChangeText={setEndDate} placeholder="End: YYYY-MM-DD" style={[styles.input, styles.dateInput]} /></View><View style={styles.days}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => <Pressable key={day} onPress={() => setSelectedDays((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])} style={[styles.day, selectedDays.includes(index) && styles.dayActive]}><Text style={[styles.dayText, selectedDays.includes(index) && styles.dayTextActive]}>{day}</Text></Pressable>)}</View><PrimaryButton label={saving ? 'Creating…' : 'Create batch'} onPress={() => void createBatch()} disabled={saving || !name.trim()} /></View>}{batches.length ? batches.map((batch) => <View key={batch.id} style={styles.card}><View style={styles.row}><View style={styles.grow}><Text style={styles.cardTitle}>{batch.name}</Text><Text style={styles.detail}>{batch.subject || 'General'} · {batch.studentCount} student{batch.studentCount === 1 ? '' : 's'}</Text></View><Text style={styles.code}>{batch.join_code}</Text></View>{students.filter((student) => student.batchId === batch.id).map((student) => <Pressable key={`${batch.id}-${student.id}`} onLongPress={() => removeStudent(student)} style={styles.student}><View><Text style={styles.studentName}>{student.full_name}</Text><Text style={styles.detail}>{student.phone || 'No phone'}</Text></View><Text style={styles.remove}>Hold to remove</Text></Pressable>)}<Pressable onPress={() => deleteBatch(batch)} style={styles.deleteBatch}><Text style={styles.deleteBatchText}>Delete batch</Text></Pressable></View>) : <Empty title="No batches yet" detail="Create your first batch to start enrolling students." />}</Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }, grow: { flex: 1 }, title: { color: colors.text, fontSize: 24, fontWeight: '800' }, subtitle: { color: colors.slate, lineHeight: 20, marginTop: 4 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, gap: 12 }, row: { flexDirection: 'row', gap: 12, alignItems: 'center' }, cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, detail: { color: colors.slate, fontSize: 13, marginTop: 3 }, code: { color: colors.indigo, fontWeight: '800', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 7 },
  form: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 14, padding: 15, gap: 10 }, formTitle: { color: colors.text, fontWeight: '800', fontSize: 16 }, scheduleTitle: { color: colors.text, fontWeight: '700', marginTop: 4 }, input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 48, paddingHorizontal: 13, fontSize: 15, color: colors.text }, dateRow: { flexDirection: 'row', gap: 8 }, dateInput: { flex: 1 }, days: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, day: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, dayActive: { borderColor: colors.indigo, backgroundColor: '#EEF2FF' }, dayText: { color: colors.slate, fontSize: 12, fontWeight: '700' }, dayTextActive: { color: colors.indigo },
  student: { borderTopWidth: 1, borderColor: '#F1F5F9', paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, studentName: { color: colors.text, fontWeight: '700' }, remove: { color: '#DC2626', fontSize: 12, fontWeight: '700' }, deleteBatch: { alignSelf: 'flex-start', paddingVertical: 4 }, deleteBatchText: { color: '#B91C1C', fontWeight: '800', fontSize: 13 },
});
