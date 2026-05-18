import { Button, Card, Divider, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { OnboardingState, Action } from './state';
import { JuzGrid } from './JuzGrid';
import { SurahList } from './SurahList';
import { PartialPagePicker } from './PartialPagePicker';

interface Step2Props {
  state: OnboardingState;
  dispatch: (a: Action) => void;
  onBack: () => void;
  onContinue: () => void;
}

type Mode = 'juz' | 'surah';

export function Step2Capture({ state, dispatch, onBack, onContinue }: Step2Props) {
  const [mode, setMode] = useState<Mode>('juz');

  const totalSelected =
    state.juzs.length + state.surahs.length + (state.inProgress ? 1 : 0);

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Text fw={600} size="sm" c="dimmed">
          Step 2 of 3
        </Text>
        <Text size="lg" fw={600}>
          What have you already memorized?
        </Text>
        <Text size="sm" c="dimmed">
          Mix juz and surah modes freely — your selections persist across mode switches.
        </Text>
      </Stack>

      <SegmentedControl
        value={mode}
        onChange={(v) => setMode(v as Mode)}
        data={[
          { value: 'juz', label: 'By Juz' },
          { value: 'surah', label: 'By Surah' },
        ]}
        color="mihrab"
      />

      {mode === 'juz' ? (
        <JuzGrid
          selected={state.juzs}
          onToggle={(juz) => dispatch({ type: 'TOGGLE_JUZ', juz })}
          onSet={(juzs) => dispatch({ type: 'SET_JUZS', juzs })}
        />
      ) : (
        <SurahList
          selected={state.surahs}
          onToggle={(surah) => dispatch({ type: 'TOGGLE_SURAH', surah })}
          onPartial={(surah, upToAyah) =>
            dispatch({ type: 'SET_SURAH_PARTIAL', surah, upToAyah })
          }
        />
      )}

      <Divider label="Optional" labelPosition="left" />

      <Card bg="white" radius="md" shadow="sm" p="md">
        <PartialPagePicker
          marker={state.inProgress}
          onChange={(marker) => dispatch({ type: 'SET_IN_PROGRESS', marker })}
        />
      </Card>

      <Group justify="space-between">
        <Button variant="subtle" onClick={onBack}>
          Back
        </Button>
        <Group gap="md">
          <Text size="sm" c="dimmed">
            {totalSelected} selection{totalSelected === 1 ? '' : 's'}
          </Text>
          <Button color="mihrab" onClick={onContinue}>
            Continue
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
