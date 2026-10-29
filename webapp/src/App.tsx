import { FormEvent, useEffect, useRef, useState } from 'react';
import { sendChat } from './api';
import type { ChatMessage } from './types';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One session per page load; the server keeps history per sessionId.
  const [sessionId] = useState(() => crypto.randomUUID());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const response = await sendChat(sessionId, text);
      setMessages((prev) => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Chatbot Demo</h1>
        <span className="session" title={sessionId}>
          session {sessionId.slice(0, 8)}
        </span>
      </header>

      <main className="chat">
        {messages.length === 0 && !loading && (
          <p className="empty">Say hello — the server keeps history per session.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <span className="who">{m.role === 'user' ? 'You' : 'Assistant'}</span>
            <p>{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <span className="who">Assistant</span>
            <p className="typing">…</p>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {error && <div className="error">{error}</div>}

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          rows={2}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? 'Thinking…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
