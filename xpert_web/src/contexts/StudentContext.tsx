'use client';
import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getStudentSession, setStudentSession, clearStudentSession, StudentSession } from '@/lib/studentSession';

interface StudentContextType {
  student: StudentSession | null;
  loading: boolean;
  register: (name: string, phone?: string) => Promise<StudentSession | null>;
  joinBatch: (joinCode: string) => Promise<boolean>;
  signOut: () => void;
  refresh: () => void;
}

const StudentContext = createContext<StudentContextType>({
  student: null,
  loading: true,
  register: async () => null,
  joinBatch: async () => false,
  signOut: () => {},
  refresh: () => {},
});

export function StudentProvider({ children }: { children: ReactNode }) {
  // Lazy initialiser: reads localStorage synchronously on first render — no effect needed.
  const [student, setStudent] = useState<StudentSession | null>(() => getStudentSession());
  const [loading] = useState(false);

  // Kept in context API so consumers can call refresh() after an external session change.
  const refresh = useCallback(() => {
    setStudent(getStudentSession());
  }, []);

  const register = async (name: string, phone?: string): Promise<StudentSession | null> => {
    const { data, error } = await supabase.rpc('register_student', {
      p_name: name,
      p_phone: phone ?? null,
    });
    if (error || !data?.[0]) return null;
    const row = data[0] as { id: string; student_code: string; name: string };
    const session: StudentSession = { id: row.id, student_code: row.student_code, name: row.name, phone };
    setStudentSession(session);
    setStudent(session);
    return session;
  };

  const joinBatch = async (joinCode: string): Promise<boolean> => {
    const sess = student ?? getStudentSession();
    if (!sess) return false;
    const { error } = await supabase.rpc('join_batch_as_student', {
      p_join_code: joinCode.trim(),
      p_student_id: sess.id,
    });
    if (error) {
      console.error('join_batch_as_student failed:', error);
      return false;
    }
    return true;
  };

  const signOut = () => {
    clearStudentSession();
    setStudent(null);
  };

  return (
    <StudentContext.Provider value={{ student, loading, register, joinBatch, signOut, refresh }}>
      {children}
    </StudentContext.Provider>
  );
}

export const useStudent = () => useContext(StudentContext);
