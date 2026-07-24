'use client';

const STORAGE_KEY = 'xpert_student_session';

export interface StudentSession {
  id: string;
  student_code: string;
  name: string;
  phone?: string;
}

export function getStudentSession(): StudentSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudentSession;
  } catch {
    return null;
  }
}

export function setStudentSession(session: StudentSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearStudentSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function generateStudentCodeLocal(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'STU-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
