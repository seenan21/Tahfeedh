import { createFileRoute, redirect } from '@tanstack/react-router';
import { LayoutGrid } from 'lucide-react';
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
      icon={LayoutGrid}
      tag="Phase E · M6"
      helper="Class and halaqah management for teachers."
    />
  );
}
