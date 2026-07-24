import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types matching DB schema
export type UserRole = 'teacher' | 'student';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  created_at: string;
}

export interface Teacher {
  id: string;
  institution_name: string | null;
  plan: 'free' | 'pro';
}

export interface Batch {
  id: string;
  teacher_id: string;
  name: string;
  subject: string | null;
  join_code: string;
  is_active: boolean;
  created_at: string;
}

export interface Exam {
  id: string;
  batch_id: string;           // legacy – kept for backward compat
  teacher_id: string;
  title: string;
  subject: string | null;
  duration_minutes: number;
  total_marks: number;
  negative_marking: boolean;         // legacy – kept in DB, removed from UI
  negative_marks_per_wrong: number;  // legacy – kept in DB, removed from UI
  is_published: boolean;
  scheduled_at: string | null;
  created_at: string;
  allow_pyq?: boolean;
  // New fields
  batch_ids?: string[];              // multi-batch assignment
  no_reverse_back?: boolean;         // prevent student from going back
  per_question_time_seconds?: number | null;  // auto-advance timer
  exam_key?: string | null;          // access key for students
  exam_pin?: string | null;          // PIN for students
  status?: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
  is_instant?: boolean;
  instant_expires_at?: string | null;
  // joined relations
  batches?: Batch;
}

export interface AnonymousStudent {
  id: string;
  student_code: string;
  name: string;
  created_at?: string;
}

export interface Question {
  id: string;
  exam_id: string | null;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'numerical' | 'theoretical';
  options: string[] | null;
  correct_answer: string | null;
  marks: number;
  chapter_tag: string | null;  // legacy – kept in DB, removed from UI
  difficulty: 'easy' | 'medium' | 'hard' | null;
  order_index: number;
  is_pyq: boolean;
  // New fields
  positive_marks?: number;           // marks awarded for correct answer
  negative_marks?: number;           // marks deducted for wrong answer
  option_images?: (string | null)[] | null; // Supabase Storage URLs per option
  question_image?: string | null;    // URL for question body image
  section_title?: string | null;
}

export interface ExamSubmission {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  total_score: number | null;
  tab_switch_count: number;
  exams?: Exam;
  users?: UserProfile;
  batches?: Batch;
  submission_answers?: SubmissionAnswer[];
}

export interface SubmissionAnswer {
  id: string;
  submission_id: string;
  question_id: string;
  student_answer: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  questions?: Question;
}
