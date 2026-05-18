import { createFileRoute, redirect } from '@tanstack/react-router';
import { Target } from 'lucide-react';
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
      icon={Target}
      tag="Phase E · M8"
      helper="Long-term hifz targets, paired with the Quran Foundation Goals API once OAuth lands."
    />
  );
}
