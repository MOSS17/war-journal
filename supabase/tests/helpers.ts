// Shared by the database tests: reading sign-in codes from the local mail catcher.
const MAIL = 'http://127.0.0.1:54324/api/v1';

/** The 6-digit code from the newest email to `to`. */
export async function codeFor(to: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const list = (await (await fetch(`${MAIL}/search?query=${encodeURIComponent(`to:${to}`)}`)).json()) as { messages: { ID: string }[] };
    if (list.messages?.length) {
      const msg = (await (await fetch(`${MAIL}/message/${list.messages[0].ID}`)).json()) as { Text: string };
      await fetch(`${MAIL}/messages`, { method: 'DELETE', body: JSON.stringify({ IDs: list.messages.map((m) => m.ID) }) });
      const code = /\b(\d{6,10})\b/.exec(msg.Text)?.[1];
      if (code) return code;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`No email for ${to}`);
}
