import { createFileRoute, redirect } from '@tanstack/react-router';
import { homeRouteForRole } from '../lib/auth';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/groups')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'teacher') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: GroupsPage,
});

function GroupsPage() {
  return (
    <EmptyState
      arabic="الحلقات"
      english="Groups"
      helper="Class and halaqah management. Lands in M6."
    />
  );
}
