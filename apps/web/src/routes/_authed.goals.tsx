import { createFileRoute, redirect } from '@tanstack/react-router';
import { homeRouteForRole } from '../lib/auth';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/goals')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: GoalsPage,
});

function GoalsPage() {
  return (
    <EmptyState
      arabic="الأهداف"
      english="Goals"
      helper="Long-term hifz targets and QF Goals integration. Lands in M8."
    />
  );
}
