import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Loading, PrimaryButton, Screen, colors } from '@/components/mobile-ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useAuth(); const [name, setName] = useState(profile?.full_name ?? ''); const [saving, setSaving] = useState(false);
  if (!profile) return <Loading />;
  const save = async () => { setSaving(true); const { error } = await supabase.from('users').update({ full_name: name.trim() }).eq('id', profile.id); setSaving(false); if (error) Alert.alert('Could not update profile', error.message); else { await refreshProfile(); Alert.alert('Saved', 'Your profile has been updated.'); } };
  return <Screen><Text style={styles.title}>Profile</Text><View style={styles.card}><Text style={styles.label}>Name</Text><TextInput value={name} onChangeText={setName} style={styles.input} /><Text style={styles.label}>Email</Text><Text style={styles.value}>{profile.email || 'No email'}</Text><Text style={styles.label}>Role</Text><Text style={styles.value}>{profile.role}</Text><PrimaryButton label={saving ? 'Saving…' : 'Save profile'} onPress={() => void save()} disabled={saving || !name.trim()} /></View></Screen>;
}
const styles = StyleSheet.create({ title: { color: colors.text, fontSize: 24, fontWeight: '800' }, card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 15, gap: 9 }, label: { color: colors.slate, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }, value: { color: colors.text, fontSize: 16, marginBottom: 4 }, input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, color: colors.text, fontSize: 16 }, });
