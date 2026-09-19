import { useEffect, useMemo, useState } from 'react';
import type { Category, Settings, TimerMinutes } from '../game/types';
import { MAX_PLAYERS, MIN_PLAYERS, maxImposters } from '../game/imposters';
import { buildPool } from '../game/words';
import { KEYS, store } from '../storage/storage';
import { Button, Confirm, Screen, Segmented, Stepper, Toggle } from '../components/ui';
import { TIMER_OPTIONS, duplicateNames, effectiveNames, loadPlayers, loadSettings, type ActiveGame } from '../app/model';
import { CategoriesScreen } from './CategoriesScreen';
import { CategoryEditor } from './CategoryEditor';
import { HowToPlay } from './HowToPlay';

interface Props {
  builtin: Category[];
  custom: Category[];
  onCustomChange: (list: Category[]) => void;
  /** A game found in storage at launch, not yet resumed or discarded. */
  savedGame: ActiveGame | null;
  onResume: () => void;
  onDiscard: () => void;
  /** The game in progress when the user came here via "Change settings". */
  activeGame: ActiveGame | null;
  onResetGame: () => void;
  onStart: (players: string[], settings: Settings) => void;
}

type View = { kind: 'main' } | { kind: 'categories' } | { kind: 'howto' } | { kind: 'edit'; category: Category | null };

