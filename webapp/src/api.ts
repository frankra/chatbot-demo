// Same-origin path; Vite proxies /api to http://localhost:3000 (see vite.config.ts).
const API_URL = '/api/chat';

interface ChatSuccess {
  response: string;
}

interface ChatErrorBody {
  error?: string;
  details?: string;
}

export async function sendChat(sessionId: string, message: string): Promise<string> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message }),
  });

  if (!res.ok) {
    let detail = `Request failed with status ${res.status}`;
    try {
      const body = (await res.json()) as ChatErrorBody;
      if (body.error) detail = body.details ? `${body.error} (${body.details})` : body.error;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as ChatSuccess;
  return data.response;
}
