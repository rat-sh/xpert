import type { ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

export const colors = {
  indigo: '#4F46E5',
  green: '#15803D',
  red: '#B91C1C',
  slate: '#64748B',
  border: '#E2E8F0',
  background: '#F8FAFC',
  card: '#FFFFFF',
  text: '#0F172A',
};

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'left', 'right', 'bottom'],
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
}) {
  const { width } = useWindowDimensions();
  const content = <View style={[styles.content, { paddingHorizontal: width >= 768 ? 28 : 18 }]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
        {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Loading() {
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.center}>
      <ActivityIndicator size="large" color={colors.indigo} />
    </SafeAreaView>
  );
}

export function Empty({ title, detail }: { title: string; detail: string }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>;
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.primaryButton, disabled && styles.disabled]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

export function OutlineButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={[styles.outlineButton, disabled && styles.disabled]}><Text style={styles.outlineButtonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  keyboard: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: 840, alignSelf: 'center', paddingVertical: 16, gap: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  empty: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 24, alignItems: 'center', gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyDetail: { color: colors.slate, textAlign: 'center', lineHeight: 20 },
  primaryButton: { minHeight: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.indigo, paddingHorizontal: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  outlineButton: { minHeight: 44, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE', paddingHorizontal: 14 },
  outlineButtonText: { color: colors.indigo, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
