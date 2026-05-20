import { useMemo } from 'react';
import {
  Badge,
  Button,
  Divider,
  Group,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpenText, PartyPopper, Repeat2, Sparkles } from 'lucide-react';
import type { TodaySession } from '@tahfeedh/shared';
import { supabase } from '../lib/supabase';
import { EmptySlotCard } from './EmptySlotCard';
import { PlanRow } from './PlanRow';

interface SessionPlanCardProps {
  studentId: string;
  // When true: hide the celebration footer with "Load next session" and the
  // bottom hint about tests being the only queue-mover. Used by the teacher
  // drill-in to render the student's plan read-only.
  readOnly?: boolean;
}

const TODAY_SESSION_KEY = (studentId: string) => ['today_session', studentId];

async function fetchTodaySession(studentId: string): Promise<TodaySession | null> {
  const { data, error } = await supabase.rpc('today_session', {
    p_student_id: studentId,
  });
  if (error) throw error;
  const rows = (data as TodaySession[] | null) ?? [];
  return rows[0] ?? null;
}

async function callLoadNextSession(studentId: string): Promise<TodaySession | null> {
  const { data, error } = await supabase.rpc('load_next_session', {
    p_student_id: studentId,
  });
  if (error) throw error;
  const rows = (data as TodaySession[] | null) ?? [];
  return rows[0] ?? null;
}

export function SessionPlanCard({ studentId, readOnly = false }: SessionPlanCardProps) {
  const queryClient = useQueryClient();
  const { data: session, isLoading, isError } = useQuery({
    queryKey: TODAY_SESSION_KEY(studentId),
    queryFn: () => fetchTodaySession(studentId),
    staleTime: 30_000,
  });

  const loadNextMutation = useMutation({
    mutationFn: () => callLoadNextSession(studentId),
    onSuccess: (next) => {
      if (next) {
        queryClient.setQueryData(TODAY_SESSION_KEY(studentId), next);
      } else {
        queryClient.invalidateQueries({ queryKey: TODAY_SESSION_KEY(studentId) });
      }
    },
  });

  const counts = useMemo(() => {
    if (!session) return { attempted: 0, total: 0 };
    const total = session.new_lesson_pages.length + session.revision_pages.length;
    const attempted =
      session.new_lesson_pages.filter((r) => r.attempted).length +
      session.revision_pages.filter((r) => r.attempted).length;
    return { attempted, total };
  }, [session]);

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={108} radius="md" />
        <Skeleton height={108} radius="md" />
      </Stack>
    );
  }

  if (isError || !session) {
    return (
      <EmptySlotCard
        title="Couldn't load today's session"
        icon={BookOpenText}
        helper="Refresh in a moment — the session machine RPC isn't reachable."
        accent="sage"
        badge="Error"
      />
    );
  }

  const hifzComplete = session.new_lesson_pages.length === 0;

  return (
    <Stack gap="lg">
      {/* Header counter */}
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.8}>
            Today's plan
          </Text>
          <Text fw={600} size="lg">
            {session.session_index > 1
              ? `Session ${session.session_index} of the day`
              : 'Your session at a glance'}
          </Text>
        </Stack>
        <Badge variant="light" color="mihrab.7" size="lg" radius="sm">
          {counts.attempted} of {counts.total} attempted
        </Badge>
      </Group>

      {/* New lesson section */}
      <Divider
        label={
          <Group gap={6}>
            <BookOpenText size={12} />
            <Text size="xs" fw={700} tt="uppercase" lts={0.6} c="dimmed">
              New lesson
            </Text>
          </Group>
        }
        labelPosition="left"
      />
      {hifzComplete ? (
        <EmptySlotCard
          title="No new lesson — every page is in your mushaf"
          icon={Sparkles}
          helper="The full Quran is memorized. Revision will keep it sound."
          accent="sage"
          badge="Hifz complete"
        />
      ) : (
        <Stack gap="sm">
          {session.new_lesson_pages.map((row) => (
            <PlanRow
              key={`new-${row.page_number}`}
              pageNumber={row.page_number}
              attempted={row.attempted}
              kind="new"
            />
          ))}
        </Stack>
      )}

      {/* Revision section */}
      <Divider
        label={
          <Group gap={6}>
            <Repeat2 size={12} />
            <Text size="xs" fw={700} tt="uppercase" lts={0.6} c="dimmed">
              Revision queue
            </Text>
          </Group>
        }
        labelPosition="left"
      />
      {session.revision_pages.length === 0 ? (
        <EmptySlotCard
          title="No revision yet"
          icon={Repeat2}
          helper="Revision pages will appear once you have memorized pages with review history."
          accent="honey"
          badge="Awaiting hifz"
        />
      ) : (
        <Stack gap="sm">
          {session.revision_pages.map((row) => (
            <PlanRow
              key={`rev-${row.page_number}`}
              pageNumber={row.page_number}
              attempted={row.attempted}
              kind="revision"
            />
          ))}
        </Stack>
      )}

      {/* Footer */}
      {readOnly ? null : session.all_attempted ? (
        <Stack
          gap="sm"
          align="center"
          mt="sm"
          p="lg"
          style={{
            background:
              'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--mantine-color-sage-1) 60%, white), white 60%)',
            borderRadius: 16,
            border: '1px solid color-mix(in srgb, var(--mantine-color-sage-4) 30%, transparent)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background:
                'linear-gradient(135deg, var(--mantine-color-sage-4) 0%, var(--mantine-color-sage-7) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px -4px rgba(21,53,30,0.4)',
            }}
          >
            <PartyPopper size={22} color="white" />
          </div>
          <Text fw={700} size="lg">
            Today's session complete
          </Text>
          <Text size="sm" c="dimmed" ta="center" maw={420}>
            A fresh session will be waiting for you tomorrow. If you want to push
            on, you can load another session today — the streak doesn't double.
          </Text>
          <Button
            mt="xs"
            color="mihrab.9"
            variant="filled"
            radius="xl"
            loading={loadNextMutation.isPending}
            onClick={() => loadNextMutation.mutate()}
          >
            Load next session
          </Button>
        </Stack>
      ) : (
        <Text size="xs" c="dimmed" ta="center" mt="sm">
          Tests are the only way pages move through the queues — start one whenever a witness is ready.
        </Text>
      )}
    </Stack>
  );
}
