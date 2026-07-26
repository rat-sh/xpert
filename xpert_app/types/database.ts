export type UserRole = 'teacher' | 'student' | 'parent';

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  preferred_language?: 'en' | 'hi';
  date_of_birth?: string | null;
  pin_hash?: string | null;
  pin_set_at?: string | null;
  created_at: string;
}

export interface Teacher {
  id: string;
  institution_name: string | null;
  upi_id?: string | null;
  upi_qr_url?: string | null;
  plan: 'free' | 'pro';
  plan_expires_at?: string | null;
  created_at?: string;
}

export interface Batch {
  id: string;
  teacher_id: string;
  name: string;
  subject: string | null;
  board?: 'cbse' | 'icse' | 'jee' | 'neet' | 'state' | 'aptitude' | null;
  join_code: string;
  is_active: boolean;
  academic_year?: string | null;
  created_at: string;
}

export interface BatchEnrollment {
  id: string;
  batch_id: string;
  student_id: string;
  enrolled_at: string;
  is_active: boolean;
}

export interface Exam {
  id: string;
  batch_id: string;
  teacher_id: string;
  title: string;
  subject: string | null;
  exam_type?: 'test' | 'pyq_practice' | 'mock';
  board_tag?: 'cbse' | 'icse' | 'jee' | 'neet' | 'state' | 'aptitude' | null;
  duration_minutes: number;
  total_marks: number;
  negative_marking: boolean;
  negative_marks_per_wrong: number;
  exam_key?: string | null;
  exam_pin?: string | null;
  share_link?: string | null;
  batch_ids?: string[];
  is_published: boolean;
  status?: 'draft' | 'scheduled' | 'active' | 'completed' | 'archived';
  allow_pyq?: boolean;
  no_reverse_back?: boolean;
  per_question_time_seconds?: number | null;
  is_instant?: boolean;
  instant_expires_at?: string | null;
  scheduled_at: string | null;
  created_at: string;
  batches?: Batch;
}

export interface Question {
  id: string;
  exam_id: string | null;
  pyq_bank_id?: string | null;
  question_text: string;
  question_type: 'mcq' | 'true_false' | 'numerical' | 'theoretical';
  options: string[] | null;
  correct_answer: string | null;
  marks: number;
  positive_marks?: number;
  negative_marks?: number;
  option_images?: (string | null)[] | null;
  question_image?: string | null;
  chapter_tag?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard' | null;
  order_index: number;
  is_pyq: boolean;
  section_title?: string | null;
  created_at?: string;
}

export interface ExamSubmission {
  id: string;
  exam_id: string;
  student_id: string;
  started_at: string;
  submitted_at: string | null;
  server_end_time?: string | null;
  total_score: number | null;
  percentage?: number | null;
  rank_in_batch?: number | null;
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

export interface CalendarSchedule {
  id: string;
  teacher_id: string;
  batch_name: string;
  subject: string;
  schedule_date: string;
  start_time: string;
  duration: string;
  type: 'class' | 'exam';
  created_at: string;
}
