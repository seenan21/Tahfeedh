import { Link } from '@tanstack/react-router';
import { Group, Stack, Text } from '@mantine/core';
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  LayoutGrid,
  Settings as SettingsIcon,
  Sun,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type { UserRole } from '@tahfeedh/shared';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Today',     to: '/today',    icon: Sun },
  { label: 'Tests',     to: '/tests',    icon: GraduationCap },
  { label: 'Timeline',  to: '/timeline', icon: CalendarDays },
  { label: 'My Mushaf', to: '/mushaf',   icon: BookOpen },
  { label: 'Goals',     to: '/goals',    icon: Target },
  { label: 'Settings',  to: '/settings', icon: SettingsIcon },
];

const TEACHER_NAV: NavItem[] = [
  { label: 'Students',  to: '/students', icon: Users },
  { label: 'Groups',    to: '/groups',   icon: LayoutGrid },
  { label: 'Tests',     to: '/tests',    icon: GraduationCap },
  { label: 'Settings',  to: '/settings', icon: SettingsIcon },
];

const baseStyle: CSSProperties = {
  display: 'block',
  padding: '10px 14px',
  borderRadius: 8,
  borderLeft: '3px solid transparent',
  textDecoration: 'none',
  color: 'var(--mantine-color-mihrab-9)',
  fontWeight: 500,
  transition:
    'background 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
};

const hoverStyle: CSSProperties = {
  background: 'var(--mantine-color-sage-0)',
};

const activeStyle: CSSProperties = {
  background: 'var(--mantine-color-sage-1)',
  borderLeft: '3px solid var(--mantine-color-mihrab-9)',
  fontWeight: 600,
};

export function AppSidebar({ role }: { role: UserRole }) {
  const items = role === 'student' ? STUDENT_NAV : TEACHER_NAV;
  return (
    <Stack gap={4} p="md">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            style={baseStyle}
            activeProps={{ style: { ...baseStyle, ...activeStyle } }}
            onMouseEnter={(e) =>
              Object.assign((e.currentTarget as HTMLAnchorElement).style, hoverStyle)
            }
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              const isActive = el.getAttribute('data-status') === 'active';
              Object.assign(el.style, isActive ? { ...baseStyle, ...activeStyle } : baseStyle);
            }}
          >
            <Group gap="sm" wrap="nowrap">
              <Icon size={18} strokeWidth={1.75} />
              <Text component="span" size="sm">
                {item.label}
              </Text>
            </Group>
          </Link>
        );
      })}
    </Stack>
  );
}
