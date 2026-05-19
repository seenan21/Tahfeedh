import { Badge, Button, Group, Modal, Paper, Stack, Text } from '@mantine/core';
import { CheckCircle2, RotateCw, Sparkles } from 'lucide-react';
import type { PostTestSummary, PostTestSummaryRow } from '@tahfeedh/shared';
import { chapter } from '../../data/quran-data';

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

function SummaryRow({ r }: { r: PostTestSummaryRow }) {
  const ch = chapter(r.surah);
  return (
    <Paper p="xs" radius="sm" withBorder>
      <Group justify="space-between" gap="xs">
        <Stack gap={0}>
          <Text size="xs" fw={600}>
            {ch?.name_simple} {r.surah}:{r.ayah}
            {r.wordPosition ? ` · word ${r.wordPosition}` : ''}
          </Text>
          <Text size="xs" c="dimmed">
            {r.errorType.replace('_', ' ')}
          </Text>
        </Stack>
        <Badge variant="light" size="sm">
          ×{r.occurrenceCount}
        </Badge>
      </Group>
    </Paper>
  );
}

function Section({
  label,
  icon,
  color,
  rows,
  emptyText,
}: {
  label: string;
  icon: React.ReactNode;
  color: string;
  rows: PostTestSummaryRow[];
  emptyText: string;
}) {
  return (
    <Stack gap={6}>
      <Group gap={6}>
        {icon}
        <Text fw={700} size="sm">
          {label}
        </Text>
        <Badge variant="light" color={color} size="sm">
          {rows.length}
        </Badge>
      </Group>
      {rows.length === 0 ? (
        <Text size="xs" c="dimmed" fs="italic">
          {emptyText}
        </Text>
      ) : (
        <Stack gap={4}>
          {rows.map((r) => (
            <SummaryRow key={r.signature} r={r} />
          ))}
        </Stack>
      )}
    </Stack>
  );
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
        <Section
          label="New errors"
          icon={<Sparkles size={14} color="var(--mantine-color-brick-7)" />}
          color="brick"
          rows={summary.new}
          emptyText="No new error patterns surfaced. Clean run."
        />
        <Section
          label="Recurring"
          icon={<RotateCw size={14} color="var(--mantine-color-honey-7)" />}
          color="honey"
          rows={summary.recurring}
          emptyText="No repeat patterns this test."
        />
        <Section
          label="Cleared"
          icon={<CheckCircle2 size={14} color="var(--mantine-color-sage-7)" />}
          color="sage"
          rows={summary.cleared}
          emptyText="Nothing cleared yet — needs three clean tests across the same ayahs."
        />
        <Group justify="flex-end">
          <Button color="sage" onClick={onClose}>
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
