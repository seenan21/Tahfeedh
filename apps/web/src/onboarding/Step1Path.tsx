import { Button, Card, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { Check, Circle, Sparkles, BookOpenText } from 'lucide-react';
import type { OnboardingPath } from './state';

interface Step1PathProps {
  path: OnboardingPath | null;
  onSelect: (path: OnboardingPath) => void;
  onContinue: () => void;
}

interface PathOption {
  value: OnboardingPath;
  english: string;
  arabic: string;
  helper: string;
  icon: typeof Sparkles;
}

const OPTIONS: PathOption[] = [
  {
    value: 'fresh',
    english: "I'm just starting fresh",
    arabic: 'أبدأ من جديد',
    helper: 'No memorization yet — Tahfeedh starts you at page 1.',
    icon: Sparkles,
  },
  {
    value: 'partial',
    english: "I've memorized some already",
    arabic: 'حفظت بعضًا منه',
    helper: 'Tell us which juz and surahs you already know.',
    icon: BookOpenText,
  },
  {
    value: 'complete',
    english: "I've memorized the whole Qur'an",
    arabic: 'أكملت حفظ القرآن',
    helper: 'We mark all 604 pages memorized and tune sessions for revision.',
    icon: Check,
  },
];

export function Step1Path({ path, onSelect, onContinue }: Step1PathProps) {
  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Text fw={600} size="sm" c="dimmed">
          Step 1 of 3
        </Text>
        <Text size="lg" fw={600}>
          Where are you in your hifz journey?
        </Text>
      </Stack>

      <Stack gap="sm">
        {OPTIONS.map((opt) => {
          const selected = path === opt.value;
          const Icon = opt.icon;
          return (
            <UnstyledButton key={opt.value} onClick={() => onSelect(opt.value)}>
              <Card
                bg={selected ? 'sage.1' : 'white'}
                radius="md"
                shadow={selected ? 'md' : 'sm'}
                p="md"
                style={{
                  border: selected
                    ? '2px solid var(--mantine-color-sage-4)'
                    : '2px solid var(--mantine-color-gray-2)',
                  transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <Group gap="md" wrap="nowrap" align="flex-start">
                  <Icon
                    size={22}
                    strokeWidth={1.75}
                    color="var(--mantine-color-mihrab-9)"
                    style={{ marginTop: 2 }}
                  />
                  <Stack gap={2} flex={1}>
                    <Group gap="xs" justify="space-between">
                      <Text fw={600}>{opt.english}</Text>
                      <Text
                        component="span"
                        style={{ fontFamily: 'Amiri, serif', fontSize: 16, direction: 'rtl' }}
                        c="dimmed"
                      >
                        {opt.arabic}
                      </Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {opt.helper}
                    </Text>
                  </Stack>
                  {selected ? (
                    <Check size={18} color="var(--mantine-color-sage-7)" strokeWidth={2.5} />
                  ) : (
                    <Circle size={14} color="var(--mantine-color-gray-5)" />
                  )}
                </Group>
              </Card>
            </UnstyledButton>
          );
        })}
      </Stack>

      <Group justify="flex-end">
        <Button
          color="mihrab"
          size="md"
          disabled={path === null}
          onClick={onContinue}
        >
          Continue
        </Button>
      </Group>
    </Stack>
  );
}
