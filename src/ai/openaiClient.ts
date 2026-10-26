import { isTauri } from "../platform";
import type { AiMessageParam, ChatEvent, AiToolCall } from "./types";
import type { AiConfig } from "../desktop/bridge";

/**
 * Стримящий клиент OpenAI-совместимого /chat/completions.
 * В Tauri запрос идёт через tauri-plugin-http (нет CORS), в браузере — обычный fetch.
 */

export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "update_settings",
      description:
        "Применить поля к настройкам генератора карт. patch — плоский JSON с ключами из каталога систем-промпта. Массивы и объекты заменяются целиком.",
      parameters: {
        type: "object",
        properties: {
          patch: { type: "object", description: "поля настроек для применения", additionalProperties: true },
        },
        required: ["patch"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_map",
      description: "Запустить генерацию карты текущих настроек и обновить превью.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_batch",
      description:
        "Массовая генерация нескольких РАЗНЫХ карт одним ZIP-архивом (разные размеры/топологии/число игроков, у каждой своё осмысленное имя и описание). Общие настройки наследуются от текущих.",
      parameters: {
        type: "object",
        properties: {
          count: { type: "integer", description: "сколько карт, 1..20" },
          sizeMin: { type: "integer", description: "минимальный размер (64..512)" },
          sizeMax: { type: "integer", description: "максимальный размер" },
          topologies: {
            type: "array",
            items: { type: "string", enum: ["Default", "HubAndSpoke", "Chain", "SharedWeb", "Random", "Balanced"] },
            description: "пул топологий для случайного выбора",
          },
          playersMin: { type: "integer", description: "2..8" },
          playersMax: { type: "integer", description: "2..8" },
        },
        required: ["count"],
      },
    },
  },
] as const;

interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export class AiClientError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

async function doFetch(url: string, init: RequestInit): Promise<Response> {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, init);
  }
  return fetch(url, init);
}

/**
 * Стриминг chat/completions. Йелдит текстовые дельты; по завершении стрима,
 * если модель запросила инструменты, йелдит собранные tool_calls.
 */
export async function* streamChat(
  config: AiConfig,
  messages: AiMessageParam[],
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const base = config.baseUrl.replace(/\/+$/, "");
  const res = await doFetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: AI_TOOLS,
      tool_choice: "auto",
      stream: true,
      temperature: 0.5,
    }),
    signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 400);
    } catch {
      /* пустое тело */
    }
    throw new AiClientError(`API ${res.status}: ${detail || res.statusText}`, res.status);
  }

  const toolAcc = new Map<number, AccumulatedToolCall>();
  const contentType = res.headers.get("content-type") ?? "";

  // Нестримающий ответ (некоторые совместимые серверы игнорируют stream:true).
  if (!contentType.includes("text/event-stream") || !res.body) {
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>;
    };
    const msg = data.choices?.[0]?.message;
    if (msg?.content) yield { type: "delta", text: msg.content };
    if (msg?.tool_calls?.length) {
      for (const tc of msg.tool_calls) {
        toolAcc.set(toolAcc.size, { id: tc.id, name: tc.function.name, arguments: tc.function.arguments });
      }
      yield { type: "tool_calls", calls: [...toolAcc.values()] };
    }
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  interface StreamChunk {
    choices?: Array<{
      delta?: {
        content?: string | null;
        tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>;
      };
    }>;
  }

  const handlePayload = (payload: StreamChunk): string => {
    // Возвращает накопленный текст-дельту этого payload.
    let text = "";
    const delta = payload.choices?.[0]?.delta;
    if (delta?.content) text += delta.content;
    if (delta?.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index ?? 0;
        const acc = toolAcc.get(idx) ?? { id: "", name: "", arguments: "" };
        if (tc.id) acc.id = tc.id;
        if (tc.function?.name) acc.name += tc.function.name;
        if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        toolAcc.set(idx, acc);
      }
    }
    return text;
  };

  const flushEvent = (raw: string): string => {
    const line = raw.trim();
    if (!line.startsWith("data:")) return "";
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return "";
    try {
      return handlePayload(JSON.parse(data) as StreamChunk);
    } catch {
      return "";
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n")) >= 0) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 1);
      const text = flushEvent(raw);
      if (text) yield { type: "delta", text };
    }
  }
  // Хвост без завершающего \n
  const tail = flushEvent(buffer);
  if (tail) yield { type: "delta", text: tail };

  if (toolAcc.size > 0) {
    yield { type: "tool_calls", calls: [...toolAcc.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v) };
  }
}

/** Проверка связи: GET /models с ключом. */
export async function checkAiConnection(config: AiConfig): Promise<{ ok: boolean; detail: string }> {
  try {
    const base = config.baseUrl.replace(/\/+$/, "");
    const res = await doFetch(`${base}/models`, {
      headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {},
    });
    if (res.ok) return { ok: true, detail: "Соединение установлено" };
    return { ok: false, detail: `HTTP ${res.status}: ${(await res.text()).slice(0, 200) || res.statusText}` };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
}

/** Парсинг аргументов tool call с защитой от обрезанного JSON. */
export function parseToolArguments(call: AiToolCall): Record<string, unknown> {
  try {
    const parsed = JSON.parse(call.arguments || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    // Попытка починить обрезанный хвост — убрать незакрытые скобки не умеем, отдаём пусто.
    return {};
  }
}
