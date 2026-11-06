import { useId, type ReactNode } from 'react';

export type SkylineVariant = 'home' | 'characters' | 'instances' | 'plans' | 'journal' | 'library';

/** Layered SVG war camp at dusk, fading into the page. Decorative only. */
export function Skyline({ variant }: { variant: SkylineVariant }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${n}${raw}`;
  const url = (n: string) => `url(#${id(n)})`;

  if (variant === 'home') {
    return (
      <svg className="sky" viewBox="0 0 1440 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#120c0b" />
            <stop offset=".45" stopColor="#2c1310" />
            <stop offset=".78" stopColor="#6b2617" />
            <stop offset="1" stopColor="#a8421e" />
          </linearGradient>
          <radialGradient id={id('fire')} cx=".5" cy="1" r=".55">
            <stop offset="0" stopColor="#ff9a4a" stopOpacity=".55" />
            <stop offset="1" stopColor="#ff9a4a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id('fade')} x1="0" y1="0" x2="0" y2="1">
            <stop offset=".55" stopColor="#0f0c0b" stopOpacity="0" />
            <stop offset="1" stopColor="#0f0c0b" />
          </linearGradient>
          <filter id={id('grain')}>
            <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 .85  0 0 0 0 .7  0 0 0 .06 0" />
          </filter>
          <pattern id={id('spk')} width="22" height="60" patternUnits="userSpaceOnUse">
            <path d="M2 60 V13 L11 0 L20 13 V60Z" fill="#160d0b" />
          </pattern>
        </defs>
        <rect width="1440" height="400" fill={url('sky')} />
        <path d="M0 270 L120 210 L210 245 L340 180 L470 240 L600 205 L720 250 L860 190 L1000 240 L1130 200 L1260 245 L1440 205 V400 H0Z" fill="#3a1812" opacity=".75" />
        <path d="M0 300 Q200 262 380 288 T760 280 T1140 286 T1440 270 V400 H0Z" fill="#24110d" />
        <ellipse cx="720" cy="400" rx="560" ry="150" fill={url('fire')} />
        <rect x="0" y="300" width="1440" height="60" fill={url('spk')} />
        <g fill="#0f0a09">
          <path d="M150 400 L230 300 L310 400Z" />
          <path d="M222 306 L210 270 M238 306 L252 270" stroke="#0f0a09" strokeWidth="5" />
          <path d="M380 400 V352 Q380 300 460 294 Q540 300 540 352 V400Z" />
          <path d="M402 334 Q384 300 396 274 Q406 304 420 326Z M518 334 Q536 300 524 274 Q514 304 500 326Z" />
          <rect x="640" y="210" width="5" height="190" />
          <rect x="800" y="210" width="5" height="190" />
          <path d="M1000 400 V355 Q1000 310 1070 304 Q1140 310 1140 355 V400Z" />
          <path d="M1020 338 Q1004 306 1016 284 Q1024 310 1036 330Z M1120 338 Q1136 306 1124 284 Q1116 310 1104 330Z" />
          <path d="M1250 400 V250 H1238 L1280 214 L1322 250 H1310 V400Z" />
        </g>
        <path d="M645 218 H700 V290 L686 279 L672 296 L658 281 L645 292Z" fill="#7e1f18" />
        <path d="M805 218 H860 V290 L846 279 L832 296 L818 281 L805 292Z" fill="#7e1f18" />
        <path d="M662 236 Q656 254 666 270 M684 236 Q690 254 680 270 M822 236 Q816 254 826 270 M844 236 Q850 254 840 270" stroke="#c9a45c" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
        <g fill="#ffb066">
          <circle cx="700" cy="330" r="2" opacity=".9" />
          <circle cx="742" cy="300" r="1.6" opacity=".7" />
          <circle cx="716" cy="262" r="1.3" opacity=".55" />
          <circle cx="760" cy="236" r="1.1" opacity=".4" />
          <circle cx="688" cy="210" r="1" opacity=".3" />
          <circle cx="735" cy="180" r="1.2" opacity=".25" />
          <circle cx="772" cy="276" r="1.4" opacity=".6" />
          <circle cx="676" cy="288" r="1.2" opacity=".5" />
        </g>
        <rect width="1440" height="400" filter={url('grain')} />
        <rect width="1440" height="400" fill={url('fade')} />
      </svg>
    );
  }

  const ridge: Record<Exclude<SkylineVariant, 'home'>, string> = {
    characters: 'M0 170 L140 130 L260 156 L400 118 L540 160 L700 128 L860 162 L1020 126 L1180 158 L1320 132 L1440 150 V240 H0Z',
    plans: 'M0 170 L140 130 L260 156 L400 118 L540 160 L700 128 L860 162 L1020 126 L1180 158 L1320 132 L1440 150 V240 H0Z',
    instances: 'M0 200 L120 150 L220 176 L330 110 L420 160 L560 90 L660 150 L800 120 L940 168 L1080 100 L1200 150 L1320 124 L1440 160 V240 H0Z',
    library: 'M0 176 L180 140 L320 162 L470 124 L620 158 L780 132 L940 164 L1100 130 L1260 160 L1440 140 V240 H0Z',
    journal: 'M0 190 Q240 150 480 176 T960 168 T1440 156 V240 H0Z',
  };

  const props: Record<Exclude<SkylineVariant, 'home'>, ReactNode> = {
    characters: (
      <>
        <g fill="#0f0a09">
          <path d="M1060 240 L1120 170 L1180 240Z" />
          <path d="M200 240 V206 Q200 170 260 166 Q320 170 320 206 V240Z" />
          <rect x="1330" y="110" width="4" height="130" />
        </g>
        <path d="M1334 116 H1374 V166 L1364 158 L1354 170 L1344 160 L1334 168Z" fill="#7e1f18" />
      </>
    ),
    plans: (
      <>
        <g fill="#0f0a09">
          <path d="M90 240 L150 170 L210 240Z" />
          <path d="M1180 240 V206 Q1180 170 1240 166 Q1300 170 1300 206 V240Z" />
          <rect x="1360" y="110" width="4" height="130" />
        </g>
        <path d="M1364 116 H1404 V166 L1394 158 L1384 170 L1374 160 L1364 168Z" fill="#7e1f18" />
      </>
    ),
    instances: (
      <>
        <path d="M0 220 Q260 186 520 206 T1040 200 T1440 190 V240 H0Z" fill="#1c0f0c" />
        <g fill="#0f0a09">
          <path d="M540 240 V150 L560 126 L580 150 V240Z" />
          <path d="M520 240 H600 V196 H520Z" />
          <path d="M1220 240 V170 Q1220 150 1250 146 Q1280 150 1280 170 V240Z" />
        </g>
      </>
    ),
    library: (
      <g fill="#0f0a09">
        <path d="M980 240 V150 H968 L1006 118 L1044 150 H1032 V240Z" />
        <path d="M140 240 L200 172 L260 240Z" />
      </g>
    ),
    journal: (
      <>
        <ellipse cx="430" cy="240" rx="420" ry="110" fill={url('fire')} />
        <g fill="#0f0a09">
          <path d="M300 240 L370 160 L440 240Z" />
          <path d="M362 166 L352 136 M378 166 L390 136" stroke="#0f0a09" strokeWidth="4" />
          <path d="M1100 240 V206 Q1100 172 1160 168 Q1220 172 1220 206 V240Z" />
          <path d="M1116 194 Q1102 168 1112 150 Q1120 172 1130 190Z M1204 194 Q1218 168 1208 150 Q1200 172 1190 190Z" />
        </g>
        <path d="M418 240 Q424 210 432 222 Q436 200 444 240Z" fill="#ffb347" />
        <g fill="#ffb066">
          <circle cx="436" cy="196" r="1.6" opacity=".7" />
          <circle cx="452" cy="170" r="1.2" opacity=".5" />
          <circle cx="424" cy="150" r="1" opacity=".35" />
        </g>
      </>
    ),
  };

  const hasSpikes = variant === 'characters' || variant === 'plans' || variant === 'library';
  const bottom = variant === 'journal' ? '#8a3519' : '#7a2d18';

  return (
    <svg className="sky" viewBox="0 0 1440 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120c0b" />
          <stop offset=".6" stopColor="#2c1310" />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <radialGradient id={id('fire')} cx=".3" cy="1" r=".4">
          <stop offset="0" stopColor="#ff9a4a" stopOpacity=".5" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('fade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset=".45" stopColor="#0f0c0b" stopOpacity="0" />
          <stop offset="1" stopColor="#0f0c0b" />
        </linearGradient>
        <filter id={id('grain')}>
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 .85  0 0 0 0 .7  0 0 0 .06 0" />
        </filter>
        <pattern id={id('spk')} width="22" height="50" patternUnits="userSpaceOnUse">
          <path d="M2 50 V12 L11 0 L20 12 V50Z" fill="#160d0b" />
        </pattern>
      </defs>
      <rect width="1440" height="240" fill={url('sky')} />
      <path d={ridge[variant]} fill={variant === 'journal' ? '#2a120d' : '#3a1812'} opacity={variant === 'journal' ? 1 : 0.72} />
      {hasSpikes && <rect x="0" y={variant === 'library' ? 186 : 180} width="1440" height="50" fill={url('spk')} />}
      {props[variant]}
      <rect width="1440" height="240" filter={url('grain')} />
      <rect width="1440" height="240" fill={url('fade')} />
    </svg>
  );
}

/** Paper grain overlay for parchment pages. */
export function ParchGrain() {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className="grain" aria-hidden="true">
      <filter id={`pg${raw}`}>
        <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" />
        <feColorMatrix values="0 0 0 0 .45  0 0 0 0 .3  0 0 0 0 .15  0 0 0 .35 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#pg${raw})`} />
    </svg>
  );
}
