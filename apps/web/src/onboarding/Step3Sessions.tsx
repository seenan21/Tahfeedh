import { Button, Card, Group, NumberInput, Radio, Stack, Text } from '@mantine/core';
import type { OnboardingState, Action } from './state';

interface Step3Props {
  state: OnboardingState;
  dispatch: (a: Action) => void;
  onBack: () => void;
  onFinish: () => void;
}

const NEW_PRESETS = [0.5, 1, 2] as const;
const REVISION_PRESETS = [3, 5, 10] as const;

function classifyPreset(value: number, presets: readonly number[]): string {
  if (presets.includes(value)) return String(value);
  return 'custom';
}

export function Step3Sessions({ state, dispatch, onBack, onFinish }: Step3Props) {
  const newGroup = classifyPreset(state.newPerDay, NEW_PRESETS);
  const revisionGroup = classifyPreset(state.revisionPerDay, REVISION_PRESETS);

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Text fw={600} size="sm" c="dimmed">
          Step 3 of 3
        </Text>
        <Text size="lg" fw={600}>
          Your daily session size
        </Text>
        <Text size="sm" c="dimmed">
          You can change these any time in Settings.
        </Text>
      </Stack>

      <Card bg="white" radius="md" shadow="sm" p="md">
        <Stack>
          <Text fw={600}>New memorization per day</Text>
          <Radio.Group
            value={newGroup}
            onChange={(v) => {
              if (v === 'custom') return;
              dispatch({ type: 'SET_NEW_PER_DAY', value: Number(v) });
            }}
          >
            <Stack gap="xs">
              <Radio value="0.5" label="Half a page (~7–8 lines)" />
              <Radio value="1" label="1 page" />
              <Radio value="2" label="2 pages" />
              <Radio value="custom" label="Custom…" />
            </Stack>
          </Radio.Group>
          {newGroup === 'custom' && (
            <NumberInput
              label="Pages per day"
              min={0.5}
              max={20}
              step={0.5}
              decimalScale={1}
              value={state.newPerDay}
              onChange={(v) => {
                const num = typeof v === 'number' ? v : Number(v);
                if (Number.isFinite(num)) {
                  dispatch({ type: 'SET_NEW_PER_DAY', value: num });
                }
              }}
            />
          )}
        </Stack>
      </Card>

      <Card bg="white" radius="md" shadow="sm" p="md">
        <Stack>
          <Text fw={600}>Revision per day</Text>
          <Radio.Group
            value={revisionGroup}
            onChange={(v) => {
              if (v === 'custom') return;
              dispatch({ type: 'SET_REVISION_PER_DAY', value: Number(v) });
            }}
          >
            <Stack gap="xs">
              <Radio value="3" label="3 pages" />
              <Radio value="5" label="5 pages" />
              <Radio value="10" label="10 pages" />
              <Radio value="custom" label="Custom…" />
            </Stack>
            <Text size="xs" c="dimmed">
              3 pages is the recommended starting point. Bump it up once revision feels easy.
            </Text>
          </Radio.Group>
          {revisionGroup === 'custom' && (
            <NumberInput
              label="Pages per day"
              min={0}
              max={20}
              value={state.revisionPerDay}
              onChange={(v) => {
                const num = typeof v === 'number' ? v : Number(v);
                if (Number.isFinite(num)) {
                  dispatch({ type: 'SET_REVISION_PER_DAY', value: num });
                }
              }}
            />
          )}
        </Stack>
      </Card>

      {state.error && (
        <Text c="red" size="sm">
          {state.error}
        </Text>
      )}

      <Group justify="space-between">
        <Button variant="subtle" onClick={onBack} disabled={state.submitting}>
          Back
        </Button>
        <Button color="mihrab" size="md" loading={state.submitting} onClick={onFinish}>
          Finish
        </Button>
      </Group>
    </Stack>
  );
}
