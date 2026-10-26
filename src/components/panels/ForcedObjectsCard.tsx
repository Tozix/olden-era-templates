import { useApp } from "../../state/settingsStore";
import { Card, NumberField, SelectField, type SelectOption } from "../ui";
import { allSidCatalogEntries } from "../../generator/zoneContent/sidCatalog";
import type { ForcedObjectFile } from "../../generator/settingsFile";

const T = {
  title: "Гарантированный контент",
  badge: "Экспериментально",
  hint: "Размещает указанные объекты в зонах: count копий на карту, распределение по кругу. Например, утопии драконов: SID dragon_utopia, цель — нейтральные зоны.",
  targetPlayer: "Зоны игроков",
  targetNeutral: "Нейтральные зоны",
  object: "Объект",
  count: "Копий",
  target: "Куда",
  add: "+ Добавить объект",
  addUtopias: "+ Утопии драконов",
  remove: "Удалить",
};

const sidOptions: SelectOption<string>[] = allSidCatalogEntries()
  .map((e) => ({ value: e.sid, label: `${e.friendlyName ?? e.sid} (${e.sid})` }))
  .sort((a, b) => a.label.localeCompare(b.label));

export function ForcedObjectsCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);
  const rows = file.forcedContent;

  const update = (index: number, mutate: (row: ForcedObjectFile) => void) => {
    patch((f) => {
      const row = { ...f.forcedContent[index] };
      mutate(row);
      f.forcedContent = f.forcedContent.map((r, i) => (i === index ? row : r));
    });
  };

  return (
    <Card title={T.title} badge={T.badge}>
      <div className="hint">{T.hint}</div>
      <div className="rows-editor">
        {rows.map((row, i) => (
          <div className="row-editor" key={i}>
            <span className="grow">
              <SelectField
                label={T.object}
                value={row.sid}
                options={sidOptions.some((o) => o.value === row.sid) ? sidOptions : [{ value: row.sid, label: row.sid }, ...sidOptions]}
                onChange={(v) => update(i, (r) => { r.sid = v; })}
              />
            </span>
            <NumberField label={T.count} value={row.count} min={1} max={20} onChange={(v) => update(i, (r) => { r.count = Math.max(1, Math.min(20, v || 1)); })} />
            <SelectField
              label={T.target}
              value={row.zoneTarget}
              options={[
                { value: "neutral" as const, label: T.targetNeutral },
                { value: "player" as const, label: T.targetPlayer },
              ]}
              onChange={(v) => update(i, (r) => { r.zoneTarget = v; })}
            />
            <button className="icon" title={T.remove} onClick={() => patch((f) => { f.forcedContent = f.forcedContent.filter((_, idx) => idx !== i); })}>🗑</button>
          </div>
        ))}
      </div>
      <div className="chips">
        <button
          className="chip"
          onClick={() =>
            patch((f) => {
              f.forcedContent = [
                ...f.forcedContent,
                { sid: "dragon_utopia", count: 3, zoneTarget: "neutral" as const },
              ];
            })
          }
        >
          {T.addUtopias}
        </button>
        <button
          className="chip"
          onClick={() =>
            patch((f) => {
              f.forcedContent = [
                ...f.forcedContent,
                { sid: "", count: 1, zoneTarget: "neutral" as const },
              ];
            })
          }
        >
          {T.add}
        </button>
      </div>
    </Card>
  );
}
