import { Link, useMatchRoute } from '@tanstack/react-router';
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
import type { UserRole } from '@tahfeedh/shared';
import classes from './AppSidebar.module.css';

interface NavItem {
  label: string;
  arabic: string;
  to: string;
  icon: LucideIcon;
}

const STUDENT_NAV: NavItem[] = [
  { label: 'Today',     arabic: 'اليوم',     to: '/today',    icon: Sun },
  { label: 'Tests',     arabic: 'الاختبارات', to: '/tests',    icon: GraduationCap },
  { label: 'Timeline',  arabic: 'السجل',     to: '/timeline', icon: CalendarDays },
  { label: 'My Mushaf', arabic: 'مصحفي',     to: '/mushaf',   icon: BookOpen },
  { label: 'Goals',     arabic: 'الأهداف',   to: '/goals',    icon: Target },
  { label: 'Settings',  arabic: 'الإعدادات', to: '/settings', icon: SettingsIcon },
];

const TEACHER_NAV: NavItem[] = [
  { label: 'Students',  arabic: 'الطلاب',     to: '/students', icon: Users },
  { label: 'Groups',    arabic: 'الحلقات',    to: '/groups',   icon: LayoutGrid },
  { label: 'Tests',     arabic: 'الاختبارات', to: '/tests',    icon: GraduationCap },
  { label: 'Settings',  arabic: 'الإعدادات',  to: '/settings', icon: SettingsIcon },
];

function NavRow({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute();
  const isActive = !!matchRoute({ to: item.to, fuzzy: false });
  const Icon = item.icon;
  return (
    <Link to={item.to} className={classes.navItem} data-active={isActive}>
      <Icon className={classes.icon} size={18} strokeWidth={1.75} />
      <span style={{ flex: 1 }}>{item.label}</span>
      <span
        style={{
          fontFamily: 'Amiri, serif',
          fontSize: 13,
          direction: 'rtl',
          opacity: isActive ? 0.85 : 0.45,
          transition: 'opacity 180ms ease',
        }}
      >
        {item.arabic}
      </span>
    </Link>
  );
}

export function AppSidebar({ role }: { role: UserRole }) {
  const items = role === 'student' ? STUDENT_NAV : TEACHER_NAV;
  const sectionLabel = role === 'student' ? 'Hifz workspace' : 'Teacher workspace';
  return (
    <nav className={classes.navWrap}>
      <div className={classes.brandMark}>
        <div className={classes.arabic}>تَحفِيظ</div>
        <div className={classes.english}>Tahfeedh</div>
      </div>
      <div className={classes.sectionLabel}>{sectionLabel}</div>
      {items.map((item) => (
        <NavRow key={item.to} item={item} />
      ))}
      <div className={classes.footer}>v0.1 · hackathon build</div>
    </nav>
  );
}
