import { useId, useRef, useState, type ReactNode } from 'react';
import type { Character, RunStatus } from '../lib/types';
import { CLASS_COLOR } from '../lib/gamedata';
import { DIFFICULTY_COLOR, RUN_LABEL, fromCoins, toCoins, type Difficulty } from '../lib/logic';
import { ClassGlyph, Diamond, Icon } from './icons';

export function Pennant({ small = false }: { small?: boolean }) {
  return (
    <span className="pennant" style={small ? undefined : { width: 26, height: 34 }}>
      <Diamond size={small ? 10 : 12} />
    </span>
  );
}

export function SectionHead({
  title,
  as: As = 'h2',
  right,
  id,
}: {
  title: ReactNode;
  as?: 'h2' | 'h3';
  right?: ReactNode;
  id?: string;
}) {
  return (
    <div className="sect">
      <div className="sect-title">
        <Pennant small />
        <As id={id}>{title}</As>
      </div>
      {right}
    </div>
  );
}

export function DiffDot({ d, glow = true, size = 8 }: { d: Difficulty; glow?: boolean; size?: number }) {
  const c = DIFFICULTY_COLOR[d];
  return (
    <span
      className="dot"
      style={{ width: size, height: size, background: c, boxShadow: glow && d !== 'trivial' ? `0 0 10px ${c}` : undefined }}
    />
  );
}

export function ClassDot({ c }: { c: Pick<Character, 'class'> }) {
  return <span className="dot" style={{ background: CLASS_COLOR[c.class] }} />;
}

export function StatusPill({ status, locked = false, label }: { status: RunStatus; locked?: boolean; label?: string }) {
  if (locked) return <span className="pill locked">Locked</span>;
  const cls = status === 'cleared' ? 'cleared' : status === 'run' ? 'run' : 'notrun';
  return <span className={`pill ${cls}`}>{label ?? RUN_LABEL[status]}</span>;
}

export function Bar({
  pct,
  kind = 'brass',
  color,
  height,
  label,
}: {
  pct: number;
  kind?: 'xp' | 'brass' | 'plain';
  color?: string;
  height?: number;
  label?: string;
}) {
  const w = `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%`;
  return (
    <div
      className="track"
      style={height ? { height } : undefined}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      aria-label={label}
    >
      <span className={kind === 'plain' ? undefined : kind} style={{ width: w, background: color }} />
    </div>
  );
}

export function Avatar({
  c,
  size = 76,
  quiet = false,
  showLevel = true,
}: {
  c: Pick<Character, 'class' | 'level'>;
  size?: number;
  quiet?: boolean;
  showLevel?: boolean;
}) {
  const ring = Math.max(2, Math.round(size / 36));
  return (
    <span
      className={`avatar${quiet ? ' quiet' : ''}`}
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 0 0 ${ring}px ${CLASS_COLOR[c.class]}${quiet ? '' : ', 0 0 24px -6px rgba(224,118,58,.6)'}`,
        background: quiet ? 'radial-gradient(circle at 50% 35%, #3a221a, #150e0c 72%)' : undefined,
      }}
    >
      {size >= 40 && !quiet && <ClassGlyph cls={c.class} size={Math.round(size / 2)} />}
      {showLevel && <span className="lvl tab">{c.level}</span>}
    </span>
  );
}

export function Money({ copper, size = 26 }: { copper: number; size?: number }) {
  const { g, s, c } = toCoins(copper);
  const small = { fontSize: Math.round(size * 0.62) };
  return (
    <span className="disp tab" style={{ fontSize: size, color: 'var(--bone-hi)' }}>
      {g}
      <span style={{ ...small, color: 'var(--brass)' }}>g</span> {s}
      <span style={{ ...small, color: 'var(--ash)' }}>s</span>
      {size >= 24 && (
        <>
          {' '}
          {c}
          <span style={{ ...small, color: '#b8692e' }}>c</span>
        </>
      )}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  labelId,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  labelId?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className="sw"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-label={labelId ? undefined : label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function SwitchRow({
  title,
  help,
  checked,
  onChange,
  bare = false,
}: {
  title: string;
  help?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  bare?: boolean;
}) {
  const id = useId();
  return (
    <div className={bare ? 'sect' : 'switchrow'}>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span className="lab" id={id}>
          {title}
        </span>
        {help && <span className="help">{help}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} labelId={id} />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  inline = false,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  inline?: boolean;
}) {
  return (
    <div className={`segs${inline ? ' inline' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function Stepper({
  id,
  value,
  onChange,
  min = 0,
  max = 999,
  label,
  small = false,
  invalid,
}: {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  small?: boolean;
  invalid?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={`step${small ? ' sm' : ''}`} style={invalid ? { borderColor: '#e0574a' } : undefined}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(clamp(value - 1, min, max))}>
        −
      </button>
      <input
        id={id}
        inputMode="numeric"
        aria-label={id ? undefined : label}
        value={draft ?? String(value)}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, '');
          setDraft(raw);
          if (raw !== '') onChange(clamp(Number(raw), min, max));
        }}
        onBlur={() => setDraft(null)}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(clamp(value + 1, min, max));
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(clamp(value - 1, min, max));
          }
        }}
      />
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(clamp(value + 1, min, max))}>
        +
      </button>
    </div>
  );
}

