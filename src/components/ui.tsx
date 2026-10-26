import React, { useEffect, useState } from "react";
import { fieldHelp } from "../generator/fieldHelpCatalog";
import { useApp } from "../state/settingsStore";

/** Общий UI-кит панелей. Все подписи — русские, лежат в самих панелях. */

export function useFieldTitle(fieldKey?: string, hint?: string): string | undefined {
  const help = fieldKey ? fieldHelp.get(fieldKey) : null;
  return help ?? hint;
}

export function FieldError({ fieldKey }: { fieldKey?: string }) {
  const issues = useApp((s) => s.issues);
  if (!fieldKey) return null;
  const blocker = issues.find((i) => i.fieldKey === fieldKey && i.severity === "error");
  if (!blocker) return null;
  return <div className="field-error">{blocker.message}</div>;
}

export function FixButton({ fieldKey }: { fieldKey?: string }) {
  const issues = useApp((s) => s.issues);
  const applyFix = useApp((s) => s.applyFix);
  if (!fieldKey) return null;
  const blocker = issues.find((i) => i.fieldKey === fieldKey && i.severity === "error" && i.fix);
  if (!blocker?.fix) return null;
  const labels: Record<string, string> = {
    addNeutralZone: "Добавить нейтральную зону",
    switchToHubTopology: "Переключить на топологию «Хаб»",
    setDefaultTemplateName: "Подставить имя по умолчанию",
  };
  return (
    <button type="button" className="fix-button" onClick={() => applyFix(blocker.fix!)}>
      {labels[blocker.fix.kind] ?? "Исправить"}
    </button>
  );
}

export function withField<A>(
  fieldKey?: string,
  hint?: string,
): (props: A & { title?: string }) => A & { title?: string } {
  // Хелпер не используется напрямую; тултипы навешиваются внутри компонентов ниже.
  return ((props: object) => props) as never;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  fieldKey?: string;
  hint?: string;
  suffix?: string;
  disabled?: boolean;
  format?: (v: number) => string;
}

export function SliderRow(props: SliderRowProps) {
  const { label, value, min, max, step = 1, onChange, fieldKey, hint, suffix, disabled, format } = props;
  const title = useFieldTitle(fieldKey, hint);
  return (
    <div className={`slider-row${disabled ? " disabled" : ""}`} title={title}>
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="slider-value">
        {format ? format(value) : value}
        {suffix ?? ""}
      </span>
      <FieldError fieldKey={fieldKey} />
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  fieldKey?: string;
  hint?: string;
  suffix?: string;
  disabled?: boolean;
}

export function NumberField(props: NumberFieldProps) {
  const { label, value, min, max, step = 1, onChange, fieldKey, hint, suffix, disabled } = props;
  const title = useFieldTitle(fieldKey, hint);
  return (
    <div className="field-row" title={title}>
      <label>{label}</label>
      <span className="field-input">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </span>
      <FieldError fieldKey={fieldKey} />
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  fieldKey?: string;
  hint?: string;
  disabled?: boolean;
}

export function TextField(props: TextFieldProps) {
  const { label, value, onChange, placeholder, fieldKey, hint, disabled } = props;
  const title = useFieldTitle(fieldKey, hint);
  return (
    <div className="field-row" title={title}>
      <label>{label}</label>
      <span className="field-input">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <FixButton fieldKey={fieldKey} />
      </span>
      <FieldError fieldKey={fieldKey} />
    </div>
  );
}

interface TextAreaProps {
  label: string;
  value: string;
  rows?: number;
  onChange: (v: string) => void;
  placeholder?: string;
  fieldKey?: string;
  hint?: string;
}

export function TextArea(props: TextAreaProps) {
  const { label, value, rows = 3, onChange, placeholder, fieldKey, hint } = props;
  const title = useFieldTitle(fieldKey, hint);
  return (
    <div className="field-row align-top" title={title}>
      <label>{label}</label>
      <span className="field-input">
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      <FieldError fieldKey={fieldKey} />
    </div>
  );
}

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
}

interface SelectFieldProps<V extends string | number> {
  label: string;
  value: V;
  options: SelectOption<V>[];
  onChange: (v: V) => void;
  fieldKey?: string;
  hint?: string;
  disabled?: boolean;
}

export function SelectField<V extends string | number>(props: SelectFieldProps<V>) {
  const { label, value, options, onChange, fieldKey, hint, disabled } = props;
  const title = useFieldTitle(fieldKey, hint);
  return (
    <div className="field-row" title={title}>
      <label>{label}</label>
      <span className="field-input">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            onChange((typeof value === "number" ? Number(raw) : raw) as V);
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <FixButton fieldKey={fieldKey} />
      </span>
      <FieldError fieldKey={fieldKey} />
    </div>
  );
}

interface CheckboxRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  fieldKey?: string;
  hint?: string;
  disabled?: boolean;
}

export function CheckboxRow(props: CheckboxRowProps) {
  const { label, checked, onChange, fieldKey, hint, disabled } = props;
  const title = useFieldTitle(fieldKey, hint);
  return (
    <div className={`check-row${disabled ? " disabled" : ""}`} title={title}>
      <label>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      <FieldError fieldKey={fieldKey} />
    </div>
  );
}

/** Трёхпозиционный выбор: авто (null) / да / нет. */
export function TriStateSelect(props: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  fieldKey?: string;
  hint?: string;
}) {
  const { label, value, onChange, fieldKey, hint } = props;
  const title = useFieldTitle(fieldKey, hint);
  return (
    <div className="field-row" title={title}>
      <label>{label}</label>
      <span className="field-input">
        <select
          value={value === null ? "auto" : value ? "yes" : "no"}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "auto" ? null : v === "yes");
          }}
        >
          <option value="auto">Авто</option>
          <option value="yes">Да</option>
          <option value="no">Нет</option>
        </select>
      </span>
      <FieldError fieldKey={fieldKey} />
    </div>
  );
}

export function Chip(props: { label: string; active: boolean; onClick: () => void; title?: string }) {
  return (
    <button type="button" className={`chip${props.active ? " active" : ""}`} title={props.title} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

export function Card(props: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h3>
        {props.title}
        {props.badge && <span className="badge experimental">{props.badge}</span>}
      </h3>
      <div className="card-body">{props.children}</div>
    </section>
  );
}

export function Collapsible(props: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  return (
    <div className="collapsible">
      <button type="button" className="collapsible-summary" onClick={() => setOpen(!open)}>
        <span className={`arrow${open ? " open" : ""}`}>▸</span> {props.summary}
      </button>
      {open && <div className="collapsible-body">{props.children}</div>}
    </div>
  );
}

/** Мини-тосты. */
export interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

let toastSeq = 1;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (text: string, kind: Toast["kind"] = "info") => {
    const id = toastSeq++;
    setToasts((t) => [...t, { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  };
  return { toasts, push };
}

export function ToastArea({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-area">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/** Ctrl/Cmd+Z / Ctrl+Shift+Z / Ctrl+Y — глобальные хоткеи undo/redo. */
export function useUndoRedoHotkeys(undo: () => void, redo: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
}
