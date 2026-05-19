import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Anchor, Badge, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { GraduationCap, Sparkles } from 'lucide-react';
import type { TestRating, TestStatus, TestType } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import { TestCreationModal } from '../features/live-test/TestCreationModal';

interface RecentTestRow {
  id: string;
  test_type: TestType;
  status: TestStatus;
  rating: TestRating | null;
  ended_at: string | null;
  ranges: unknown;
}

export const Route = createFileRoute('/_authed/tests/')({
  component: TestsPage,
});

function TestsPage() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [opened, setOpened] = useState(false);
  const [latest, setLatest] = useState<RecentTestRow | null>(null);
  const [openInProgress, setOpenInProgress] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('test')
      .select('id, test_type, status, rating, ended_at, ranges')
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const open = data.find((d) => d.status === 'in_progress');
        if (open) setOpenInProgress(open.id);
        const recent = data.find((d) => d.status === 'completed') ?? null;
        setLatest(recent as RecentTestRow | null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container size="md" py="lg">
      <Stack gap="lg">
        <Stack gap={4}>
          <Text size="xs" tt="uppercase" c="parchment.0" fw={700} lts={0.8} style={{ opacity: 0.85 }}>
            Tests
          </Text>
          <Group gap="xs" align="center">
            <GraduationCap size={26} color="var(--mantine-color-parchment-0)" />
            <Title order={2} c="parchment.0">
              Witnessed tests
            </Title>
            <Badge variant="filled" color="sage.7">
              Phase D
            </Badge>
          </Group>
          <Text c="parchment.0" size="sm" style={{ opacity: 0.75 }}>
            الاختبارات · Witnessed tests are how a page moves from in-progress to memorized.
          </Text>
        </Stack>

        <Card withBorder radius="md" p="lg">
          <Stack gap="sm">
            <Group gap={6}>
              <Sparkles size={16} color="var(--mantine-color-honey-7)" />
              <Text fw={700}>
                {openInProgress ? 'You have a test in progress' : 'Begin a guest-witnessed test'}
              </Text>
            </Group>
            <Text size="sm" c="dimmed">
              {openInProgress
                ? 'Resume your live test to keep logging errors, then end with a rating.'
                : 'Find a witness — a teacher, parent, or anyone who hears Quran — and run a live test. Self-administered tests aren’t tests (ADR 0004).'}
            </Text>
            <Group>
              {openInProgress ? (
                <Button
                  color="sage"
                  onClick={() =>
                    navigate({ to: '/tests/$testId', params: { testId: openInProgress } })
                  }
                >
                  Resume test
                </Button>
              ) : (
                <Button color="sage" onClick={() => setOpened(true)}>
                  Begin test
                </Button>
              )}
            </Group>
          </Stack>
        </Card>

        {latest && (
          <Card withBorder radius="md" p="md">
            <Group justify="space-between">
              <Stack gap={2}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Most recent test
                </Text>
                <Text size="sm">
                  {latest.test_type === 'newly_memorized' ? 'New lesson' : 'Revision'} ·{' '}
                  {latest.ended_at ? new Date(latest.ended_at).toLocaleString() : '—'} ·{' '}
                  {latest.rating ?? '—'}
                </Text>
              </Stack>
              <Anchor size="sm" onClick={() => navigate({ to: '/today' })}>
                View on Today →
              </Anchor>
            </Group>
          </Card>
        )}
      </Stack>

      <TestCreationModal
        opened={opened}
        onClose={() => setOpened(false)}
        onCreated={(id) => navigate({ to: '/tests/$testId', params: { testId: id } })}
        studentId={user.id}
      />
    </Container>
  );
}
