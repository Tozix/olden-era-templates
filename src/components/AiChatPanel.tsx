import { useEffect, useRef, useState } from "react";
import { useAssistant, AI_QUICK_PROMPTS } from "../state/assistantStore";
import { AiConfigModal } from "./AiConfigModal";

const T = {
  title: "AI-ассистент",
  settings: "Настройки ИИ",
  clear: "Очистить",
  close: "Закрыть",
  placeholder: "Опиши карту, которую хочешь…",
  send: "Отправить",
  stop: "Остановить",
  notConfigured:
    "Укажи адрес API и ключ в настройках ассистента (⚙). Подойдёт любой OpenAI-совместимый сервер: OpenAI, OpenRouter, DeepSeek, локальные LM Studio / Ollama.",
  empty: "Расскажи, какую карту хочешь — я настрою генератор и соберу превью.",
};

export function AiChatPanel(props: { onClose: () => void }) {
  const messages = useAssistant((s) => s.messages);
  const streaming = useAssistant((s) => s.streaming);
  const error = useAssistant((s) => s.error);
  const configOpen = useAssistant((s) => s.configOpen);
  const send = useAssistant((s) => s.send);
  const stop = useAssistant((s) => s.stop);
  const clear = useAssistant((s) => s.clear);
  const setConfigOpen = useAssistant((s) => s.setConfigOpen);
  const init = useAssistant((s) => s.init);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const submit = () => {
    if (!input.trim() || streaming) return;
    const text = input;
    setInput("");
    void send(text);
  };

  const needsConfig = !useAssistant((s) => s.config).apiKey.trim();

  return (
    <div className="preview-col ai-col">
      <div className="toolbar ai-header">
        <span className="title">🤖 {T.title}</span>
        <span className="spacer" />
        <button className="icon" title={T.settings} onClick={() => setConfigOpen(true)}>⚙</button>
        <button className="icon" title={T.clear} onClick={clear}>🗑</button>
        <button className="icon" title={T.close} onClick={props.onClose}>✕</button>
      </div>

      <div className="ai-messages" ref={scrollRef}>
        {messages.length === 0 && <div className="hint">{T.empty}</div>}
        {needsConfig && messages.length === 0 && <div className="wip-note">{T.notConfigured}</div>}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="msg user">{m.content}</div>
          ) : (
            <div key={m.id} className="msg assistant">
              {m.content && <div className="msg-text">{m.content}</div>}
              {m.actions && m.actions.length > 0 && (
                <div className="msg-actions">
                  {m.actions.map((a, i) => (
                    <span key={i} className="msg-action">{a}</span>
                  ))}
                </div>
              )}
              {!m.content && (m.actions?.length ?? 0) === 0 && streaming && <span className="hint">…</span>}
            </div>
          ),
        )}
        {error && <div className="msg error">{error}</div>}
      </div>

      {messages.length === 0 && (
        <div className="chips ai-quick">
          {AI_QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              className="chip"
              onClick={() => {
                setInput(p);
                void send(p);
              }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="ai-input-row">
        <textarea
          rows={2}
          value={input}
          placeholder={T.placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {streaming ? (
          <button className="primary" onClick={stop}>{T.stop}</button>
        ) : (
          <button className="primary" onClick={submit} disabled={!input.trim()}>{T.send}</button>
        )}
      </div>

      {configOpen && <AiConfigModal />}
    </div>
  );
}
