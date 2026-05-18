import { Button, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core';
import { toArabicIndic } from '../lib/numerals';

interface JuzGridProps {
  selected: number[];
  onToggle: (juz: number) => void;
  onSet: (juzs: number[]) => void;
}

const ALL = Array.from({ length: 30 }, (_, i) => i + 1);
const SHORTCUTS: Array<{ label: string; juzs: number[] }> = [
  { label: 'Juz 1–5',   juzs: [1, 2, 3, 4, 5] },
  { label: 'Juz 26–30', juzs: [26, 27, 28, 29, 30] },
  { label: 'All 30',    juzs: ALL },
];

export function JuzGrid({ selected, onToggle, onSet }: JuzGridProps) {
  const selectedSet = new Set(selected);

  return (
    <Stack gap="md">
      <Group gap="xs">
        {SHORTCUTS.map((s) => (
          <Button
            key={s.label}
            size="xs"
            variant="default"
            radius="xl"
            onClick={() => onSet(s.juzs)}
          >
            {s.label}
          </Button>
        ))}
        <Button
          size="xs"
          variant="subtle"
          radius="xl"
          color="brick"
          onClick={() => onSet([])}
        >
          Clear
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 5, sm: 6, md: 10 }} spacing="xs">
        {ALL.map((j) => {
          const sel = selectedSet.has(j);
          return (
            <UnstyledButton
              key={j}
              onClick={() => onToggle(j)}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: 8,
                border: sel
                  ? '2px solid var(--mantine-color-sage-4)'
                  : '2px solid var(--mantine-color-gray-2)',
                background: sel ? 'var(--mantine-color-sage-1)' : 'white',
                color: 'var(--mantine-color-mihrab-9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                cursor: 'pointer',
                transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              <Text fw={600} size="md" lh={1}>
                {j}
              </Text>
              <Text
                size="xs"
                c="dimmed"
                style={{ fontFamily: 'Amiri, serif', direction: 'rtl', lineHeight: 1 }}
              >
                {toArabicIndic(j)}
              </Text>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
