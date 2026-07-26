import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export async function pickAndUploadExamImage(): Promise<{ url?: string; error?: string } | null> {
  const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, base64: true, quality: 0.9 });
  if (selected.canceled) return null;
  const image = selected.assets[0];
  if (!image.base64) return { error: 'The selected image could not be read.' };
  try {
    const contentType = image.mimeType ?? 'image/jpeg';
    const bytes = await (await fetch(`data:${contentType};base64,${image.base64}`)).arrayBuffer();
    const extension = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const path = `exam-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
    const { error } = await supabase.storage.from('exam-images').upload(path, bytes, { contentType, upsert: true });
    if (error) return { error: error.message };
    return { url: supabase.storage.from('exam-images').getPublicUrl(path).data.publicUrl };
  } catch {
    return { error: 'Could not upload this image.' };
  }
}
