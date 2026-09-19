import { useId, useMemo, useState } from 'react';
import type { Category } from '../game/types';
import { MIN_WORDS, formatWordLines, parseWordLines, validateCategoryName } from '../custom/parseWords';
import { Button, Confirm, Screen } from '../components/ui';

interface Props {
  category: Category | null;
  takenNames: string[];
  onSave: (category: Category) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

export function CategoryEditor({ category, takenNames, onSave, onDelete, onCancel }: Props) {
  const [name, setName] = useState(category?.name ?? '');
  const [text, setText] = useState(category ? formatWordLines(category.words) : '');
  const [touched, setTouched] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameId = useId();
  const wordsId = useId();
  const helpId = useId();

  const nameError = validateCategoryName(name, takenNames);
  const parsed = useMemo(() => parseWordLines(text), [text]);
  const canSave = !nameError && parsed.valid;

  const save = () => {
    setTouched(true);
    if (!canSave) return;
    onSave({
      id: category?.id ?? `custom-${Date.now()}`,
      name: name.trim(),
      icon: '📝',
      words: parsed.entries,
    });
  };

  return (
    <Screen
      title={category ? 'Edit category' : 'New category'}
      actions={
        <>
          <div className="toolbar">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={save} disabled={touched && !canSave}>
              Save
            </Button>
          </div>
          {category && (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)}>
              Delete category
            </Button>
          )}
        </>
      }
    >
      <label className="field">
        <span className="field__label" id={nameId}>
          Name
        </span>
        <input
          className={`input ${touched && nameError ? 'is-invalid' : ''}`}
          type="text"
          value={name}
          maxLength={30}
          aria-labelledby={nameId}
          aria-invalid={(touched && !!nameError) || undefined}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {touched && nameError && <span className="form-error">{nameError}</span>}
      </label>

      <label className="field">
        <span className="field__label" id={wordsId}>
          Words, one per line
        </span>
        <span className="hint" id={helpId}>
          Format: <code>word | hint | decoy</code>. Hint and decoy are optional. At least {MIN_WORDS} words.
        </span>
        <textarea
          className={`input textarea ${touched && parsed.errors.length ? 'is-invalid' : ''}`}
          rows={10}
          value={text}
          aria-labelledby={wordsId}
          aria-describedby={helpId}
          autoCapitalize="words"
          spellCheck={false}
          placeholder={'Pizza | Delivery | Calzone\nTaco | Crunchy\nSushi'}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => setTouched(true)}
        />
      </label>

      <p className="hint" aria-live="polite">
        {parsed.entries.length} {parsed.entries.length === 1 ? 'word' : 'words'}
        {parsed.entries.length < MIN_WORDS && ` (need ${MIN_WORDS - parsed.entries.length} more)`}
      </p>
      {parsed.errors.length > 0 && (
        <ul className="errors" aria-live="polite">
          {parsed.errors.map((e) => (
            <li key={e.line} className="form-error">
              Line {e.line}: {e.message}
            </li>
          ))}
        </ul>
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
