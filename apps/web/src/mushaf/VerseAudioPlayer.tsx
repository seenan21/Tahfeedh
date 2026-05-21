import { useEffect, useRef, useState } from 'react';
import { ActionIcon, Group, Select, Text, Tooltip } from '@mantine/core';
import { Pause, Play, Square, Volume2 } from 'lucide-react';

interface Props {
  surah: number;
  ayah: number;
}

const SPEED_OPTIONS = [
  { value: '0.5', label: '0.5×' },
  { value: '0.75', label: '0.75×' },
  { value: '1', label: '1×' },
  { value: '1.25', label: '1.25×' },
  { value: '1.5', label: '1.5×' },
  { value: '2', label: '2×' },
];

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function husaryUrl(surah: number, ayah: number): string {
  // EveryAyah CDN — Khalil al-Ḥusary 128kbps Murattal set. Public, no auth.
  return `https://everyayah.com/data/Husary_128kbps/${pad3(surah)}${pad3(ayah)}.mp3`;
}

/**
 * Compact per-ayah audio player. Used inside the ErrorDetailModal so the
 * student/witness can hear the correct recitation right next to the logged
 * errors. Single reciter (Ḥusary) for now — no picker.
 */
export function VerseAudioPlayer({ surah, ayah }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressed, setProgressed] = useState(false);
  const [rate, setRate] = useState('1');
  const [errored, setErrored] = useState(false);

  const src = husaryUrl(surah, ayah);

  // Surah/ayah change → reload the source, stop playback, clear error state.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsPlaying(false);
    setProgressed(false);
    setErrored(false);
    el.load();
  }, [src]);

  // Keep playbackRate in sync with the Select.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = Number(rate);
  }, [rate]);

  async function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        setErrored(true);
      }
    } else {
      el.pause();
    }
  }

  function stop() {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
    setIsPlaying(false);
    setProgressed(false);
  }

  const stopDisabled = errored || (!isPlaying && !progressed);

  return (
    <Group
      gap="sm"
      align="center"
      wrap="nowrap"
      p="xs"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        border: '1px solid var(--mantine-color-honey-2)',
        borderRadius: 8,
      }}
    >
      <ActionIcon
        size="lg"
        radius="xl"
        variant="filled"
        color="sage.7"
        onClick={toggle}
        aria-label={isPlaying ? 'Pause recitation' : 'Play recitation'}
        disabled={errored}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </ActionIcon>
      <Tooltip label="Stop" withArrow>
        <ActionIcon
          size="lg"
          radius="xl"
          variant="light"
          color="sage.7"
          onClick={stop}
          aria-label="Stop recitation"
          disabled={stopDisabled}
        >
          <Square size={14} />
        </ActionIcon>
      </Tooltip>
      <Group gap={6} align="center" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
        <Volume2 size={14} style={{ opacity: 0.7, flexShrink: 0 }} />
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {errored
            ? 'Audio unavailable for this verse.'
            : `Listen — Khalil al-Ḥusary · ${surah}:${ayah}`}
        </Text>
      </Group>
      <Select
        size="xs"
        w={84}
        value={rate}
        onChange={(v) => v && setRate(v)}
        data={SPEED_OPTIONS}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        aria-label="Playback speed"
      />
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => {
          setIsPlaying(true);
          setProgressed(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setProgressed(false);
        }}
        onError={() => {
          setErrored(true);
          setIsPlaying(false);
        }}
      />
    </Group>
  );
}
