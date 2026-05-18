import { createFileRoute, redirect } from '@tanstack/react-router';
import { Card, Stack, Text, Title } from '@mantine/core';
import { homeRouteForRole } from '../lib/auth';

export const Route = createFileRoute('/_authed/today')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'student') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: TodayPage,
});

function TodayPage() {
  const { user } = Route.useRouteContext();

  return (
    <Card maw={720} mx="auto">
      <Stack>
        <Title order={1}>Today</Title>
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
