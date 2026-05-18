import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUser, landingRouteForUser } from '../lib/auth';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    throw redirect({ to: user ? landingRouteForUser(user) : '/login' });
  },
});
