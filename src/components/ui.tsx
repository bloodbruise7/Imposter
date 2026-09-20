import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
}

export function Button({ variant = 'primary', full = true, className = '', type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={`btn btn--${variant} ${full ? 'btn--full' : ''} ${className}`} {...rest} />;
}

interface ScreenProps {
  title?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Full-height screen: header, scrolling body, pinned action bar. */
export function Screen({ title, eyebrow, children, actions, className = '' }: ScreenProps) {
  return (
    <section className={`screen ${className}`}>
      {(title || eyebrow) && (
        <header className="screen__header">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          {title && <h1 className="screen__title">{title}</h1>}
        </header>
      )}
      <div className="screen__body">{children}</div>
      {actions && <div className="screen__actions">{actions}</div>}
    </section>
  );
}

interface StepperProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

export function Stepper({ label, hint, value, min, max, onChange }: StepperProps) {
  const id = useId();
  return (
    <div className="row">
      <div className="row__text">
        <span className="row__label" id={id}>
          {label}
        </span>
        {hint && <span className="row__hint">{hint}</span>}
      </div>
      <div className="stepper" role="group" aria-labelledby={id}>
        <button type="button" className="stepper__btn" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
          −
        </button>
        <output className="stepper__value" aria-live="polite">
          {value}
        </output>
        <button type="button" className="stepper__btn" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
          +
        </button>
      </div>
    </div>
  );
}

export interface Option<T extends string | number> {
  value: T;
  label: string;
  description?: string;
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Stack options vertically with descriptions (for mode/clue) instead of a compact row. */
  stacked?: boolean;
}

export function Segmented<T extends string | number>({ label, options, value, onChange, stacked }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className={`seg ${stacked ? 'seg--stacked' : ''}`}>
      <legend className="row__label">{label}</legend>
      <div className="seg__options">
        {options.map((o) => (
          <label key={String(o.value)} className={`seg__option ${o.value === value ? 'is-selected' : ''}`}>
            <input type="radio" name={name} value={String(o.value)} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span className="seg__label">{o.label}</span>
            {o.description && <span className="seg__desc">{o.description}</span>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface ToggleProps {
  label: string;
  subtitle?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function Toggle({ label, subtitle, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="row">
      <div className="row__text">
        <label className="row__label" htmlFor={id}>
          {label}
        </label>
        {subtitle && <span className="row__hint">{subtitle}</span>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
        <span className="switch__knob" />
      </button>
    </div>
  );
}

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
  role?: 'dialog' | 'alertdialog';
  /** Center the panel on screen instead of docking it to the bottom. */
  center?: boolean;
}

/** Overlay sheet. Escape closes; focus moves inside on open and returns on close. */
export function Modal({ title, onClose, children, actions, role = 'dialog', center = false }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('button, [href], input, textarea, [tabindex]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-modal');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-modal');
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className={`modal ${center ? 'modal--center' : ''}`} onClick={onClose}>
      <div className="modal__panel" role={role} aria-modal="true" aria-labelledby={titleId} ref={panel} onClick={(e) => e.stopPropagation()}>
        <h2 className="modal__title" id={titleId}>
          {title}
        </h2>
        <div className="modal__body">{children}</div>
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({ title, message, confirmLabel, danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      role="alertdialog"
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p>{message}</p>}
    </Modal>
  );
}
