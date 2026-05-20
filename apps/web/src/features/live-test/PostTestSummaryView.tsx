import { Badge, Card, Group, Paper, Stack, Text } from '@mantine/core';
import { CheckCircle2, RotateCw, Sparkles } from 'lucide-react';
import type { PostTestSummary, PostTestSummaryRow } from '@tahfeedh/shared';
import { scopeOfErrorType } from '@tahfeedh/shared';
import { chapter } from '../../data/quran-data';
import { ERROR_TYPE_COLOR } from '../../mushaf/getOverlayMarkers';

interface Props {
  summary: PostTestSummary;
}

interface SectionTheme {
  label: string;
  icon: React.ReactNode;
  /** Mantine color name root (e.g. "brick"). */
  color: string;
  /** Background tint for the section card. */
  bg: string;
  /** Border color for the section card. */
  border: string;
  emptyText: string;
}

function SummaryRow({ r }: { r: PostTestSummaryRow }) {
  const ch = chapter(r.surah);
  const typeColor = ERROR_TYPE_COLOR[r.errorType];
  const scope = scopeOfErrorType(r.errorType);
  return (
    <Paper
      p="xs"
      radius="md"
      withBorder
      style={{
        background: 'rgba(255,255,255,0.85)',
        borderColor: 'rgba(21,53,30,0.08)',
        borderInlineStartWidth: 3,
        borderInlineStartColor: typeColor,
      }}
    >
      <Group justify="space-between" gap="xs" wrap="nowrap" align="center">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap={6} align="center" wrap="nowrap">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 2,
                background: typeColor,
                flexShrink: 0,
              }}
            />
            <Text size="xs" fw={700} tt="capitalize">
              {r.errorType.replace('_', ' ')}
            </Text>
            <Badge
              size="xs"
              variant="light"
              color={scope === 'verse' ? 'brick' : 'sage'}
            >
              {scope}
            </Badge>
          </Group>
          <Text size="xs" c="dimmed" style={{ minWidth: 0 }}>
            {ch?.name_simple} {r.surah}:{r.ayah}
            {r.wordPosition ? ` · word ${r.wordPosition}` : ' · whole verse'}
          </Text>
        </Stack>
        <Badge variant="filled" color="dark.4" size="sm" style={{ flexShrink: 0 }}>
          ×{r.occurrenceCount}
        </Badge>
      </Group>
    </Paper>
  );
}

function Section({
  theme,
  rows,
}: {
  theme: SectionTheme;
  rows: PostTestSummaryRow[];
}) {
  return (
    <Card
      withBorder
      radius="md"
      p="md"
      style={{ background: theme.bg, borderColor: theme.border }}
    >
      <Stack gap="sm">
        <Group gap="xs" align="center">
          {theme.icon}
          <Text fw={700} size="sm">
            {theme.label}
          </Text>
          <Badge variant="filled" color={theme.color} size="sm">
            {rows.length}
          </Badge>
        </Group>
        {rows.length === 0 ? (
          <Text size="xs" c="dimmed" fs="italic">
            {theme.emptyText}
          </Text>
        ) : (
          <Stack gap={6}>
            {rows.map((r) => (
              <SummaryRow key={r.signature} r={r} />
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export function PostTestSummaryView({ summary }: Props) {
  const sections: Array<{ theme: SectionTheme; rows: PostTestSummaryRow[] }> = [
    {
      theme: {
        label: 'New errors',
        icon: <Sparkles size={16} color="var(--mantine-color-brick-7)" />,
        color: 'brick',
        bg: 'rgba(214, 89, 60, 0.06)',
        border: 'rgba(214, 89, 60, 0.22)',
        emptyText: 'No new error patterns surfaced. Clean run.',
      },
      rows: summary.new,
    },
    {
      theme: {
        label: 'Recurring',
        icon: <RotateCw size={16} color="var(--mantine-color-honey-7)" />,
        color: 'honey',
        bg: 'rgba(214, 158, 60, 0.06)',
        border: 'rgba(214, 158, 60, 0.22)',
        emptyText: 'No repeat patterns this test.',
      },
      rows: summary.recurring,
    },
    {
      theme: {
        label: 'Cleared',
        icon: <CheckCircle2 size={16} color="var(--mantine-color-sage-7)" />,
        color: 'sage',
        bg: 'rgba(74, 124, 89, 0.06)',
        border: 'rgba(74, 124, 89, 0.22)',
        emptyText: 'Nothing cleared yet — needs three clean tests across the same ayahs.',
      },
      rows: summary.cleared,
    },
  ];

  return (
    <Stack gap="md">
      {sections.map((s) => (
        <Section key={s.theme.label} theme={s.theme} rows={s.rows} />
      ))}
    </Stack>
  );
}
