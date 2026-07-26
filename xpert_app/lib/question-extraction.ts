import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';

export type ExtractedQuestion = {
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'numerical' | 'theoretical';
  options: string[];
  correct_answer: string;
  marks: number;
  positive_marks: number;
  negative_marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
  chapter_tag?: string;
  section_title?: string;
};

export async function pickAndExtractQuestions(): Promise<{ questions: ExtractedQuestion[]; error?: string } | null> {
  const selected = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    copyToCacheDirectory: true,
  });
  if (selected.canceled) return null;

  const asset = selected.assets[0];
  const webAppUrl = (
    process.env.EXPO_PUBLIC_WEB_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://xpert-asb6.onrender.com'
  ).replace(/\/$/, '');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { questions: [], error: 'Sign in again before importing questions.' };

  try {
    const localFile = await fetch(asset.uri);
    const blob = await localFile.blob();
    const form = new FormData();
    form.append('file', blob, asset.name);
    const response = await fetch(`${webAppUrl}/api/questions/extract`, { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body: form });
    const result = await response.json() as { questions?: ExtractedQuestion[]; error?: string };
    if (!response.ok || !result.questions?.length) return { questions: [], error: result.error ?? 'No questions could be extracted.' };
    return { questions: result.questions };
  } catch {
    return { questions: [], error: 'Could not upload this document for extraction.' };
  }
}
