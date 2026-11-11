import { useId, type ReactNode } from 'react';

export type SkylineVariant = 'home' | 'characters' | 'instances' | 'plans' | 'journal' | 'library';

const DARK = '#0d0907';
const BANNER = '#7d130c';

/** A camp banner on a pole: crimson cloth with gold tusks. */
function Banner({ x, top, bottom, scale = 1 }: { x: number; top: number; bottom: number; scale?: number }) {
  const w = 61 * scale;
  const h = 78 * scale;
  const y = top + 8 * scale;
  return (
    <>
      <rect x={x} y={top} width={6 * scale} height={bottom - top} fill={DARK} />
      <path
        d={`M${x + 6 * scale} ${y} H${x + 6 * scale + w} V${y + h} L${x + 6 * scale + w * 0.74} ${y + h * 0.85} L${x + 6 * scale + w * 0.54} ${y + h * 1.08} L${x + 6 * scale + w * 0.31} ${y + h * 0.87} L${x + 6 * scale} ${y + h * 1.05}Z`}
        fill={BANNER}
      />
      <path
        d={`M${x + 23 * scale} ${y + 20 * scale} Q${x + 15 * scale} ${y + 40 * scale} ${x + 27 * scale} ${y + 58 * scale} M${x + 49 * scale} ${y + 20 * scale} Q${x + 57 * scale} ${y + 40 * scale} ${x + 45 * scale} ${y + 58 * scale}`}
        stroke="#d9a441"
        strokeWidth={5 * scale}
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

/** Inline SVG camp skyline at dusk: palisade, huts, banners, campfire glow. Decorative only. */
export function Skyline({ variant }: { variant: SkylineVariant }) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (n: string) => `${n}${raw}`;
  const url = (n: string) => `url(#${id(n)})`;

  if (variant === 'home') {
    return (
      <svg className="sky" viewBox="0 0 1440 250" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        <defs>
          <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#150605" />
            <stop offset=".5" stopColor="#4e130b" />
            <stop offset=".82" stopColor="#b4461a" />
            <stop offset="1" stopColor="#e98a2c" />
          </linearGradient>
          <radialGradient id={id('glow')} cx=".5" cy="1" r=".5">
            <stop offset="0" stopColor="#ffbe55" stopOpacity=".7" />
            <stop offset="1" stopColor="#ffbe55" stopOpacity="0" />
          </radialGradient>
          <pattern id={id('spk')} width="26" height="70" patternUnits="userSpaceOnUse">
            <path d="M3 70 V16 L13 0 L23 16 V70Z" fill="#1c0c07" />
          </pattern>
        </defs>
        <rect width="1440" height="250" fill={url('sky')} />
        <circle cx="1120" cy="70" r="26" fill="#f3c27a" opacity=".35" />
        <path d="M0 205 Q160 160 340 186 T700 170 T1060 182 T1440 162 V250 H0Z" fill="#2b0d07" />
        <rect x="0" y="180" width="1440" height="70" fill={url('spk')} />
        <ellipse className="flicker" cx="720" cy="250" rx="420" ry="110" fill={url('glow')} />
        <path d="M90 250 L170 150 L250 250Z M162 158 L150 122 M178 158 L192 122" fill={DARK} stroke={DARK} strokeWidth="5" />
        <path d="M300 250 V212 Q300 168 380 162 Q460 168 460 212 V250Z" fill={DARK} />
        <path d="M322 196 Q302 162 316 136 Q326 166 340 188Z M438 196 Q458 162 444 136 Q434 166 420 188Z M372 166 Q380 128 388 166Z" fill={DARK} />
        <Banner x={545} top={70} bottom={250} />
        <path d="M640 250 Q690 214 720 236 Q750 212 800 250Z" fill={DARK} />
        <g className="flicker">
          <path d="M706 236 Q712 196 722 214 Q726 186 736 236Z" fill="#ffb347" />
          <path d="M714 236 Q718 214 724 224 Q728 208 732 236Z" fill="#fff0a8" />
        </g>
        <Banner x={890} top={70} bottom={250} />
        <path d="M1000 250 V214 Q1000 176 1070 170 Q1140 176 1140 214 V250Z M1020 200 Q1004 170 1016 148 Q1024 174 1036 194Z M1120 200 Q1136 170 1124 148 Q1116 174 1104 194Z" fill={DARK} />
        <path d="M1230 250 V122 H1216 L1262 84 L1308 122 H1294 V250Z M1252 84 L1262 50 L1272 84Z" fill={DARK} />
        <path d="M1340 250 L1400 170 L1460 250Z" fill={DARK} />
      </svg>
    );
  }

  const spikes = <rect x="0" y="90" width="1440" height="60" fill={url('spk')} />;
  const scenes: Record<Exclude<SkylineVariant, 'home'>, ReactNode> = {
    characters: (
      <>
        {spikes}
        <path d="M60 150 L130 70 L200 150Z M1180 150 V120 Q1180 86 1240 82 Q1300 86 1300 120 V150Z M1196 108 Q1182 84 1192 66 Q1200 88 1210 104Z M1284 108 Q1298 84 1288 66 Q1280 88 1270 104Z" fill={DARK} />
        <Banner x={1360} top={30} bottom={150} scale={0.78} />
      </>
    ),
    plans: (
      <>
        {spikes}
        <path d="M60 150 L130 70 L200 150Z M1180 150 V120 Q1180 86 1240 82 Q1300 86 1300 120 V150Z M1196 108 Q1182 84 1192 66 Q1200 88 1210 104Z M1284 108 Q1298 84 1288 66 Q1280 88 1270 104Z" fill={DARK} />
        <Banner x={300} top={30} bottom={150} scale={0.78} />
        <Banner x={1360} top={30} bottom={150} scale={0.78} />
      </>
    ),
    instances: (
      <>
        <path d="M0 120 L120 80 L220 104 L330 50 L420 96 L560 40 L660 92 L800 70 L940 104 L1080 50 L1200 92 L1320 70 L1440 100 V150 H0Z" fill="#2b0d07" />
        <g fill={DARK}>
          <path d="M540 150 V80 L560 56 L580 80 V150Z" />
          <path d="M520 150 H600 V120 H520Z" />
          <path d="M1220 150 V112 Q1220 92 1250 88 Q1280 92 1280 112 V150Z" />
        </g>
      </>
    ),
    library: (
      <>
        <path d="M0 116 L180 90 L320 108 L470 80 L620 106 L780 86 L940 110 L1100 84 L1260 106 L1440 92 V150 H0Z" fill="#2b0d07" />
        {spikes}
        <g fill={DARK}>
          <path d="M980 150 V80 H966 L1006 46 L1046 80 H1032 V150Z" />
          <path d="M140 150 L200 82 L260 150Z" />
        </g>
      </>
    ),
    journal: (
      <>
        <path d="M0 120 Q240 92 480 112 T960 104 T1440 96 V150 H0Z" fill="#2b0d07" />
        <ellipse className="flicker" cx="430" cy="150" rx="320" ry="80" fill={url('glow')} />
        <g fill={DARK}>
          <path d="M300 150 L370 70 L440 150Z" />
          <path d="M362 76 L352 46 M378 76 L390 46" stroke={DARK} strokeWidth="4" />
          <path d="M1100 150 V120 Q1100 86 1160 82 Q1220 86 1220 120 V150Z" />
          <path d="M1116 108 Q1102 82 1112 64 Q1120 86 1130 104Z M1204 108 Q1218 82 1208 64 Q1200 86 1190 104Z" />
          <path d="M520 150 Q560 128 584 142 Q608 126 648 150Z" />
        </g>
        <g className="flicker">
          <path d="M572 142 Q577 112 585 126 Q589 104 597 142Z" fill="#ffb347" />
          <path d="M578 142 Q581 126 586 132 Q589 120 592 142Z" fill="#fff0a8" />
        </g>
      </>
    ),
  };

  return (
    <svg className="sky" viewBox="0 0 1440 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a0806" />
          <stop offset=".6" stopColor="#6a1a0d" />
          <stop offset="1" stopColor="#d27428" />
        </linearGradient>
        <radialGradient id={id('glow')} cx=".5" cy="1" r=".5">
          <stop offset="0" stopColor="#ffbe55" stopOpacity=".6" />
          <stop offset="1" stopColor="#ffbe55" stopOpacity="0" />
        </radialGradient>
        <pattern id={id('spk')} width="26" height="60" patternUnits="userSpaceOnUse">
          <path d="M3 60 V14 L13 0 L23 14 V60Z" fill="#1c0c07" />
        </pattern>
      </defs>
      <rect width="1440" height="150" fill={url('sky')} />
      {scenes[variant]}
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
