import { useApp } from "../../state/settingsStore";
import {
  Card,
  CheckboxRow,
  NumberField,
  SelectField,
  SliderRow,
  TextArea,
  TextField,
  type SelectOption,
} from "../../components/ui";
import {
  EXPERIMENTAL_MAP_SIZES,
  MAP_SIZES,
  isExperimentalMapSize,
  mapSizeLabel,
} from "../../generator/knownValues";

const T = {
  templateCard: "Шаблон",
  templateName: "Имя шаблона",
  description: "Описание",
  descriptionPlaceholder: "Пусто — автогенерируемый текст",
  descriptionHint:
    "Переопределяет автоматически генерируемое поле description. Пустое значение — генератор сам составит описание (топология, число зон и т.п.).",
  mapCard: "Карта",
  mapSize: "Размер карты",
  mapSizeExperimentalSuffix: "— экспериментальный",
  experimentalSizes: "Экспериментальные большие размеры",
  experimentalSizesHint:
    "Добавляет размеры от 256×256 до 512×512. Официальные шаблоны ограничены 240×240, поэтому такие карты могут не создаться, зависнуть или повести себя непредсказуемо в игре.",
  experimentalSelectedButOffHint:
    "Выбран экспериментальный размер карты, но флажок «Экспериментальные большие размеры» выключен. Значение оставлено в списке, чтобы не терять выбор.",
  seed: "Seed",
  seedRandom: "🎲 Случайный",
  seedSetRandom: "🎲 Задать случайный",
  seedHint:
    "Seed делает генерацию воспроизводимой: одинаковый seed при одинаковых настройках даёт идентичный файл шаблона. 0 или пустое значение — случайный seed при каждой генерации. Раскладка самой карты в игре выбирается отдельно при старте матча.",
  players: "Игроки",
};

/** Предупреждения (не блокеры) по полю: ui-кит показывает только ошибки. */
function FieldWarnings(props: { fieldKey: string }) {
  const issues = useApp((s) => s.issues);
  const warnings = issues.filter(
    (i) => i.fieldKey === props.fieldKey && i.severity === "warning",
  );
  if (warnings.length === 0) return null;
  return (
    <>
      {warnings.map((w, idx) => (
        <div key={idx} className="hint">
          {w.message}
        </div>
      ))}
    </>
  );
}

export function MapSettingsPanel() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  const sizeOptions: SelectOption<number>[] = (
    file.experimentalMapSizes ? [...MAP_SIZES, ...EXPERIMENTAL_MAP_SIZES] : [...MAP_SIZES]
  ).map((size) => ({
    value: size,
    label: isExperimentalMapSize(size)
      ? `${size} (${mapSizeLabel(size)}) ${T.mapSizeExperimentalSuffix}`
      : `${size} (${mapSizeLabel(size)})`,
  }));
  // Экспериментальный размер остаётся выбираемым, даже если флажок выключен,
  // чтобы загруженный файл не «терял» выбранное значение.
  if (!file.experimentalMapSizes && isExperimentalMapSize(file.mapSize)) {
    sizeOptions.push({
      value: file.mapSize,
      label: `${file.mapSize} (${mapSizeLabel(file.mapSize)}) ${T.mapSizeExperimentalSuffix}`,
    });
  }

  return (
    <>
      <Card title={T.templateCard}>
        <TextField
          label={T.templateName}
          value={file.templateName}
          onChange={(v) => patch((f) => { f.templateName = v; })}
          fieldKey="template.name"
        />
        <TextArea
          label={T.description}
          value={file.descriptionOverride}
          placeholder={T.descriptionPlaceholder}
          onChange={(v) => patch((f) => { f.descriptionOverride = v; })}
        />
        <div className="hint">{T.descriptionHint}</div>
      </Card>

      <Card title={T.mapCard}>
        <SelectField
          label={T.mapSize}
          value={file.mapSize}
          options={sizeOptions}
          onChange={(v) => patch((f) => { f.mapSize = v; })}
          fieldKey="map.size"
        />
        <CheckboxRow
          label={T.experimentalSizes}
          checked={file.experimentalMapSizes}
          onChange={(v) => patch((f) => { f.experimentalMapSizes = v; })}
        />
        {file.experimentalMapSizes && <div className="hint">{T.experimentalSizesHint}</div>}
        {!file.experimentalMapSizes && isExperimentalMapSize(file.mapSize) && (
          <div className="hint">{T.experimentalSelectedButOffHint}</div>
        )}
        <FieldWarnings fieldKey="map.size" />

        <NumberField
          label={T.seed}
          value={file.seed ?? 0}
          min={0}
          step={1}
          onChange={(v) =>
            patch((f) => {
              // Пустой ввод Number() превращает в 0; трактуем 0 как «случайный seed».
              f.seed = Number.isFinite(v) && Math.round(v) > 0 ? Math.round(v) : null;
            })
          }
          fieldKey="seed"
        />
        <div className="field-input">
          <button type="button" onClick={() => patch((f) => { f.seed = null; })}>
            {T.seedRandom}
          </button>
          <button
            type="button"
            onClick={() => patch((f) => { f.seed = Math.floor(Math.random() * 2147483647); })}
          >
            {T.seedSetRandom}
          </button>
        </div>
        <div className="hint">{T.seedHint}</div>

        <SliderRow
          label={T.players}
          value={file.playerCount}
          min={2}
          max={8}
          step={1}
          onChange={(v) => patch((f) => { f.playerCount = v; })}
          fieldKey="map.players"
        />
      </Card>
    </>
  );
}
