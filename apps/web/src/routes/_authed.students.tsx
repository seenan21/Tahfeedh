import { createFileRoute, redirect } from '@tanstack/react-router';
import { homeRouteForRole } from '../lib/auth';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/students')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'teacher') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: StudentsPage,
});

function StudentsPage() {
  const { user } = Route.useRouteContext();
  return (
    <EmptyState
      arabic="الطلاب"
      english="Students"
      helper={`Welcome, ${user.displayName ?? user.email}. Enrolled students will appear here once the enrollment flow is in (M6).`}
    />
  );
}
