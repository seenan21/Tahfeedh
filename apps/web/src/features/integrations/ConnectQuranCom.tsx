import { useState } from 'react';
import { Badge, Button, Group, Stack, Text } from '@mantine/core';
import { BookmarkPlus, Plug, ShieldCheck, Unplug } from 'lucide-react';
import {
  disconnectQf,
  getScopeChips,
  startQfConnect,
  useInvalidateQfStatus,
  useQfStatus,
} from './useQfStatus';
import { toastError, toastSuccess } from '../../lib/toast';
import { SkeletonRow } from '../../components/SkeletonRow';

const QC_TEAL = '#0E7C5C';

export function ConnectQuranCom() {
  const { data: status, isLoading } = useQfStatus();
  const invalidate = useInvalidateQfStatus();
  const [busy, setBusy] = useState(false);

  if (isLoading || !status) {
    return <SkeletonRow variant="card" height={88} />;
  }

  const handleConnect = async () => {
    setBusy(true);
    try {
      await startQfConnect();
    } catch (err) {
      toastError(err, 'Could not start Quran.com connection');
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Quran.com? Future bookmarks and goal syncs will pause until you reconnect.')) {
      return;
    }
    setBusy(true);
    try {
      await disconnectQf();
      await invalidate();
      toastSuccess('Disconnected from Quran.com');
    } catch (err) {
      toastError(err, 'Could not disconnect');
    } finally {
      setBusy(false);
    }
  };

  if (!status.connected) {
    return (
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="md" align="flex-start" wrap="nowrap" style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${QC_TEAL} 0%, #15351E 100%)`,
              color: '#FFFFC1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookmarkPlus size={20} strokeWidth={2} />
          </div>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={600}>Quran.com is not connected</Text>
            <Text size="xs" c="dimmed">
              Connect your Quran.com account to sync bookmarks, goals, and your reading streak.
            </Text>
          </Stack>
        </Group>
        <Button
          size="sm"
          radius="md"
          loading={busy}
          onClick={handleConnect}
          style={{
            background: `linear-gradient(135deg, ${QC_TEAL} 0%, #0a5a43 100%)`,
            color: 'white',
          }}
        >
          Connect Quran.com
        </Button>
      </Group>
    );
  }

  const chips = getScopeChips(status.scope);
  const expiresAt = status.expires_at ? new Date(status.expires_at) : null;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="md" align="center" wrap="nowrap" style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${QC_TEAL} 0%, #15351E 100%)`,
              color: '#FFFFC1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={20} strokeWidth={2} />
          </div>
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Group gap={6} align="center">
              <Text fw={600}>Connected to Quran.com</Text>
              <Badge size="xs" variant="light" color="sage">
                Active
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {expiresAt
                ? `Token refreshes automatically. Current token expires ${expiresAt.toLocaleString()}.`
                : 'Token refreshes automatically.'}
            </Text>
          </Stack>
        </Group>
        <Button
          size="sm"
          radius="md"
          variant="outline"
          color="brick.7"
          leftSection={<Unplug size={14} />}
          loading={busy}
          onClick={handleDisconnect}
        >
          Disconnect
        </Button>
      </Group>
      {chips.length > 0 && (
        <Group gap="xs" wrap="wrap">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} lts={0.6}>
            Synced
          </Text>
          {chips.map((c) => (
            <Badge key={c} size="sm" variant="light" color="sage.6" leftSection={<Plug size={10} />}>
              {c}
            </Badge>
          ))}
        </Group>
      )}
    </Stack>
  );
}
