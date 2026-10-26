/** Типы AI-ассистента (OpenAI-совместимый chat/completions). */

export interface AiToolCall {
  id: string;
  name: string;
  /** Сырая JSON-строка аргументов (накопленная из дельт). */
  arguments: string;
}

export interface AiMessageParam {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

export type ChatEvent =
  | { type: "delta"; text: string }
  | { type: "tool_calls"; calls: AiToolCall[] };

/** Сообщение в UI чата. */
export interface ChatUiMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Метки выполненных инструментом действий (для пузыря ассистента). */
  actions?: string[];
}
