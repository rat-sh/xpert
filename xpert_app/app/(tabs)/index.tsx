import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, Empty, Loading, OutlineButton, PrimaryButton, Screen } from '@/components/mobile-ui';
import { type AppRole, useAuth } from '@/providers/auth-provider';

export default function HomeScreen() {
  const router = useRouter();
  const { configured, loading, profile, user, signIn, signOut, signUp } = useAuth();
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState<AppRole>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ batches: 0, exams: 0, results: 0 });

  useEffect(() => {
    if (!user || !profile) return;
    const load = async () => {
      if (profile.role === 'teacher') {
        const { data: batches } = await supabase.from('batches').select('id').eq('teacher_id', user.id);
        const batchIds = (batches ?? []).map((batch) => batch.id);
        const [{ count: exams }, { count: results }] = await Promise.all([
          supabase.from('exams').select('*', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('exam_submissions').select('*', { count: 'exact', head: true }).not('submitted_at', 'is', null),
        ]);
        setStats({ batches: batchIds.length, exams: exams ?? 0, results: results ?? 0 });
      } else {
        const [{ count: batches }, { count: results }] = await Promise.all([
          supabase.from('batch_enrollments').select('*', { count: 'exact', head: true }).eq('student_id', user.id).eq('is_active', true),
          supabase.from('exam_submissions').select('*', { count: 'exact', head: true }).eq('student_id', user.id).not('submitted_at', 'is', null),
        ]);
        setStats({ batches: batches ?? 0, exams: 0, results: results ?? 0 });
      }
    };
    void load();
  }, [profile, user]);

  const submit = async () => {
    setSubmitting(true);
    const error = registering
      ? await signUp(fullName, email, password, role)
      : await signIn(email, password);
    setSubmitting(false);
    if (error) Alert.alert('Could not continue', error);
    else if (registering) Alert.alert('Check your email', 'Confirm your email address, then sign in.');
  };

  if (loading) return <Loading />;
  if (!configured) return <Screen><Empty title="Connect Supabase" detail="Copy .env.example to .env and set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY." /></Screen>;

  if (!user || !profile) return <Screen><View style={styles.hero}><Text style={styles.brand}>Xpert</Text><Text style={styles.subtitle}>Smart batch monitoring and secure exams.</Text></View>{registering && <><TextInput value={fullName} onChangeText={setFullName} placeholder="Full name" style={styles.input} autoCapitalize="words" /><View style={styles.roleRow}>{(['student', 'teacher'] as AppRole[]).map((item) => <Pressable key={item} onPress={() => setRole(item)} style={[styles.role, role === item && styles.roleActive]}><Text style={[styles.roleText, role === item && styles.roleTextActive]}>{item === 'student' ? 'Student' : 'Teacher'}</Text></Pressable>)}</View></>}<TextInput value={email} onChangeText={setEmail} placeholder="Email" style={styles.input} autoCapitalize="none" keyboardType="email-address" /><TextInput value={password} onChangeText={setPassword} placeholder="Password" style={styles.input} secureTextEntry /><PrimaryButton label={submitting ? 'Please wait…' : registering ? 'Create account' : 'Sign in'} onPress={() => void submit()} disabled={submitting || !email || !password || (registering && !fullName)} /><OutlineButton label={registering ? 'I already have an account' : 'Create a new account'} onPress={() => setRegistering((value) => !value)} /></Screen>;

  const label = profile.role === 'teacher' ? 'Teacher portal' : 'Student portal';
  return <Screen><View style={styles.hero}><Text style={styles.brand}>Welcome, {profile.full_name.split(' ')[0]}</Text><Text style={styles.subtitle}>{label}</Text></View><View style={styles.statGrid}>{[{ label: 'Batches', value: stats.batches }, { label: profile.role === 'teacher' ? 'Exams' : 'Results', value: profile.role === 'teacher' ? stats.exams : stats.results }, { label: profile.role === 'teacher' ? 'Submissions' : 'Completed', value: stats.results }].map((stat) => <View key={stat.label} style={styles.stat}><Text style={styles.statValue}>{stat.value}</Text><Text style={styles.statLabel}>{stat.label}</Text></View>)}</View><View style={styles.card}><Text style={styles.cardTitle}>{profile.role === 'teacher' ? 'Run your batch from mobile' : 'Your batches and exams'}</Text><Text style={styles.cardDetail}>{profile.role === 'teacher' ? 'Use Batches to monitor students, Exams to publish tests, and Results to review submissions.' : 'Join batches, take teacher-assigned exams, and review results.'}</Text></View>{profile.role === 'teacher' && <View style={styles.actionGrid}>{[{ label: 'Calendar', route: '/teacher/calendar' }, { label: 'Upcoming Exams', route: '/teacher/upcoming' }, { label: 'Question Bank', route: '/teacher/bank' }, { label: 'Profile', route: '/teacher/profile' }].map((action) => <Pressable key={action.label} onPress={() => router.push(action.route as never)} style={styles.action}><Text style={styles.actionText}>{action.label}</Text></Pressable>)}</View>}<OutlineButton label="Sign out" onPress={() => void signOut()} /></Screen>;
}

const styles = StyleSheet.create({
  hero: { gap: 6, marginTop: 12 }, brand: { color: colors.text, fontSize: 28, fontWeight: '800' }, subtitle: { color: colors.slate, fontSize: 15 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, minHeight: 50, fontSize: 16, color: colors.text },
  roleRow: { flexDirection: 'row', gap: 10 }, role: { flex: 1, minHeight: 46, borderWidth: 1, borderColor: colors.border, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }, roleActive: { backgroundColor: '#EEF2FF', borderColor: colors.indigo }, roleText: { color: colors.slate, fontWeight: '700' }, roleTextActive: { color: colors.indigo },
  statGrid: { flexDirection: 'row', gap: 10 }, stat: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 4 }, statValue: { color: colors.text, fontWeight: '800', fontSize: 24 }, statLabel: { color: colors.slate, fontSize: 12 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 6 }, cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' }, cardDetail: { color: colors.slate, lineHeight: 20 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, action: { width: '48%', minHeight: 72, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C7D2FE', borderRadius: 12, justifyContent: 'center', paddingHorizontal: 12 }, actionText: { color: colors.indigo, fontWeight: '800' },
});
