import { T } from "../i18n/ru";

export type SectionKey = keyof typeof T.sections;

export const SECTION_KEYS: SectionKey[] = [
  "map",
  "heroes",
  "topology",
  "zones",
  "winConditions",
  "experimental",
];

export function SectionNav(props: {
  active: SectionKey;
  onSelect: (key: SectionKey) => void;
  blockers: number;
}) {
  const keys = SECTION_KEYS;
  return (
    <nav className="section-nav">
      {keys.map((key) => (
        <button
          key={key}
          className={props.active === key ? "active" : ""}
          onClick={() => props.onSelect(key)}
        >
          {T.sections[key]}
        </button>
      ))}
      <div className="validation-summary">
        {props.blockers > 0 ? `Блокирующих ошибок: ${props.blockers}` : ""}
      </div>
    </nav>
  );
}
