import type { ClassName, PlanType } from '../lib/types';

/** The original tusk-shield mark (not a Blizzard asset). */
export function Mark({ size = 32, muted = false }: { size?: number; muted?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      {!muted && <path d="M28 3 L51 14.5 V35.5 L28 53 L5 35.5 V14.5Z" fill="#9c2015" stroke="#c9a24a" strokeWidth="2.5" strokeLinejoin="round" />}
      <path d="M15 42 C9 30 12 17 22 10 C19 20 20 30 25 39 Z" fill={muted ? 'rgba(255,230,210,.7)' : '#f3e4c0'} />
      <path d="M41 42 C47 30 44 17 34 10 C37 20 36 30 31 39 Z" fill={muted ? 'rgba(255,230,210,.7)' : '#f3e4c0'} />
    </svg>
  );
}

const CLASS_PATHS: Record<ClassName, string> = {
  Warrior: 'M12 48 L40 12 L46 14 L18 52Z M48 48 L20 12 L14 14 L42 52Z',
  Hunter: 'M16 8 Q46 30 16 52 L19 54 Q52 30 19 6Z M17 8 L17 52 M8 30 L50 30 L44 25 M50 30 L44 35',
  Rogue: 'M30 4 L35 34 L30 40 L25 34Z M20 38 H40 V42 H20Z M28 42 H32 V54 H28Z',
  Priest: 'M30 6 L34 24 L52 30 L34 36 L30 54 L26 36 L8 30 L26 24Z',
  Shaman: 'M36 4 L14 34 H28 L22 56 L46 24 H32 Z',
  Mage: 'M30 4 L34 26 L56 30 L34 34 L30 56 L26 34 L4 30 L26 26Z M46 8 L48 14 L54 16 L48 18 L46 24 L44 18 L38 16 L44 14Z',
  Warlock: 'M30 4 C40 18 46 24 44 38 C43 48 37 54 30 54 C22 54 16 48 16 38 C16 30 22 26 24 18 C28 26 26 32 30 36 C34 30 34 20 30 4Z',
  Druid: 'M30 54 V30 M30 30 C14 30 8 18 10 6 C24 6 34 14 30 30Z M30 36 C42 36 50 28 50 18 C40 18 32 24 30 36Z',
};

export function ClassGlyph({ cls, size = 38 }: { cls: ClassName; size?: number }) {
  const stroked = cls === 'Hunter' || cls === 'Druid';
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" aria-hidden="true">
      <path
        d={CLASS_PATHS[cls]}
        fill={stroked ? 'none' : '#d8c08a'}
        stroke={stroked ? '#d8c08a' : 'none'}
        strokeWidth={stroked ? 4 : 0}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type IconProps = { size?: number; color?: string; strokeWidth?: number };

function Stroke({ d, size = 20, color = 'currentColor', strokeWidth = 2 }: IconProps & { d: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const Icon = {
  check: (p: IconProps) => <Stroke d="M5 12l5 5 9-10" strokeWidth={2.8} {...p} />,
  search: (p: IconProps) => (
    <svg width={p.size ?? 20} height={p.size ?? 20} viewBox="0 0 24 24" fill="none" stroke={p.color ?? 'currentColor'} strokeWidth={2} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4-4" />
    </svg>
  ),
  link: (p: IconProps) => <Stroke d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" {...p} />,
  note: (p: IconProps) => <Stroke d="M5 3h10l4 4v14H5z M9 12h6 M9 16h4" {...p} />,
  journal: (p: IconProps) => <Stroke d="M5 3h11l3 3v15H5z M9 12h6M12 9v6" {...p} />,
  flag: (p: IconProps) => <Stroke d="M5 21V4h11l-2 4 2 4H5" {...p} />,
  up: (p: IconProps) => <Stroke d="M12 20V10M7 15l5-5 5 5M5 4h14" {...p} />,
  person: (p: IconProps) => <Stroke d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21c1-4 4-6 8-6s7 2 8 6 M19 3v6 M16 6h6" {...p} />,
  plus: (p: IconProps) => <Stroke d="M12 5v14M5 12h14" {...p} />,
  pin: (p: IconProps) => <Stroke d="M12 17v5 M8 3h8l-1 6 3 4H6l3-4z" {...p} />,
  edit: (p: IconProps) => <Stroke d="M14 4l6 6-11 11H3v-6z" {...p} />,
  external: (p: IconProps) => <Stroke d="M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6" {...p} />,
  arrowUp: (p: IconProps) => <Stroke d="M12 2 L12 22 M5 9 L12 2 L19 9" strokeWidth={2.4} {...p} />,
  menu: (p: IconProps) => <Stroke d="M4 7h16M4 12h16M4 17h16" {...p} />,
  calendar: (p: IconProps) => (
    <svg width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 24 24" fill="none" stroke={p.color ?? 'currentColor'} strokeWidth={2} aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  ),
  image: (p: IconProps) => (
    <svg width={p.size ?? 26} height={p.size ?? 26} viewBox="0 0 24 24" fill="none" stroke={p.color ?? 'currentColor'} strokeWidth={1.8} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-9 9" />
    </svg>
  ),
  alert: (p: IconProps) => (
    <svg width={p.size ?? 14} height={p.size ?? 14} viewBox="0 0 24 24" fill="none" stroke={p.color ?? 'currentColor'} strokeWidth={2.4} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  ),
  scroll: (p: IconProps) => <Stroke d="M5 3 H15 L19 7 V21 H5Z M8 11 H16 M8 15 H14" strokeWidth={1.8} {...p} />,
};

const PLAN_PATHS: Record<PlanType, string> = {
  dungeon: 'M4 21V9l8-6 8 6v12M9 21v-6h6v6',
  raid: 'M12 3l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6L3 10l6-1z',
  level: 'M12 20V6M6 12l6-6 6 6',
  profession: 'M14 4l6 6-9 9H5v-6z',
  gold: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 8v8 M9 10h5a2 2 0 0 1 0 4H9',
  item: 'M6 3h12l-2 7H8zM8 10l-2 11h12l-2-11',
  custom: 'M5 21V4h11l-2 4 2 4H5',
};

export function PlanIcon({ type, size = 20 }: { type: PlanType; size?: number }) {
  return <Stroke d={PLAN_PATHS[type]} size={size} />;
}
