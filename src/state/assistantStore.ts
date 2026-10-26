import { create } from "zustand";
import { buildSystemPrompt } from "../ai/systemPrompt";
import { AiClientError, parseToolArguments, streamChat } from "../ai/openaiClient";
import { applySettingsPatch } from "../ai/patching";
import type { AiMessageParam, AiToolCall, ChatUiMessage } from "../ai/types";
import { defaultAiConfig, loadAiConfig, saveAiConfig, type AiConfig } from "../desktop/bridge";
import { useApp } from "./settingsStore";
import { fromFile } from "../generator/settingsMapper";
import { validate } from "../generator/settingsValidator";
import { toJsonCompact } from "../generator/json";
import { runGeneration } from "./generationActions";

/**
 * Чат-стор AI-ассистента. Цикл: user → stream → (tool_calls → выполнение →
 * tool-результат → снова stream), до 6 итераций за один ход пользователя.
 */

let uiId = 1;
let activeAbort: AbortController | null = null;

const MAX_TOOL_ITERATIONS = 6;

interface AssistantStore {
  messages: ChatUiMessage[];
  streaming: boolean;
  error: string | null;
  config: AiConfig;
  configLoaded: boolean;
  configOpen: boolean;

  init: () => Promise<void>;
  setConfigOpen: (open: boolean) => void;
  saveConfig: (config: AiConfig) => Promise<void>;
  send: (text: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
}

const RU_FIELD_LABELS_MAX = 8;

function actionsLabel(applied: string[]): string {
  const shown = applied.slice(0, RU_FIELD_LABELS_MAX).join(", ");
  return applied.length > RU_FIELD_LABELS_MAX ? `${shown} +${applied.length - RU_FIELD_LABELS_MAX}` : shown;
}

export const useAssistant = create<AssistantStore>((set, get) => ({
  messages: [],
  streaming: false,
  error: null,
  config: defaultAiConfig(),
  configLoaded: false,
  configOpen: false,

  init: async () => {
    if (get().configLoaded) return;
    const config = await loadAiConfig();
    set({ config, configLoaded: true });
  },

  setConfigOpen: (open) => set({ configOpen: open }),

  saveConfig: async (config) => {
    set({ config, configOpen: false });
    await saveAiConfig(config);
  },

  stop: () => {
    activeAbort?.abort();
    activeAbort = null;
    set({ streaming: false });
  },

  clear: () => {
    activeAbort?.abort();
    set({ messages: [], error: null, streaming: false });
  },

  send: async (text) => {
    const { config, messages, streaming } = get();
    if (streaming || !text.trim()) return;

    set({
      streaming: true,
      error: null,
      messages: [...messages, { id: uiId++, role: "user", content: text.trim() }],
    });

    activeAbort = new AbortController();
    const apiMessages: AiMessageParam[] = [{ role: "system", content: buildSystemPrompt() }];
    for (const m of get().messages) {
      if (m.role === "user") apiMessages.push({ role: "user", content: m.content });
      else if (m.content) apiMessages.push({ role: "assistant", content: m.content });
    }

    const pushPlaceholder = (): ChatUiMessage => {
      const msg: ChatUiMessage = { id: uiId++, role: "assistant", content: "", actions: [] };
      set((s) => ({ messages: [...s.messages, msg] }));
      return msg;
    };

    const updateMessage = (id: number, patch: Partial<ChatUiMessage>) => {
      set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    };

    try {
      for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
        const placeholder = pushPlaceholder();
        let text = "";
        let calls: AiToolCall[] = [];

        for await (const ev of streamChat(config, apiMessages, activeAbort?.signal)) {
          if (ev.type === "delta") {
            text += ev.text;
            updateMessage(placeholder.id, { content: text });
          } else {
            calls = ev.calls;
          }
        }

        if (calls.length === 0) break; // обычный текстовый ответ — цикл закончен

        // Регистрируем assistant-сообщение с tool_calls в API-истории.
        apiMessages.push({
          role: "assistant",
          content: text || null,
          tool_calls: calls.map((c) => ({
            id: c.id,
            type: "function" as const,
            function: { name: c.name, arguments: c.arguments },
          })),
        });

        // Выполняем инструменты, пишем результаты в историю + метки в UI.
        for (const call of calls) {
          const { label, resultJson } = await executeToolCall(call.name, call.arguments);
          updateMessage(placeholder.id, {
            actions: [...(get().messages.find((m) => m.id === placeholder.id)?.actions ?? []), label],
          });
          apiMessages.push({ role: "tool", tool_call_id: call.id, content: resultJson });
        }
      }
    } catch (e) {
      const message =
        e instanceof AiClientError
          ? `Ошибка API: ${e.message}`
          : `Ошибка связи с ИИ: ${String(e)}. Проверьте адрес/ключ в настройках ассистента.`;
      set({ error: message });
      // Если в чате пустой placeholder — впишем ошибку в него.
      const last = get().messages[get().messages.length - 1];
      if (last && last.role === "assistant" && !last.content) {
        updateMessage(last.id, { content: `⚠ ${message}` });
      }
    } finally {
      activeAbort = null;
      set({ streaming: false });
    }
  },
}));

/** Выполнение одного tool call. Возвращает метку для UI и JSON-результат для модели. */
async function executeToolCall(
  name: string,
  rawArguments: string,
): Promise<{ label: string; resultJson: string }> {
  if (name === "update_settings") {
    const args = parseToolArguments({ id: "x", name, arguments: rawArguments });
    const patch = (args as { patch?: unknown }).patch ?? args;
    const app = useApp.getState();
    const { file: next, result } = applySettingsPatch(app.file, patch);
    let issues = app.issues;
    if (result.applied.length > 0) {
      app.history.push(toJsonCompact(app.file));
      issues = validate(fromFile(next));
      useApp.setState({ file: next, issues, dirty: true });
    }
    const errors = issues
      .filter((i) => i.severity === "error")
      .map((i) => ({ field: i.fieldKey, message: i.message }));
    const warnings = issues.filter((i) => i.severity === "warning").length;
    const label =
      result.applied.length > 0
        ? `⚙ Настройки: ${actionsLabel(result.applied)}${errors.length > 0 ? ` (⚠ ошибок: ${errors.length})` : ""}`
        : "⚙ Патч не распознан";
    const resultJson = JSON.stringify({
      appliedFields: result.applied,
      ignoredFields: result.ignored,
      validationErrors: errors,
      warningsCount: warnings,
      hint:
        errors.length > 0
          ? "Исправь блокирующие ошибки повторным вызовом update_settings с корректными значениями."
          : undefined,
    });
    return { label, resultJson };
  }

  if (name === "generate_map") {
    const outcome = await runGeneration();
    const label = outcome.ok ? "🗺 Карта сгенерирована" : outcome.blockers ? "🗺 Генерация: есть блокеры" : "🗺 Ошибка генерации";
    const resultJson = JSON.stringify({
      ok: outcome.ok,
      summary: outcome.summary,
      validationBlockers: outcome.blockers,
      error: outcome.error,
    });
    return { label, resultJson };
  }

  return {
    label: `⚠ Неизвестный инструмент: ${name}`,
    resultJson: JSON.stringify({ error: `unknown tool ${name}` }),
  };
}

/** Быстрые фразы-подсказки над полем ввода. */
export const AI_QUICK_PROMPTS = [
  "Сделай карту на 4 игроков, топология Хаб, средняя сложность стражи, и сгенерируй",
  "Включи условие победы «Удержание города» и добавь побольше нейтральных зон",
  "Ужесточи стражу и убери прямые связи между игроками",
  "Объясни, какие сейчас стоят условия победы",
];
