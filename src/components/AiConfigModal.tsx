import { useEffect, useState } from "react";
import { useAssistant } from "../state/assistantStore";
import { checkAiConnection } from "../ai/openaiClient";
import type { AiConfig } from "../desktop/bridge";

const T = {
  title: "Настройки ИИ-ассистента",
  baseUrl: "Адрес API (base URL)",
  baseUrlHint: "OpenAI: https://api.openai.com/v1 · OpenRouter: https://openrouter.ai/api/v1 · LM Studio: http://localhost:1234/v1 · Ollama: http://localhost:11434/v1",
  apiKey: "API-ключ",
  apiKeyHint: "Ключ хранится только на этом компьютере (appData/ai-config.json).",
  model: "Модель",
  modelHint: "Например: gpt-4o-mini, deepseek-chat, qwen2.5:7b",
  check: "Проверить связь",
  save: "Сохранить",
  cancel: "Отмена",
};

const MODEL_SUGGESTIONS = [
  "gpt-4o-mini",
  "gpt-4o",
  "gpt-4.1-mini",
  "deepseek-chat",
  "openrouter/auto",
  "qwen2.5:7b",
];

export function AiConfigModal() {
  const config = useAssistant((s) => s.config);
  const saveConfig = useAssistant((s) => s.saveConfig);
  const setConfigOpen = useAssistant((s) => s.setConfigOpen);

  const [draft, setDraft] = useState<AiConfig>(config);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  useEffect(() => setDraft(config), [config]);

  const field = (key: keyof AiConfig, value: string) => setDraft({ ...draft, [key]: value });

  return (
    <div className="modal-backdrop" onClick={() => setConfigOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{T.title}</h3>
        <div className="modal-body">
          <div className="field-row align-top" title={T.baseUrlHint}>
            <label>{T.baseUrl}</label>
            <span className="field-input">
              <input
                type="text"
                value={draft.baseUrl}
                placeholder="https://api.openai.com/v1"
                onChange={(e) => field("baseUrl", e.target.value)}
              />
            </span>
          </div>
          <div className="hint">{T.baseUrlHint}</div>

          <div className="field-row align-top">
            <label>{T.apiKey}</label>
            <span className="field-input">
              <input
                type="password"
                value={draft.apiKey}
                placeholder="sk-…"
                autoComplete="off"
                onChange={(e) => field("apiKey", e.target.value)}
              />
            </span>
          </div>
          <div className="hint">{T.apiKeyHint}</div>

          <div className="field-row align-top">
            <label>{T.model}</label>
            <span className="field-input">
              <input
                type="text"
                list="ai-model-suggestions"
                value={draft.model}
                onChange={(e) => field("model", e.target.value)}
              />
              <datalist id="ai-model-suggestions">
                {MODEL_SUGGESTIONS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </span>
          </div>
          <div className="hint">{T.modelHint}</div>

          {checkResult && <div className={`hint ${checkResult.startsWith("✅") ? "" : "ai-check-fail"}`}>{checkResult}</div>}
        </div>
        <div className="preset-row">
          <button
            disabled={checking}
            onClick={() => {
              void (async () => {
                setChecking(true);
                setCheckResult(null);
                const res = await checkAiConnection(draft);
                setCheckResult(res.ok ? `✅ ${res.detail}` : `❌ ${res.detail}`);
                setChecking(false);
              })();
            }}
          >
            {checking ? "…" : T.check}
          </button>
          <span className="spacer" />
          <button className="primary" onClick={() => void saveConfig(draft)}>{T.save}</button>
          <button onClick={() => setConfigOpen(false)}>{T.cancel}</button>
        </div>
      </div>
    </div>
  );
}
