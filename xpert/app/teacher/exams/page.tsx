import type { Metadata } from 'next';
import { ExamCreatorPage } from '@/features/exam-creator/components/ExamCreatorPage';

export const metadata: Metadata = {
  title: 'Exams — Xpert Teacher',
  description: 'Create and manage exams for your batches.',
};

export default function TeacherExamsRoute() {
  return <ExamCreatorPage />;
}
