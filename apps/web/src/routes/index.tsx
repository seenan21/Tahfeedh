import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUser, homeRouteForRole } from '../lib/auth';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    throw redirect({ to: user ? homeRouteForRole(user.role) : '/login' });
  },
});
