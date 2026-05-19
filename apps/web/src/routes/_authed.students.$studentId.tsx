import { useState } from 'react';
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { ArrowLeft, Flame, GraduationCap, History, Play } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { TestRating, TestType } from '@tahfeedh/shared';
import { homeRouteForRole } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ActivityStatsCard } from '../features/progress/ActivityStatsCard';
import { ForecastCard } from '../features/progress/ForecastCard';
import { RevisionHealthGrid } from '../features/progress/RevisionHealthGrid';
import { TestCreationModal } from '../features/live-test/TestCreationModal';

export const Route = createFileRoute('/_authed/students/$studentId')({
  beforeLoad: ({ context }) => {
    const { user } = context;
    if (user.role !== 'teacher') throw redirect({ to: homeRouteForRole(user.role) });
  },
  component: StudentDrillIn,
});

interface StudentMeta {
  studentId: string;
  displayName: string | null;
  groupName: string | null;
  enrolledAt: string | null;
}

interface RecentTestRow {
  id: string;
  test_type: TestType;
  rating: TestRating | null;
  ended_at: string | null;
  ranges: Array<{ type: string; start?: number; end?: number }>;
}

async function fetchStudentMeta(teacherId: string, studentId: string): Promise<StudentMeta | null> {
  // Verify enrollment + pull group name in one go.
  const { data: enrollment, error: enrErr } = await supabase
    .from('enrollment')
    .select('id, student_id, group_id, created_at, status, student_group(name)')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();
  if (enrErr || !enrollment) return null;

  const { data: appUser, error: userErr } = await supabase
    .from('app_user')
    .select('display_name')
    .eq('id', studentId)
    .maybeSingle();
  if (userErr) return null;

  const sgJoin = (enrollment as unknown as { student_group: { name: string } | { name: string }[] | null }).student_group;
  const groupName = Array.isArray(sgJoin)
    ? sgJoin[0]?.name ?? null
    : sgJoin?.name ?? null;

  return {
    studentId,
    displayName: (appUser as { display_name: string | null } | null)?.display_name ?? null,
    groupName,
    enrolledAt: (enrollment as { created_at: string | null }).created_at ?? null,
  };
}

async function fetchStreak(studentId: string): Promise<number> {
  const { data, error } = await supabase.rpc('daily_streak', { p_student_id: studentId });
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

async function fetchRecentTests(studentId: string): Promise<RecentTestRow[]> {
  const { data, error } = await supabase
    .from('test')
    .select('id, test_type, rating, ended_at, ranges')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data as unknown as RecentTestRow[] | null) ?? [];
}

