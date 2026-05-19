import { Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { CheckCircle2 } from 'lucide-react';
import type { PostTestSummary } from '@tahfeedh/shared';
import { PostTestSummaryView } from './PostTestSummaryView';

interface Props {
  opened: boolean;
  onClose: () => void;
  summary: PostTestSummary | null;
  /** Duration in seconds (computed from started_at → ended_at). */
  durationSec?: number | null;
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function PostTestSummaryModal({ opened, onClose, summary, durationSec }: Props) {
  if (!summary) return null;
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap={6}>
          <CheckCircle2 size={18} />
          <Text fw={700}>Test complete</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {durationSec != null && (
          <Group gap={6} align="center">
            <Text size="xs" tt="uppercase" c="dimmed" fw={700} lts={0.6}>
              Duration
            </Text>
            <Badge variant="light" size="lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(durationSec)}
            </Badge>
          </Group>
        )}
        <PostTestSummaryView summary={summary} />
        <Group justify="flex-end">
          <Button color="sage" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
