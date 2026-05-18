import { createFileRoute, redirect } from '@tanstack/react-router';
import { homeRouteForRole } from '../lib/auth';
import { EmptyState } from '../components/EmptyState';

export const Route = createFileRoute('/_authed/mushaf')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: MushafPage,
});

function MushafPage() {
  return (
    <EmptyState
      arabic="مصحفي"
      english="My Mushaf"
      helper="The 604-page grid coloured by memorization status, with deep-dive into any page. Phase C."
    />
  );
}
