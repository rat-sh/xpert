import type { Metadata } from 'next';
import { StudentJoinPage } from '@/features/student-join/components/StudentJoinPage';

export const metadata: Metadata = {
  title: 'Join Xpert — Student Account',
  description: 'Create a student account or join a teacher batch using your join code.',
};

export default function StudentJoinRoute() {
  return <StudentJoinPage />;
}
