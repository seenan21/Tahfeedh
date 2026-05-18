import { createFileRoute, redirect } from '@tanstack/react-router';
import { homeRouteForRole } from '../lib/auth';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/timeline')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: TimelinePage,
});

function TimelinePage() {
  return (
    <EmptyState
      arabic="السجل"
      english="Timeline"
      helper="Your hifz timeline — daily sessions, errors over time, milestones. Lands in M7."
    />
  );
}
