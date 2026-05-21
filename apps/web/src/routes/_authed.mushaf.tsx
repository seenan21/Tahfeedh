import { createFileRoute, redirect } from '@tanstack/react-router';
import { homeRouteForRole } from '../lib/auth';
import { StudentMushafSurface } from '../mushaf/StudentMushafSurface';

export const Route = createFileRoute('/_authed/mushaf')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: MushafRoute,
});

function MushafRoute() {
  const { user } = Route.useRouteContext();
  return <StudentMushafSurface studentId={user.id} viewerRole="self" />;
}
