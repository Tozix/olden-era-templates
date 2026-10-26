import { useApp } from "../../state/settingsStore";
import { Card, SliderRow } from "../ui";

const T = {
  cardTitle: "Плотность рельефа",
  obstacles: "Препятствия",
  lakes: "Озёра",
  hint:
    "0 % — значение генератора по умолчанию. Препятствия создают узкие проходы, озёра добавляют водные пространства.",
};

export function TerrainCard() {
  const file = useApp((s) => s.file);
  const patch = useApp((s) => s.patch);

  return (
    <Card title={T.cardTitle}>
      <div className="hint">{T.hint}</div>
      <SliderRow
        label={T.obstacles}
        min={0}
        max={100}
        suffix="%"
        value={Math.round(file.terrainObstaclesFill * 100)}
        onChange={(v) =>
          patch((f) => {
            f.terrainObstaclesFill = v / 100;
          })
        }
      />
      <SliderRow
        label={T.lakes}
        min={0}
        max={100}
        suffix="%"
        value={Math.round(file.terrainLakesFill * 100)}
        onChange={(v) =>
          patch((f) => {
            f.terrainLakesFill = v / 100;
          })
        }
      />
    </Card>
  );
}
