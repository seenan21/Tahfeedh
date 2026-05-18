import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Stack, Text, Title } from '@mantine/core';
import { getCurrentUser, homeRouteForRole } from '../lib/auth';

export const Route = createFileRoute('/students')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery({
      queryKey: ['session'],
      queryFn: getCurrentUser,
    });
    if (!user) throw redirect({ to: '/login' });
    if (user.role !== 'teacher') throw redirect({ to: homeRouteForRole(user.role) });
    return { user };
  },
  component: StudentsPage,
});

function StudentsPage() {
  const { user } = Route.useRouteContext();

  return (
    <Card maw={720} mx="auto">
      <Stack>
        <Title order={2}>Students</Title>
        <Text>
          Welcome, {user.displayName ?? user.email}. Your enrolled students will live here once the
          enrollment flow is in (M6).
        </Text>
        <Text size="sm" c="dimmed">
          Role: {user.role}
        </Text>
      </Stack>
    </Card>
  );
}
