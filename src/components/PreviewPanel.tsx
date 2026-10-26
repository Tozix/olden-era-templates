import { T } from "../i18n/ru";
import { useApp } from "../state/settingsStore";
import { Rng } from "../generator/rng";
import { patchSeed } from "./panels/seedPatch";

export function PreviewPanel(props: {
  onGenerate: () => void;
  generating: boolean;
  blockers: string[];
  onSaveTemplate: () => void;
}) {
  const previewDataUrl = useApp((s) => s.previewDataUrl);
  const file = useApp((s) => s.file);

  return (
    <div className="preview-col">
      <div className="generate-block">
        <button className="primary" onClick={props.onGenerate} disabled={props.generating}>
          {props.generating ? T.generating : T.generate}
        </button>
        {props.blockers.length > 0 && (
          <div className="blockers">{props.blockers.join("\n")}</div>
        )}
        <button onClick={props.onSaveTemplate}>{T.saveTemplate}</button>
      </div>

      {previewDataUrl ? (
        <div className="preview-scroll">
          <img className="preview-img" src={previewDataUrl} alt="Превью карты" />
        </div>
      ) : (
        <div className="hint">{T.noPreview}</div>
      )}

      <div className="preview-seed">
        {T.seedUsed}: {file.seed ?? T.seedAuto}
      </div>
      <button
        onClick={() => {
          // Новый случайный seed + сразу регенерируем — как кнопка Reseed в веб-версии.
          patchSeed(Rng.randomSeed());
          props.onGenerate();
        }}
      >
        {T.reseed}
      </button>
    </div>
  );
}
