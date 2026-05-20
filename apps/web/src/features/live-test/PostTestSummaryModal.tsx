import { Badge, Button, Divider, Group, Modal, Paper, Stack, Text } from '@mantine/core';
import { CheckCircle2 } from 'lucide-react';
import type { PostTestSummary } from '@tahfeedh/shared';
import { LoggedErrorsList } from './LoggedErrorsList';
import { PostTestSummaryView } from './PostTestSummaryView';
import type { LoggedError } from './useTestSession';

interface Props {
  opened: boolean;
  onClose: () => void;
  summary: PostTestSummary | null;
  /** Duration in seconds (computed from started_at → ended_at). */
  durationSec?: number | null;
  /** Per-occurrence logged errors from this test session — rendered under the
   *  aggregated summary so notes are visible alongside the NEW/RECURRING/CLEARED
   *  roll-up. */
  loggedErrors?: LoggedError[];
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function PostTestSummaryModal({
  opened,
  onClose,
  summary,
  durationSec,
  loggedErrors,
}: Props) {
  if (!summary) return null;
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={6}>
          <CheckCircle2 size={20} color="var(--mantine-color-sage-7)" />
          <Text fw={700}>Test complete</Text>
        </Group>
      }
      size="lg"
      centered
      scrollAreaComponent={undefined}
    >
      <Stack gap="md">
        {durationSec != null && (
          <Group gap="xs" align="center">
            <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.6}>
              Duration
            </Text>
            <Badge
              variant="light"
              color="sage"
              size="lg"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatDuration(durationSec)}
            </Badge>
          </Group>
        )}

        <PostTestSummaryView summary={summary} />

        {loggedErrors && loggedErrors.length > 0 && (
          <>
            <Divider />
            <Stack gap={6}>
              <Group gap={6} align="center">
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.6}>
                  Errors logged this test
                </Text>
                <Badge size="sm" variant="light" color="gray">
                  {loggedErrors.length}
                </Badge>
              </Group>
              <Paper withBorder radius="md" p="sm">
                <LoggedErrorsList errors={loggedErrors} />
              </Paper>
            </Stack>
          </>
        )}

        <Group justify="flex-end">
          <Button color="sage" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
