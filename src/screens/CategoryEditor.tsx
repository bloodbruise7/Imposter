import { useId, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Category, WordEntry } from '../game/types';
import { MAX_PART_LENGTH, MIN_WORDS, formatWordLines, parseWordLines, validateCategoryName, validateEntries } from '../custom/parseWords';
import { Button, Confirm, Screen } from '../components/ui';

interface Props {
  category: Category | null;
  takenNames: string[];
  onSave: (category: Category) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

interface Row extends WordEntry {
  id: number;
  /** Whether the hint and decoy fields are open for this word. */
  open: boolean;
}

export const CATEGORY_ICONS = ['📝', '🏠', '👨‍👩‍👧', '🎉', '🍕', '🐶', '⚽', '🎬', '🎵', '🚗', '🎮', '📚', '🌍', '🎄', '🧸', '⛪'];

let nextRowId = 1;
const newRow = (e: Partial<WordEntry> = {}): Row => ({
  id: nextRowId++,
  word: e.word ?? '',
  hint: e.hint ?? '',
  decoy: e.decoy ?? '',
  open: !!(e.hint || e.decoy),
});

export function CategoryEditor({ category, takenNames, onSave, onDelete, onCancel }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon && CATEGORY_ICONS.includes(category.icon) ? category.icon : CATEGORY_ICONS[0]);
  const [rows, setRows] = useState<Row[]>(() => (category ? category.words.map((w) => newRow(w)) : []));
  const [quick, setQuick] = useState('');
  const [quickError, setQuickError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [pasteText, setPasteText] = useState('');
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const nameId = useId();
  const quickRef = useRef<HTMLInputElement>(null);

  const nameError = validateCategoryName(name, takenNames);
  const result = useMemo(() => validateEntries(rows), [rows]);
  const errorByRow = new Map(result.errors.map((e) => [rows[e.index].id, e.message]));
  const canSave = !nameError && result.valid;
  const count = result.entries.length;
  const need = Math.max(0, MIN_WORDS - count);
  const hasWord = (w: string) => rows.some((r) => r.word.trim().toLowerCase() === w.toLowerCase());

  const addQuick = (e: FormEvent) => {
    e.preventDefault();
    const word = quick.trim();
    if (!word) return;
    if (hasWord(word)) {
      setQuickError(`"${word}" is already in the list`);
      return;
    }
    setRows((rs) => [...rs, newRow({ word })]);
    setQuick('');
    setQuickError(null);
    quickRef.current?.focus();
  };

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const save = () => {
    setTouched(true);
    if (!canSave) return;
    onSave({ id: category?.id ?? `custom-${Date.now()}`, name: name.trim(), icon, words: result.entries });
  };

  const copyWords = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard');
      await navigator.clipboard.writeText(formatWordLines(result.entries) + '\n');
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied('idle'), 2500);
  };

  const importPaste = () => {
    const parsed = parseWordLines(pasteText);
    const fresh = parsed.entries.filter((e) => !hasWord(e.word));
    if (fresh.length === 0) {
      setPasteNote(parsed.entries.length === 0 ? 'No words found. Put one word on each line.' : 'Those words are already in the list.');
      return;
    }
    setRows((rs) => [...rs, ...fresh.map((e) => newRow(e))]);
    setPasteText('');
    setPasteNote(`Added ${fresh.length} ${fresh.length === 1 ? 'word' : 'words'}.`);
  };

  const progress = Math.min(100, Math.round((count / MIN_WORDS) * 100));

  return (
    <Screen
      title={category ? 'Edit category' : 'New category'}
      actions={
        <>
          {touched && !canSave && (
            <p className="hint" role="status">
              {nameError ?? (need > 0 ? `Add ${need} more ${need === 1 ? 'word' : 'words'} to save.` : 'Fix the words marked above.')}
            </p>
          )}
          <div className="toolbar">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={save} disabled={touched && !canSave}>
              {count >= MIN_WORDS ? 'Save' : `Save (${count}/${MIN_WORDS})`}
            </Button>
          </div>
        </>
      }
    >
      <label className="field">
        <span className="field__label" id={nameId}>
          Category name
        </span>
        <input
          className={`input ${touched && nameError ? 'is-invalid' : ''}`}
          type="text"
          value={name}
          maxLength={30}
          aria-labelledby={nameId}
          aria-invalid={(touched && !!nameError) || undefined}
          autoComplete="off"
          autoCapitalize="words"
          autoFocus={!category}
          enterKeyHint="next"
          placeholder="Our family"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {touched && nameError && <span className="form-error">{nameError}</span>}
      </label>

      <div className="field">
        <span className="field__label">Icon</span>
        <div className="icons" role="radiogroup" aria-label="Category icon">
          {CATEGORY_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              role="radio"
              aria-checked={ic === icon}
              aria-label={`Icon ${ic}`}
              className={`icon-pick ${ic === icon ? 'is-selected' : ''}`}
              onClick={() => setIcon(ic)}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-title">Words</h2>
      <form className="quick" onSubmit={addQuick}>
        <input
          ref={quickRef}
          className={`input quick__input ${quickError ? 'is-invalid' : ''}`}
          type="text"
          value={quick}
          maxLength={MAX_PART_LENGTH}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          aria-label="Add a word"
          aria-invalid={!!quickError || undefined}
          placeholder="Type a word"
          onChange={(e) => {
            setQuick(e.target.value);
            setQuickError(null);
          }}
        />
        <Button type="submit" full={false} disabled={quick.trim() === ''}>
          Add
        </Button>
      </form>
      {quickError && (
        <p className="form-error" role="alert">
          {quickError}
        </p>
      )}

      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={MIN_WORDS} aria-valuenow={Math.min(count, MIN_WORDS)} aria-label="Words added">
        <div className="progress__bar" style={{ width: `${progress}%` }} />
      </div>
      <p className="hint" aria-live="polite">
        {count === 0
          ? `Add at least ${MIN_WORDS} words. Pick things everyone at the table knows.`
          : need > 0
            ? `${count} of ${MIN_WORDS} words. ${need} more to go.`
            : `${count} words. Add as many as you like.`}
      </p>

      {rows.length > 0 && (
        <ol className="wordrows">
          {rows.map((r, i) => {
            const error = touched ? errorByRow.get(r.id) : undefined;
            const n = i + 1;
            return (
              <li key={r.id} className={`wordrow ${error ? 'is-invalid' : ''}`}>
                <div className="wordrow__main">
                  <span className="wordrow__num" aria-hidden="true">
                    {n}
                  </span>
                  <input
                    className="input wordrow__word"
                    type="text"
                    value={r.word}
                    maxLength={MAX_PART_LENGTH}
                    autoComplete="off"
                    autoCapitalize="words"
                    aria-label={`Word ${n}`}
                    aria-invalid={!!error || undefined}
                    onChange={(e) => update(r.id, { word: e.target.value })}
                    onBlur={() => setTouched(true)}
                  />
                  <button type="button" className="wordrow__remove" onClick={() => remove(r.id)} aria-label={`Remove ${r.word.trim() || `word ${n}`}`}>
                    ×
                  </button>
                </div>
                {r.open ? (
                  <div className="wordrow__grid">
                    <label className="wordrow__field">
                      <span className="wordrow__label">Hint for the imposter</span>
                      <input
                        className="input"
                        type="text"
                        value={r.hint}
                        maxLength={MAX_PART_LENGTH}
                        autoComplete="off"
                        autoCapitalize="words"
                        aria-label={`Hint ${n}`}
                        placeholder="one word"
                        onChange={(e) => update(r.id, { hint: e.target.value })}
                      />
                    </label>
                    <label className="wordrow__field">
                      <span className="wordrow__label">Decoy for Undercover</span>
                      <input
                        className="input"
                        type="text"
                        value={r.decoy}
                        maxLength={MAX_PART_LENGTH}
                        autoComplete="off"
                        autoCapitalize="words"
                        aria-label={`Decoy ${n}`}
                        placeholder="a look-alike"
                        onChange={(e) => update(r.id, { decoy: e.target.value })}
                      />
                    </label>
                  </div>
                ) : (
                  <button type="button" className="wordrow__more" onClick={() => update(r.id, { open: true })}>
                    + Add a hint or decoy
                  </button>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <details className="details">
        <summary className="details__summary">What are hints and decoys?</summary>
        <div className="details__body">
          <p className="hint">
            In <strong>Classic</strong>, the imposter sees the category and the hint. A hint is one word that points at the answer
            without giving it away: for <em>Pizza</em>, the hint might be <em>Delivery</em>.
          </p>
          <p className="hint">
            In <strong>Undercover</strong>, the imposter isn't told they're the imposter. They just see the decoy as if it were their
            word: for <em>Pizza</em>, the decoy might be <em>Calzone</em>. Undercover only uses words that have a decoy.
          </p>
          <p className="hint">Both are optional. Without a hint, the imposter sees the category alone.</p>
        </div>
      </details>

      <details className="details">
        <summary className="details__summary">Share or paste a list</summary>
        <div className="details__body">
          {count > 0 && (
            <Button variant="ghost" onClick={copyWords}>
              {copied === 'done' ? 'Copied' : copied === 'failed' ? "Couldn't copy" : 'Copy this list'}
            </Button>
          )}
          <p className="hint">Paste a list someone sent you, one word per line.</p>
          <textarea
            className="input textarea textarea--short"
            value={pasteText}
            rows={4}
            aria-label="Paste a word list"
            spellCheck={false}
            onChange={(e) => {
              setPasteText(e.target.value);
              setPasteNote(null);
            }}
          />
          <Button variant="ghost" onClick={importPaste} disabled={pasteText.trim() === ''}>
            Add these words
          </Button>
          {pasteNote && (
            <p className="hint" role="status">
              {pasteNote}
            </p>
          )}
        </div>
      </details>

      {category && (
        <>
          <h2 className="section-title">Danger zone</h2>
          <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
            Delete category
          </Button>
        </>
      )}

      {confirmDelete && category && (
        <Confirm
          title={`Delete "${category.name}"?`}
          message="This removes the category and its words from this device."
          confirmLabel="Delete"
          danger
          onConfirm={() => onDelete(category.id)}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </Screen>
  );
}
