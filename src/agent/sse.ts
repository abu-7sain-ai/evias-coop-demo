// Minimal Server-Sent-Events reader for fetch() responses (Anthropic, OpenAI and the local bridge all stream SSE).
export async function* readSse(res: Response, signal?: AbortSignal): AsyncGenerator<{ event: string | null; data: string }> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      if (signal?.aborted) return;
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
        const chunk = buf.slice(0, i);
        buf = buf.slice(i).replace(/^\r?\n\r?\n/, "");
        let event: string | null = null; const data: string[] = [];
        for (const line of chunk.split(/\r?\n/)) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        }
        if (data.length) yield { event, data: data.join("\n") };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function httpError(status: number, body: string) {
  let msg = body;
  try { const j = JSON.parse(body); msg = j.error?.message ?? j.message ?? body; } catch { /* not json */ }
  return { status, message: String(msg).slice(0, 300) };
}
