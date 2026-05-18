import { ActionIcon, Checkbox, Group, NumberInput, ScrollArea, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CHAPTERS } from '../data/quran-data';
import type { SurahSelection } from './state';

interface SurahListProps {
  selected: SurahSelection[];
  onToggle: (surah: number) => void;
  onPartial: (surah: number, upToAyah: number | undefined) => void;
}

export function SurahList({ selected, onToggle, onPartial }: SurahListProps) {
  const [query, setQuery] = useState('');
  const selectedById = useMemo(() => {
    const m = new Map<number, SurahSelection>();
    for (const s of selected) m.set(s.surah, s);
    return m;
  }, [selected]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return CHAPTERS;
    return CHAPTERS.filter((c) => {
      if (String(c.id).includes(q)) return true;
      if (c.name_simple.toLowerCase().includes(q)) return true;
      if (c.name_arabic.includes(query)) return true;
      return false;
    });
  }, [q, query]);

  return (
    <Stack gap="sm">
      <TextInput
        leftSection={<Search size={16} />}
        placeholder="Search by name, number, or Arabic"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        rightSection={
          query ? (
            <ActionIcon variant="subtle" size="sm" onClick={() => setQuery('')}>
              <X size={14} />
            </ActionIcon>
          ) : null
        }
      />

      <ScrollArea h={420} type="auto">
        <Stack gap={4}>
          {filtered.map((c) => {
            const sel = selectedById.get(c.id);
            const isSelected = !!sel;
            return (
              <Group key={c.id} gap="sm" wrap="nowrap" align="center" p="xs">
                <UnstyledButton onClick={() => onToggle(c.id)} style={{ flex: 1 }}>
                  <Group gap="sm" wrap="nowrap">
                    <Checkbox checked={isSelected} readOnly tabIndex={-1} />
                    <Text size="sm" fw={500} w={28}>
                      {c.id}
                    </Text>
                    <Text size="sm" fw={500} flex={1}>
                      {c.name_simple}
                    </Text>
                    <Text
                      size="sm"
                      c="dimmed"
                      style={{ fontFamily: 'Amiri, serif', direction: 'rtl' }}
                    >
                      {c.name_arabic}
                    </Text>
                    <Text size="xs" c="dimmed" w={56} ta="right">
                      {c.verses_count} ayat
                    </Text>
                  </Group>
                </UnstyledButton>
                {isSelected && (
                  <Group gap={4} wrap="nowrap">
                    <Text size="xs" c="dimmed">
                      ayahs 1–
                    </Text>
                    <NumberInput
                      size="xs"
                      w={70}
                      min={1}
                      max={c.verses_count}
                      placeholder={String(c.verses_count)}
                      value={sel?.upToAyah ?? ''}
                      onChange={(v) => {
                        const num = typeof v === 'number' ? v : Number(v);
                        if (!Number.isFinite(num) || num <= 0) {
                          onPartial(c.id, undefined);
                        } else if (num >= c.verses_count) {
                          onPartial(c.id, undefined);
                        } else {
                          onPartial(c.id, num);
                        }
                      }}
                    />
                  </Group>
                )}
              </Group>
            );
          })}
          {filtered.length === 0 && (
            <Text c="dimmed" size="sm" ta="center" py="md">
              No surahs match "{query}"
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
