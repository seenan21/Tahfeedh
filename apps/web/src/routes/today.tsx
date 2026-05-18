import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Stack, Text, Title } from '@mantine/core';
import { getCurrentUser, homeRouteForRole } from '../lib/auth';

export const Route = createFileRoute('/today')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    if (!user) throw redirect({ to: '/login' });
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
    return { user };
  },
  component: TodayPage,
});

function TodayPage() {
  const { user } = Route.useRouteContext();

  return (
    <Card maw={720} mx="auto">
      <Stack>
        <Title order={2}>Today</Title>
        <Text>
          Welcome, {user.displayName ?? user.email}. Your daily plan will live here once memorization
          tracking is in (M3).
        </Text>
        <Text size="sm" c="dimmed">
          Role: {user.role}
        </Text>
      </Stack>
    </Card>
  );
}
