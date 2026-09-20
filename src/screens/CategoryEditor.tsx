import { useId, useMemo, useRef, useState } from 'react';
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
}

let nextRowId = 1;
const newRow = (e: Partial<WordEntry> = {}): Row => ({ id: nextRowId++, word: e.word ?? '', hint: e.hint ?? '', decoy: e.decoy ?? '' });

export function CategoryEditor({ category, takenNames, onSave, onDelete, onCancel }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    category ? category.words.map((w) => newRow(w)) : Array.from({ length: MIN_WORDS }, () => newRow()),
  );
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [pasteText, setPasteText] = useState('');
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const nameId = useId();
  const listRef = useRef<HTMLOListElement>(null);

  const nameError = validateCategoryName(name, takenNames);
  const result = useMemo(() => validateEntries(rows), [rows]);
  const errorByRow = new Map(result.errors.map((e) => [rows[e.index].id, e.message]));
  const canSave = !nameError && result.valid;
  const need = Math.max(0, MIN_WORDS - result.entries.length);

  const update = (id: number, patch: Partial<WordEntry>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const remove = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const addRow = () => {
    setRows((rs) => [...rs, newRow()]);
    // Focus the new word field once it renders.
    requestAnimationFrame(() => {
      const inputs = listRef.current?.querySelectorAll<HTMLInputElement>('input[data-field="word"]');
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  const save = () => {
    setTouched(true);
    if (!canSave) return;
    onSave({
      id: category?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      icon: '📝',
      words: result.entries,
    });
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
    const fresh = parsed.entries.filter((e) => !rows.some((r) => r.word.trim().toLowerCase() === e.word.toLowerCase()));
    if (fresh.length === 0) {
      setPasteNote(parsed.entries.length === 0 ? 'No words found. One word per line.' : 'Those words are already in the list.');
      return;
    }
    setRows((rs) => [...rs.filter((r) => r.word.trim() || r.hint.trim() || r.decoy.trim()), ...fresh.map((e) => newRow(e))]);
    setPasteText('');
    setPasteNote(`Added ${fresh.length} ${fresh.length === 1 ? 'word' : 'words'}.`);
  };

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
              Save
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
          placeholder="Family jokes"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {touched && nameError && <span className="form-error">{nameError}</span>}
      </label>

      <h2 className="section-title">Words</h2>
      <p className="hint">
        At least {MIN_WORDS} words. The <strong>hint</strong> is what the imposter sees in Classic. The <strong>decoy</strong> is a
        look-alike word the imposter gets in Undercover. Both are optional.
      </p>

      <ol className="wordrows" ref={listRef}>
        {rows.map((r, i) => {
          const error = touched ? errorByRow.get(r.id) : undefined;
          const n = i + 1;
          return (
            <li key={r.id} className={`wordrow ${error ? 'is-invalid' : ''}`}>
              <div className="wordrow__head">
                <span className="wordrow__num">Word {n}</span>
                <button type="button" className="wordrow__remove" onClick={() => remove(r.id)} aria-label={`Remove word ${n}`}>
                  ×
                </button>
              </div>
              <div className="wordrow__grid">
                <label className="wordrow__field wordrow__field--word">
                  <span className="wordrow__label">Word</span>
                  <input
                    className="input"
                    type="text"
                    data-field="word"
                    value={r.word}
                    maxLength={MAX_PART_LENGTH}
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    aria-label={`Word ${n}`}
                    aria-invalid={!!error || undefined}
                    onChange={(e) => update(r.id, { word: e.target.value })}
                    onBlur={() => setTouched(true)}
                  />
                </label>
                <label className="wordrow__field">
                  <span className="wordrow__label">Hint</span>
                  <input
                    className="input"
                    type="text"
                    value={r.hint}
                    maxLength={MAX_PART_LENGTH}
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    aria-label={`Hint ${n}`}
                    placeholder="optional"
                    onChange={(e) => update(r.id, { hint: e.target.value })}
                  />
                </label>
                <label className="wordrow__field">
                  <span className="wordrow__label">Decoy</span>
                  <input
                    className="input"
                    type="text"
                    value={r.decoy}
                    maxLength={MAX_PART_LENGTH}
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    aria-label={`Decoy ${n}`}
                    placeholder="optional"
                    onChange={(e) => update(r.id, { decoy: e.target.value })}
                  />
                </label>
              </div>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <Button variant="secondary" onClick={addRow}>
        + Add a word
      </Button>

      <p className="hint" aria-live="polite">
        {result.entries.length} {result.entries.length === 1 ? 'word' : 'words'} ready
        {need > 0 && `, need ${need} more`}
      </p>

      <details className="details">
        <summary className="details__summary">Share or paste a list</summary>
        <div className="details__body">
          {result.entries.length > 0 && (
            <Button variant="ghost" onClick={copyWords}>
              {copied === 'done' ? 'Copied' : copied === 'failed' ? "Couldn't copy" : 'Copy this list'}
            </Button>
          )}
          <p className="hint">
            Paste a list someone sent you, one word per line. Add a hint or decoy after a bar, like <code>Pizza | Delivery | Calzone</code>.
          </p>
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
