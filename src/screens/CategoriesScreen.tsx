import type { Category } from '../game/types';
import { Button, Screen } from '../components/ui';

interface Props {
  builtin: Category[];
  custom: Category[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onEdit: (category: Category | null) => void;
  onBack: () => void;
}

export function CategoriesScreen({ builtin, custom, selected, onChange, onEdit, onBack }: Props) {
  const isOn = (id: string) => selected.includes(id);
  const toggle = (id: string) => onChange(isOn(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const allIds = [...builtin, ...custom].map((c) => c.id);

  const row = (c: Category) => (
    <li key={c.id} className="cat">
      <label className="cat__main">
        <input type="checkbox" checked={isOn(c.id)} onChange={() => toggle(c.id)} />
        <span className="cat__icon" aria-hidden="true">
          {c.icon}
        </span>
        <span className="cat__text">
          <span className="cat__name">{c.name}</span>
          <span className="cat__count">{c.words.length} words</span>
        </span>
      </label>
    </li>
  );

  return (
    <Screen
      title="Categories"
      actions={
        <>
          <p className="hint" role="status">
            {selected.length} selected
          </p>
          <Button onClick={onBack}>Done</Button>
        </>
      }
    >
      <div className="toolbar">
        <Button variant="secondary" full={false} onClick={() => onChange(allIds)}>
          Select all
        </Button>
        <Button variant="secondary" full={false} onClick={() => onChange([])}>
          Clear
        </Button>
      </div>
      <ul className="cats">{builtin.map(row)}</ul>

      <h2 className="section-title">My Categories</h2>
      {custom.length === 0 && <p className="hint">Make your own list: inside jokes, family names, your town.</p>}
      <ul className="cats">
        {custom.map((c) => (
          <li key={c.id} className="cat">
            <label className="cat__main">
              <input type="checkbox" checked={isOn(c.id)} onChange={() => toggle(c.id)} />
              <span className="cat__icon" aria-hidden="true">
                {c.icon || '📝'}
              </span>
              <span className="cat__text">
                <span className="cat__name">{c.name}</span>
                <span className="cat__count">{c.words.length} words</span>
              </span>
            </label>
            <Button variant="ghost" full={false} onClick={() => onEdit(c)} aria-label={`Edit ${c.name}`}>
              Edit
            </Button>
          </li>
        ))}
      </ul>
      <Button variant="secondary" onClick={() => onEdit(null)}>
        New category
      </Button>
    </Screen>
  );
}