export function CoinsInput({ copper, onChange, legend }: { copper: number; onChange: (c: number) => void; legend: string }) {
  const coins = toCoins(copper);
  const set = (k: 'g' | 's' | 'c', raw: string) => {
    const n = Number(raw.replace(/[^0-9]/g, '') || 0);
    const next = { ...coins, [k]: k === 'g' ? Math.min(n, 999999) : Math.min(n, 99) };
    onChange(fromCoins(next));
  };
  return (
    <fieldset style={{ margin: 0, padding: 0, border: 0, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <legend className="lab" style={{ padding: 0, marginBottom: 6 }}>
        {legend}
      </legend>
      <div className="coins">
        {(['g', 's', 'c'] as const).map((k) => (
          <label key={k} className="coin">
            <input
              value={k === 'g' ? String(coins[k]) : String(coins[k]).padStart(2, '0')}
              aria-label={{ g: 'Gold', s: 'Silver', c: 'Copper' }[k]}
              inputMode="numeric"
              onChange={(e) => set(k, e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            <i className={k} />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function XpRange({ value, onChange, id }: { value: number; onChange: (v: number) => void; id: string }) {
  return (
    <div className="range">
      <div className="track">
        <span className="xp" style={{ width: `${value}%`, boxShadow: 'none' }} />
      </div>
      <span className="thumb" style={{ left: `calc(${value}% - 11px)` }} />
      <input
        id={id}
        type="range"
        min={0}
        max={99}
        value={value}
        aria-label="Experience percent"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function TagInput({
  id,
  tags,
  onChange,
  suggestions = [],
}: {
  id: string;
  tags: string[];
  onChange: (t: string[]) => void;
  suggestions?: string[];
}) {
  const [text, setText] = useState('');
  const add = (t: string) => {
    const v = t.trim();
    if (v && !tags.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...tags, v]);
    setText('');
  };
  const left = suggestions.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="chips">
        {tags.map((t) => (
          <span key={t} className="chip">
            {t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          className="inline-input"
          style={{ minWidth: 90 }}
          placeholder="Add a tag"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              if (text.trim()) {
                e.preventDefault();
                add(text);
              }
            } else if (e.key === 'Backspace' && !text && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
      {left.length > 0 && (
        <div className="row-gap" style={{ gap: 6 }}>
          {left.map((s) => (
            <button key={s} type="button" className="sug" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Check({
  checked,
  onChange,
  children,
  right,
  green = false,
  disabled = false,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  children: ReactNode;
  right?: ReactNode;
  green?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={`check${green ? ' green' : ''}`}
      onClick={() => onChange?.(!checked)}
      disabled={disabled}
    >
      <span className={`cb${checked ? ' on' : ''}`}>{checked && <Icon.check size={14} color="#0f0c0b" strokeWidth={3.2} />}</span>
      <span className="check-text grow" style={{ textDecoration: checked && !green ? 'line-through' : undefined }}>
        {children}
      </span>
      {right && <span className="help">{right}</span>}
    </button>
  );
}

export function EmptyState({
  title,
  children,
  action,
  center = false,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`empty${center ? ' center' : ''}`}>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  optional,
  help,
  error,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  optional?: boolean;
  help?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label className="lab" htmlFor={htmlFor}>
        {label}
        {optional && <span className="opt"> · optional</span>}
      </label>
      {children}
      {error ? (
        <span className="err" role="alert">
          <Icon.alert />
          {error}
        </span>
      ) : (
        help && <span className="help">{help}</span>
      )}
    </div>
  );
}

/** A file drop zone for screenshots. */
export function DropZone({ onFiles, label = 'Add or drop images' }: { onFiles: (f: File[]) => void; label?: string }) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label
      className={`drop grow${over ? ' over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <Icon.plus size={22} color="#e0763a" />
      <span>{label}</span>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          if (ref.current) ref.current.value = '';
        }}
      />
    </label>
  );
}