function StudentDrillIn() {
  const { user } = Route.useRouteContext();
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const [testModalOpen, setTestModalOpen] = useState(false);

  const { data: meta, isLoading } = useQuery({
    queryKey: ['teacher_student_meta', user.id, studentId],
    queryFn: () => fetchStudentMeta(user.id, studentId),
    staleTime: 60_000,
  });

  const { data: streak } = useQuery({
    queryKey: ['teacher_student_streak', studentId],
    queryFn: () => fetchStreak(studentId),
    staleTime: 60_000,
  });

  const { data: recentTests, isLoading: testsLoading } = useQuery({
    queryKey: ['teacher_student_recent_tests', studentId],
    queryFn: () => fetchRecentTests(studentId),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" color="sage.7" />
      </Group>
    );
  }

  if (!meta) {
    return (
      <Stack maw={720} mx="auto" gap="md" py="xl" align="center">
        <Text fw={700} fz="lg" c="parchment.0">
          Student not found
        </Text>
        <Text size="sm" c="parchment.0" style={{ opacity: 0.85 }} ta="center">
          The student isn't actively enrolled with you, or the ID is invalid.
        </Text>
        <Button variant="white" onClick={() => navigate({ to: '/students' })} leftSection={<ArrowLeft size={14} />}>
          Back to Students
        </Button>
      </Stack>
    );
  }

  const displayName = meta.displayName ?? 'Unnamed student';

  return (
    <Stack maw={1080} mx="auto" gap="xl" py="md">
      {/* Header */}
      <Stack gap="sm">
        <Anchor
          size="xs"
          c="parchment.0"
          style={{ opacity: 0.85 }}
          onClick={() => navigate({ to: '/students' })}
        >
          ← Students
        </Anchor>
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="lg">
          <Stack gap={4}>
            <Text
              component="h1"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 700,
                fontSize: 32,
                lineHeight: 1.1,
                color: 'var(--mantine-color-parchment-0)',
                margin: 0,
              }}
            >
              {displayName}
            </Text>
            <Group gap="xs" c="parchment.0" style={{ opacity: 0.85 }}>
              <Badge variant="dot" color="sage.7" size="sm" radius="sm">
                {meta.groupName ?? 'Ungrouped'}
              </Badge>
              <Group gap={4}>
                <Flame size={12} color="var(--mantine-color-honey-4)" strokeWidth={2.2} />
                <Text size="xs">
                  {streak ?? 0} day streak
                </Text>
              </Group>
              {meta.enrolledAt && (
                <Text size="xs">
                  · enrolled {new Date(meta.enrolledAt).toLocaleDateString()}
                </Text>
              )}
            </Group>
          </Stack>
          <Button
            color="sage"
            leftSection={<Play size={14} />}
            onClick={() => setTestModalOpen(true)}
          >
            Start test for this student
          </Button>
        </Group>
      </Stack>

      {/* Forecast + Activity row */}
      <Group align="stretch" wrap="wrap" gap="xl" grow>
        <Card padding="xl" radius="xl" shadow="xl" style={{ flex: '1 1 360px', minWidth: 320 }}>
          <ForecastCard studentId={studentId} />
        </Card>
        <Card padding="xl" radius="xl" shadow="xl" style={{ flex: '1 1 360px', minWidth: 320 }}>
          <ActivityStatsCard studentId={studentId} />
        </Card>
      </Group>

      {/* Revision health */}
      <Card padding="xl" radius="xl" shadow="xl">
        <RevisionHealthGrid studentId={studentId} />
      </Card>

      {/* Recent tests */}
      <Card padding="xl" radius="xl" shadow="xl">
        <Stack gap="md">
          <Group gap={8} align="center">
            <History size={16} color="var(--mantine-color-sage-7)" strokeWidth={2.2} />
            <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
              Recent tests
            </Text>
          </Group>
          {testsLoading ? (
            <Stack gap="sm">
              <Skeleton height={48} radius="md" />
              <Skeleton height={48} radius="md" />
              <Skeleton height={48} radius="md" />
            </Stack>
          ) : recentTests && recentTests.length > 0 ? (
            <Stack gap={6}>
              {recentTests.map((t) => (
                <Group
                  key={t.id}
                  justify="space-between"
                  align="center"
                  p="sm"
                  wrap="nowrap"
                  style={{
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(21,53,30,0.06)',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate({ to: '/tests/$testId/recap', params: { testId: t.id } })}
                >
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Group gap="xs" align="center">
                      <GraduationCap size={14} color="var(--mantine-color-mihrab-9)" />
                      <Text size="sm" fw={500}>
                        {t.test_type === 'newly_memorized' ? 'New lesson' : 'Revision'}
                        {' · '}
                        {summarizeRanges(t.ranges)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {t.ended_at ? new Date(t.ended_at).toLocaleString() : '—'}
                    </Text>
                  </Stack>
                  {t.rating && (
                    <Badge size="sm" variant="light" color={ratingColor(t.rating)}>
                      {t.rating}
                    </Badge>
                  )}
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed" ta="center" py="sm">
              No completed tests yet.
            </Text>
          )}
        </Stack>
      </Card>

      <TestCreationModal
        opened={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        onCreated={(testId) => navigate({ to: '/tests/$testId', params: { testId } })}
        studentId={studentId}
        mode="enrolled_teacher"
        subjectLabel={displayName}
      />
    </Stack>
  );
}

function ratingColor(r: TestRating): string {
  switch (r) {
    case 'strong_pass':
    case 'excellent':
      return 'sage';
    case 'good':
    case 'pass_needs_practice':
      return 'sage.4';
    case 'needs_work':
      return 'honey';
    case 'fail':
      return 'brick.7';
    default:
      return 'gray';
  }
}

function summarizeRanges(ranges: Array<{ type: string; start?: number; end?: number }>): string {
  if (!ranges || ranges.length === 0) return '—';
  const r = ranges[0];
  if (!r) return '—';
  if (r.type === 'page') {
    if (r.start === r.end) return `page ${r.start}`;
    return `pages ${r.start}–${r.end}`;
  }
  return r.type;
}