export function SetupScreen(p: Props) {
  const [saved, setSaved] = useState(loadPlayers);
  const [settings, setSettings] = useState(loadSettings);
  const [view, setView] = useState<View>({ kind: 'main' });
  const [pendingEdit, setPendingEdit] = useState<(() => void) | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => store.set(KEYS.players, saved), [saved]);
  useEffect(() => store.set(KEYS.settings, settings), [settings]);

  const all = useMemo(() => [...p.builtin, ...p.custom], [p.builtin, p.custom]);
  const names = effectiveNames(saved.names, saved.count);
  const dupes = duplicateNames(names);
  const max = maxImposters(saved.count);

  useEffect(() => {
    if (settings.imposters > max) setSettings((s) => ({ ...s, imposters: max }));
  }, [max, settings.imposters]);

  const selectedIds = settings.categoryIds.filter((id) => all.some((c) => c.id === id));
  const poolSize = useMemo(() => buildPool(all, selectedIds, settings.mode).length, [all, selectedIds, settings.mode]);

  const startReason =
    selectedIds.length === 0
      ? 'Pick at least one category to start.'
      : dupes.size > 0
        ? 'Every player needs a different name.'
        : poolSize === 0
          ? 'Undercover needs words with a decoy. Add decoys to your custom words or pick a built-in category.'
          : null;

  /** Player-list edits reset an in-progress game, so they go through a confirm first. */
  const guardPlayerEdit = (apply: () => void) => {
    if (p.activeGame) setPendingEdit(() => apply);
    else apply();
  };

  const setCount = (count: number) =>
    guardPlayerEdit(() => setSaved((s) => ({ ...s, count: Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count)) })));

  const setName = (i: number, value: string) =>
    guardPlayerEdit(() =>
      setSaved((s) => {
        const next = [...s.names];
        while (next.length <= i) next.push('');
        next[i] = value;
        return { ...s, names: next };
      }),
    );

  const start = () => {
    if (startReason) return;
    p.onStart(names, { ...settings, categoryIds: selectedIds, imposters: Math.min(settings.imposters, max) });
  };

  if (view.kind === 'categories') {
    return (
      <CategoriesScreen
        builtin={p.builtin}
        custom={p.custom}
        selected={selectedIds}
        onChange={(ids) => setSettings((s) => ({ ...s, categoryIds: ids }))}
        onEdit={(category) => setView({ kind: 'edit', category })}
        onBack={() => setView({ kind: 'main' })}
      />
    );
  }

  if (view.kind === 'edit') {
    const editing = view.category;
    return (
      <CategoryEditor
        category={editing}
        takenNames={all.filter((c) => c.id !== editing?.id).map((c) => c.name)}
        onSave={(cat) => {
          const exists = p.custom.some((c) => c.id === cat.id);
          p.onCustomChange(exists ? p.custom.map((c) => (c.id === cat.id ? cat : c)) : [...p.custom, cat]);
          if (!exists) setSettings((s) => ({ ...s, categoryIds: [...s.categoryIds, cat.id] }));
          setView({ kind: 'categories' });
        }}
        onDelete={(id) => {
          p.onCustomChange(p.custom.filter((c) => c.id !== id));
          setSettings((s) => ({ ...s, categoryIds: s.categoryIds.filter((x) => x !== id) }));
          setView({ kind: 'categories' });
        }}
        onCancel={() => setView({ kind: 'categories' })}
      />
    );
  }

  const isClassic = settings.mode === 'classic';

  return (
    <Screen
      title={
        <span className="wordmark">
          Imposter<span className="wordmark__dot">.</span>
        </span>
      }
      actions={
        <>
          {startReason && (
            <p className="form-error" role="status">
              {startReason}
            </p>
          )}
          <Button onClick={start} disabled={startReason !== null}>
            {p.activeGame ? `Start round ${p.activeGame.round + 1}` : 'Start game'}
          </Button>
        </>
      }
    >
      <button type="button" className="link" onClick={() => setView({ kind: 'howto' })}>
        How to play
      </button>

      {p.savedGame && !p.activeGame && (
        <div className="banner" role="region" aria-label="Saved game">
          <p className="banner__text">You have a game in progress.</p>
          <div className="banner__actions">
            <Button full={false} onClick={p.onResume}>
              Resume game (Round {p.savedGame.round})
            </Button>
            <Button variant="ghost" full={false} onClick={() => setConfirmDiscard(true)}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {p.activeGame && (
        <p className="note">
          Scores are kept. Changing the players starts a new game.
        </p>
      )}

      <h2 className="section-title">Players</h2>
      <Stepper label="Players" value={saved.count} min={MIN_PLAYERS} max={MAX_PLAYERS} onChange={setCount} />
      <p className="hint">Enter names in seating order. Cards are dealt in this order.</p>
      <ol className="names">
        {names.map((n, i) => {
          const raw = saved.names[i] ?? '';
          const isDupe = dupes.has(n.toLowerCase());
          return (
            <li key={i}>
              <input
                className={`input ${isDupe ? 'is-invalid' : ''}`}
                type="text"
                value={raw}
                placeholder={`Player ${i + 1}`}
                aria-label={`Player ${i + 1} name`}
                aria-invalid={isDupe || undefined}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                maxLength={24}
                onChange={(e) => setName(i, e.target.value)}
              />
            </li>
          );
        })}
      </ol>
      {dupes.size > 0 && (
        <p className="form-error" role="alert">
          Two players have the same name.
        </p>
      )}
      <h2 className="section-title">Game</h2>
      <Stepper
        label="Imposters"
        hint={`Max ${max} for ${saved.count} players`}
        value={Math.min(settings.imposters, max)}
        min={1}
        max={max}
        onChange={(v) => setSettings((s) => ({ ...s, imposters: v }))}
      />
      <Segmented
        label="Mode"
        stacked
        value={settings.mode}
        onChange={(mode) => setSettings((s) => ({ ...s, mode }))}
        options={[
          { value: 'classic', label: 'Classic', description: 'Imposters know they are the imposter and get a clue.' },
          { value: 'undercover', label: 'Undercover', description: 'Imposters get a similar decoy word and are not told.' },
        ]}
      />
      {isClassic && (
        <Segmented
          label="Imposter clue"
          value={settings.clue}
          onChange={(clue) => setSettings((s) => ({ ...s, clue }))}
          options={[
            { value: 'category', label: 'Category' },
            { value: 'category-hint', label: 'Category + hint' },
            { value: 'none', label: 'No clue' },
          ]}
        />
      )}
      <button type="button" className="row row--button" onClick={() => setView({ kind: 'categories' })}>
        <span className="row__text">
          <span className="row__label">Categories</span>
          <span className="row__hint">{selectedIds.length} selected</span>
        </span>
        <span className="row__chevron" aria-hidden="true">
          ›
        </span>
      </button>
      <Segmented
        label="Timer"
        value={settings.timerMinutes}
        onChange={(timerMinutes) => setSettings((s) => ({ ...s, timerMinutes: timerMinutes as TimerMinutes }))}
        options={TIMER_OPTIONS.map((m) => ({ value: m, label: m === 0 ? 'Off' : `${m} min` }))}
      />
      {isClassic && (
        <Toggle
          label="Troll Mode"
          subtitle="7% chance everyone is the imposter"
          checked={settings.trollMode}
          onChange={(trollMode) => setSettings((s) => ({ ...s, trollMode }))}
        />
      )}

      {view.kind === 'howto' && <HowToPlay onClose={() => setView({ kind: 'main' })} />}

      {confirmDiscard && p.savedGame && (
        <Confirm
          title="Discard the saved game?"
          message={`Round ${p.savedGame.round} scores will be lost.`}
          confirmLabel="Discard game"
          danger
          onConfirm={() => {
            setConfirmDiscard(false);
            p.onDiscard();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}

      {pendingEdit && (
        <Confirm
          title="Start a new game?"
          message="This starts a new game and resets scores."
          confirmLabel="Reset scores"
          danger
          onConfirm={() => {
            p.onResetGame();
            pendingEdit();
            setPendingEdit(null);
          }}
          onCancel={() => setPendingEdit(null)}
        />
      )}
    </Screen>
  );
}
