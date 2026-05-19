import { useNavigate } from '@tanstack/react-router';
import { Badge, Button, Group, Stack, Text } from '@mantine/core';
import { BookOpenText, Check, Repeat2 } from 'lucide-react';
import { chapter, quranIndex } from '../data/quran-data';
import { toArabicIndic } from '../lib/numerals';

export type PlanRowKind = 'new' | 'revision';

interface PlanRowProps {
  pageNumber: number;
  attempted: boolean;
  kind: PlanRowKind;
}

const ACCENTS = {
  new: {
    haloFrom: 'var(--mantine-color-sage-1)',
    haloTo: 'var(--mantine-color-sage-4)',
    icon: BookOpenText,
    chipColor: 'sage.7',
    chipLabel: 'New lesson',
  },
  revision: {
    haloFrom: 'var(--mantine-color-honey-1)',
    haloTo: 'var(--mantine-color-honey-5)',
    icon: Repeat2,
    chipColor: 'honey.7',
    chipLabel: 'Revision',
  },
} as const;

export function PlanRow({ pageNumber, attempted, kind }: PlanRowProps) {
  const navigate = useNavigate();
  const a = ACCENTS[kind];
  const Icon = a.icon;

  const pageInfo = quranIndex.pages[String(pageNumber)];
  const startSurah = pageInfo ? chapter(pageInfo.surah_start) : null;
  const endSurah = pageInfo ? chapter(pageInfo.surah_end) : null;
  const surahLabel =
    startSurah && endSurah && startSurah.id !== endSurah.id
      ? `${startSurah.name_simple} – ${endSurah.name_simple}`
      : (startSurah?.name_simple ?? '');

  return (
    <Group
      align="center"
      wrap="nowrap"
      gap="md"
      p="md"
      style={{
        background: attempted
          ? 'color-mix(in srgb, var(--mantine-color-sage-1) 35%, white)'
          : 'var(--mantine-color-parchment-0)',
        borderRadius: 12,
        border: '1px solid rgba(21,53,30,0.08)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.4)',
        opacity: attempted ? 0.85 : 1,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: `radial-gradient(circle at 30% 30%, ${a.haloFrom}, ${a.haloTo})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(21,53,30,0.10)',
        }}
      >
        <Icon size={26} strokeWidth={1.75} color="var(--mantine-color-mihrab-9)" />
      </div>

      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        <Group gap={8} align="center">
          <Badge color={a.chipColor} variant="filled" radius="sm">
            {a.chipLabel}
          </Badge>
          {attempted && (
            <Badge
              color="sage.7"
              variant="light"
              radius="sm"
              leftSection={<Check size={11} strokeWidth={3} />}
            >
              Attempted today
            </Badge>
          )}
        </Group>
        <Text fw={600} size="md" td={attempted ? 'line-through' : undefined}>
          Page {pageNumber}
          {surahLabel ? ` · ${surahLabel}` : ''}
        </Text>
        <Text size="xs" c="dimmed" component="div">
          <Text component="span" style={{ fontFamily: 'Amiri, serif' }}>
            صفحة {toArabicIndic(pageNumber)}
          </Text>
        </Text>
      </Stack>

      <Button
        color="mihrab.9"
        variant={attempted ? 'subtle' : 'filled'}
        radius="xl"
        onClick={() => navigate({ to: '/mushaf' })}
        style={{ alignSelf: 'center' }}
      >
        Open mushaf
      </Button>
    </Group>
  );
}
