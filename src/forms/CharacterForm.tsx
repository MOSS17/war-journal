import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Modal, type ModalProps } from '../components/Modal';
import { Field, Stepper, SwitchRow } from '../components/ui';
import { Icon } from '../components/icons';
import { useOverlay } from '../components/overlay';
import { db, getMeta } from '../db/db';
import { addCharacter, deleteCharacter, setMain, setRetired, updateCharacter } from '../db/actions';
import { CLASSES, CLASS_COLOR, MAX_LEVEL, RACES, RACE_CLASSES, RULESETS } from '../lib/gamedata';
import { fullName, validName } from '../lib/logic';
import type { ClassName, Race, Ruleset } from '../lib/types';
import { useNavigate } from 'react-router';

export function CharacterForm({ id, onClose }: ModalProps & { id?: string }) {
  const { toast, open } = useOverlay();
  const navigate = useNavigate();
  const existing = useLiveQuery(() => (id ? db.characters.get(id) : undefined), [id]);
  const all = useLiveQuery(() => db.characters.toArray(), []);
  const main = all?.find((c) => c.isMain && c.status === 'active');

  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [level, setLevel] = useState(1);
  const [race, setRace] = useState<Race | null>(null);
  const [cls, setCls] = useState<ClassName | null>(null);
  const [ruleset, setRuleset] = useState<Ruleset>('PvP');
  const [rulesetRemembered, setRulesetRemembered] = useState(false);
  const [guild, setGuild] = useState('');
  const [makeMain, setMakeMain] = useState(false);
  const [tried, setTried] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded) return;
    if (id && existing) {
      setFirst(existing.firstName);
      setLast(existing.lastName);
      setLevel(existing.level);
      setRace(existing.race);
      setCls(existing.class);
      setRuleset(existing.ruleset);
      setGuild(existing.guild ?? '');
      setMakeMain(existing.isMain);
      setLoaded(true);
    } else if (!id && all) {
      getMeta<Ruleset | null>('lastRuleset', null).then((r) => {
        if (r) {
          setRuleset(r);
          setRulesetRemembered(true);
        }
      });
      setMakeMain(!all.some((c) => c.isMain && c.status === 'active'));
      setLoaded(true);
    }
  }, [id, existing, all, loaded]);

  const allowed = race ? RACE_CLASSES[race] : CLASSES;
  const pickRace = (r: Race) => {
    setRace(r);
    if (cls && !RACE_CLASSES[r].includes(cls)) setCls(null);
  };

  const dupe =
    all?.some(
      (c) =>
        c.id !== id &&
        c.firstName.toLowerCase() === first.trim().toLowerCase() &&
        c.lastName.toLowerCase() === last.trim().toLowerCase(),
    ) ?? false;
  const firstErr = !validName(first) ? 'First names need 2 to 12 letters.' : null;
  const lastErr = !validName(last) ? 'Last names need 2 to 12 letters.' : dupe ? 'You already have a character with this name.' : null;
  const valid = !firstErr && !lastErr && race && cls;

  const save = async () => {
    setTried(true);
    if (!valid) return;
    if (id && existing) {
      await updateCharacter(id, {
        firstName: first.trim(),
        lastName: last.trim(),
        level,
        race: race!,
        class: cls!,
        ruleset,
        guild: guild.trim() || undefined,
      });
      if (makeMain && !existing.isMain) await setMain(id);
      toast(`${first.trim()} updated`);
      onClose();
    } else {
      const newId = await addCharacter({
        firstName: first,
        lastName: last,
        level,
        race: race!,
        class: cls!,
        ruleset,
        guild,
        isMain: makeMain,
      });
      toast(`${first.trim()} joins the warband`);
      onClose();
      navigate(`/characters/${newId}`);
    }
  };

  const showFirst = tried || first.length > 0;
  const showLast = tried || last.length > 0;

  return (
    <Modal
      title={id ? 'Edit character' : 'New character'}
      eyebrow="Characters"
      onClose={onClose}
      onSubmit={save}
      size="wide"
      footer={
        <>
          <div className="row-gap">
            {id && existing && (
              <>
                <button
                  type="button"
                  className="btn2 quiet"
                  onClick={async () => {
                    await setRetired(id, existing.status !== 'retired');
                    toast(existing.status === 'retired' ? `${existing.firstName} is back` : `${existing.firstName} retired`);
                    onClose();
                  }}
                >
                  {existing.status === 'retired' ? 'Bring back' : 'Mark retired'}
                </button>
                <button
                  type="button"
                  className="btn2 danger"
                  onClick={() =>
                    open({
                      kind: 'confirm',
                      title: `Delete ${fullName(existing)}?`,
                      body: 'This removes the character, their professions, dungeon progress and war plans. Journal entries are kept. You can’t undo this.',
                      confirmLabel: 'Delete character',
                      back: { kind: 'character', id },
                      onConfirm: async () => {
                        await deleteCharacter(id);
                        toast(`${existing.firstName} deleted`);
                        navigate('/characters');
                      },
                    })
                  }
                >
                  Delete character
                </button>
              </>
            )}
          </div>
          <div className="row-gap">
            <button type="button" className="btn2" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn" aria-disabled={!valid}>
              {id ? 'Save changes' : 'Add character'}
            </button>
          </div>
        </>
      }
    >
      <div className="mb">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
            <Field label="First name" htmlFor="cf-first" error={showFirst ? firstErr : null}>
              <input
                id="cf-first"
                className="inp"
                value={first}
                maxLength={12}
                autoFocus
                autoComplete="off"
                aria-invalid={showFirst && !!firstErr}
                onChange={(e) => setFirst(e.target.value)}
              />
            </Field>
            <Field label="Last name" htmlFor="cf-last" error={showLast ? lastErr : null}>
              <input
                id="cf-last"
                className="inp"
                value={last}
                maxLength={12}
                autoComplete="off"
                aria-invalid={showLast && !!lastErr}
                onChange={(e) => setLast(e.target.value)}
              />
            </Field>
            <Field label="Level" htmlFor="cf-level">
              <Stepper id="cf-level" label="level" value={level} onChange={setLevel} min={1} max={MAX_LEVEL} />
            </Field>
          </div>
          {!firstErr && !lastErr ? (
            <span className="help ok" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon.check size={14} />
              Looks right. Write it exactly as it is in game.
            </span>
          ) : (
            <span className="help">Write it exactly as it is in game: both names, 2–12 letters each.</span>
          )}
        </div>

        <div className="field">
          <span className="lab" id="cf-race">
            Race
          </span>
          <div role="radiogroup" aria-labelledby="cf-race" className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
            {RACES.map((r) => (
              <button key={r.name} type="button" role="radio" aria-checked={race === r.name} className="tile" onClick={() => pickRace(r.name)}>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  {r.name}
                  {r.home && (
                    <span className="help" style={{ fontWeight: 500 }}>
                      {r.home}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {tried && !race && <span className="err">Pick a race.</span>}
        </div>

        <div className="field">
          <span className="lab" id="cf-class">
            Class
          </span>
          <div role="radiogroup" aria-labelledby="cf-class" className="tiles" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(max(130px, calc(25% - 8px)), 1fr))' }}>
            {CLASSES.map((c) => {
              const off = !allowed.includes(c);
              const sel = cls === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  disabled={off}
                  className="tile"
                  onClick={() => setCls(c)}
                  style={sel ? { background: `${CLASS_COLOR[c]}24`, boxShadow: `inset 0 0 0 1.5px ${CLASS_COLOR[c]}` } : undefined}
                >
                  <span className="dot" style={{ background: CLASS_COLOR[c] }} />
                  {c}
                </button>
              );
            })}
          </div>
          {race ? (
            <span className="help">Greyed out: not available to {race === 'Undead' ? 'the Undead' : `${race}s`}.</span>
          ) : (
            <span className="help">Pick a race first to see which classes it can play.</span>
          )}
          {tried && !cls && <span className="err">Pick a class.</span>}
        </div>

        <div className="two">
          <Field label="Ruleset" htmlFor="cf-rules" help={rulesetRemembered && !id ? 'Remembered from your last character' : undefined}>
            <select id="cf-rules" className="inp" value={ruleset} onChange={(e) => setRuleset(e.target.value as Ruleset)}>
              {RULESETS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Guild" htmlFor="cf-guild" optional>
            <input id="cf-guild" className="inp" placeholder="<Guild name>" value={guild} onChange={(e) => setGuild(e.target.value)} />
          </Field>
        </div>

        {!(id && (existing?.isMain || existing?.status === 'retired')) && (
          <SwitchRow
            title="Make this my main"
            help={main && main.id !== id ? `${main.firstName} is your main now` : 'Shows first on the War Board'}
            checked={makeMain}
            onChange={setMakeMain}
          />
        )}
      </div>
    </Modal>
  );
}
