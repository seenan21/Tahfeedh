import { Button, Group, NumberInput, Select, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { chapter, surahsInJuz, juzAyahRange } from '../data/quran-data';
import type { InProgressMarker } from './state';

interface PartialPagePickerProps {
  marker: InProgressMarker | undefined;
  onChange: (marker: InProgressMarker | undefined) => void;
}

const JUZ_OPTIONS = Array.from({ length: 30 }, (_, i) => ({
  value: String(i + 1),
  label: `Juz ${i + 1}`,
}));

export function PartialPagePicker({ marker, onChange }: PartialPagePickerProps) {
  const surahOptions = useMemo(() => {
    if (!marker) return [] as { value: string; label: string }[];
    return surahsInJuz(marker.juz).map((id) => {
      const c = chapter(id);
      return {
        value: String(id),
        label: c ? `${id}. ${c.name_simple} — ${c.name_arabic}` : `Surah ${id}`,
      };
    });
  }, [marker]);

  const ayahBounds = useMemo<[number, number] | null>(() => {
    if (!marker) return null;
    return juzAyahRange(marker.juz, marker.surah);
  }, [marker]);

  if (!marker) {
    return (
      <Group>
        <Button
          variant="default"
          size="sm"
          onClick={() => onChange({ juz: 1, surah: 1, ayah: 1 })}
        >
          Add "currently in the middle of one"
        </Button>
      </Group>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Text size="sm" fw={600}>
          Currently in the middle of…
        </Text>
        <Button variant="subtle" size="xs" color="brick" onClick={() => onChange(undefined)}>
          Remove
        </Button>
      </Group>
      <Group grow>
        <Select
          label="Juz"
          data={JUZ_OPTIONS}
          value={String(marker.juz)}
          onChange={(v) => {
            if (v === null) return;
            const juz = Number(v);
            const firstSurah = surahsInJuz(juz)[0] ?? 1;
            const range = juzAyahRange(juz, firstSurah);
            onChange({ juz, surah: firstSurah, ayah: range?.[0] ?? 1 });
          }}
        />
        <Select
          label="Surah"
          data={surahOptions}
          value={String(marker.surah)}
          onChange={(v) => {
            if (v === null) return;
            const surah = Number(v);
            const range = juzAyahRange(marker.juz, surah);
            onChange({ ...marker, surah, ayah: range?.[0] ?? 1 });
          }}
        />
        <NumberInput
          label="Up to ayah"
          min={ayahBounds?.[0] ?? 1}
          max={ayahBounds?.[1] ?? 286}
          value={marker.ayah}
          onChange={(v) => {
            const num = typeof v === 'number' ? v : Number(v);
            if (!Number.isFinite(num)) return;
            onChange({ ...marker, ayah: num });
          }}
        />
      </Group>
      {ayahBounds && (
        <Text size="xs" c="dimmed">
          This juz covers ayahs {ayahBounds[0]}–{ayahBounds[1]} of this surah.
        </Text>
      )}
    </Stack>
  );
}
