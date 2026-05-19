import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Modal,
  Radio,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { AlertCircle, Search } from 'lucide-react';
import type { ErrorSeverity, ErrorType, LogErrorInput } from '@tahfeedh/shared';
import { apiFetch } from '../../api/client';
import { chapter } from '../../data/quran-data';

interface QfSearchResult {
  verse_key: string; // e.g. "2:255"
  text: string;
  highlighted?: string;
}
interface QfSearchResponse {
  search?: {
    results?: QfSearchResult[];
  };
}

const ERROR_TYPES: Array<{ value: ErrorType; label: string; help: string }> = [
  { value: 'tajweed', label: 'Tajweed', help: 'Rules of recitation (madd, ghunnah, qalqalah, ...)' },
  { value: 'pronunciation', label: 'Pronunciation', help: 'Letter sound — makhārij or ṣifāt' },
  { value: 'omission', label: 'Omission', help: 'Skipped a word or part of a word' },
  { value: 'addition', label: 'Addition', help: 'Added a word not in the ayah' },
  { value: 'mismatch', label: 'Mismatch', help: 'Said a different word with similar meaning' },
  { value: 'wrong_verse', label: 'Wrong verse', help: 'Jumped to a different ayah entirely' },
  { value: 'forgotten_verse', label: 'Forgotten verse', help: 'Couldn’t continue — full memory blank' },
  { value: 'hesitation', label: 'Hesitation', help: 'Long pause before continuing' },
];

interface Props {
  opened: boolean;
  onClose: () => void;
  /** The word the student tapped on (anchor for the error). */
  location: {
    surah: number;
    ayah: number;
    word_position: number;
  } | null;
  onSubmit: (input: LogErrorInput) => Promise<void>;
}

export function ErrorLogModal({ opened, onClose, location, onSubmit }: Props) {
  const [errorType, setErrorType] = useState<ErrorType>('tajweed');
  const [severity, setSeverity] = useState<ErrorSeverity>('moderate');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Wrong-verse: live QF search state.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<QfSearchResult[]>([]);
  const [pick, setPick] = useState<{ surah: number; ayah: number } | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (opened) {
      setErrorType('tajweed');
      setSeverity('moderate');
      setNote('');
      setQuery('');
      setResults([]);
      setPick(null);
    }
  }, [opened]);

  // Debounced QF search when error_type === 'wrong_verse'
  useEffect(() => {
    if (errorType !== 'wrong_verse' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await apiFetch<QfSearchResponse>(
          `/api/qf/search?q=${encodeURIComponent(query.trim())}&size=8`,
        );
        setResults(res.search?.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [errorType, query]);

  const locationLabel = useMemo(() => {
    if (!location) return '';
    const ch = chapter(location.surah);
    return `${ch?.name_simple ?? ''} ${location.surah}:${location.ayah} · word ${location.word_position}`;
  }, [location]);

  if (!location) return null;

  async function handleSubmit() {
    if (errorType === 'wrong_verse' && !pick) return;
    setSubmitting(true);
    try {
      await onSubmit({
        surah: location!.surah,
        ayah: location!.ayah,
        word_position: location!.word_position,
        error_type: errorType,
        severity,
        teacher_note: note.trim() || undefined,
        related_surah: pick?.surah,
        related_ayah: pick?.ayah,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const submitDisabled =
    submitting || (errorType === 'wrong_verse' && !pick);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <AlertCircle size={18} />
          <Text fw={700}>Log error</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          {locationLabel}
        </Text>

        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            Error type
          </Text>
          <Group gap={6}>
            {ERROR_TYPES.map((t) => (
              <Badge
                key={t.value}
                variant={errorType === t.value ? 'filled' : 'light'}
                color={errorType === t.value ? 'brick' : 'gray'}
                onClick={() => setErrorType(t.value)}
                style={{ cursor: 'pointer' }}
                size="lg"
              >
                {t.label}
              </Badge>
            ))}
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            {ERROR_TYPES.find((t) => t.value === errorType)?.help}
          </Text>
        </Stack>

        <Stack gap={4}>
          <Text size="xs" fw={600} c="dimmed">
            Severity
          </Text>
          <SegmentedControl
            value={severity}
            onChange={(v) => setSeverity(v as ErrorSeverity)}
            data={[
              { label: 'Minor', value: 'minor' },
              { label: 'Moderate', value: 'moderate' },
              { label: 'Major', value: 'major' },
            ]}
          />
        </Stack>

        {errorType === 'wrong_verse' && (
          <Stack gap={4}>
            <Text size="xs" fw={600} c="dimmed">
              Intended ayah (search Quran Foundation)
            </Text>
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              placeholder="Search by Arabic, transliteration or translation…"
              leftSection={<Search size={14} />}
              disabled={submitting}
            />
            {searching && (
              <Text size="xs" c="dimmed">
                Searching…
              </Text>
            )}
            {results.length > 0 && (
              <Radio.Group
                value={pick ? `${pick.surah}:${pick.ayah}` : ''}
                onChange={(v) => {
                  const [s, a] = v.split(':');
                  setPick({ surah: Number(s), ayah: Number(a) });
                }}
              >
                <Stack gap={6} mt={4}>
                  {results.map((r) => {
                    const [s, a] = r.verse_key.split(':');
                    return (
                      <Radio
                        key={r.verse_key}
                        value={r.verse_key}
                        label={
                          <Stack gap={0}>
                            <Text size="xs" fw={600}>
                              {chapter(Number(s))?.name_simple} {s}:{a}
                            </Text>
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {r.text}
                            </Text>
                          </Stack>
                        }
                      />
                    );
                  })}
                </Stack>
              </Radio.Group>
            )}
          </Stack>
        )}

        <Textarea
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          autosize
          minRows={1}
          maxRows={4}
        />

        <Group justify="flex-end">
          <Button variant="subtle" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={submitDisabled} color="brick">
            Log error
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
