// Cloudflare Turnstile, checked by Supabase Auth before it creates an
// anonymous account or sends a sign-in email. Off until
// NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (with the secret in Supabase Auth >
// Attack Protection). Most players never see it; a challenge only appears
// when Cloudflare isn't sure.
import { SaveError } from './supabase';

interface Turnstile {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const siteKey = import.meta.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined;
export const captchaEnabled = !!siteKey;

let script: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  script ??= new Promise<Turnstile>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')));
    s.onerror = () => reject(new Error('Turnstile did not load'));
    document.head.append(s);
  }).catch((e) => {
    script = null;
    throw e;
  });
  return script;
}

/** A one-time CAPTCHA token for Supabase Auth, or undefined when the CAPTCHA is off. */
export async function captchaToken(): Promise<string | undefined> {
  if (!siteKey || typeof document === 'undefined') return undefined;
  const turnstile = await loadTurnstile().catch(() => {
    throw new SaveError('Couldn’t check that you’re not a bot. Check your connection and try again.');
  });
  return new Promise<string>((resolve, reject) => {
    const box = document.createElement('div');
    box.className = 'captcha-box';
    document.body.append(box);
    let id = '';
    const done = () => setTimeout(() => {
      turnstile.remove(id);
      box.remove();
    });
    id = turnstile.render(box, {
      sitekey: siteKey,
      appearance: 'interaction-only',
      callback: (token: string) => {
        resolve(token);
        done();
      },
      'error-callback': () => {
        reject(new SaveError('Couldn’t check that you’re not a bot. Reload the page and try again.'));
        done();
      },
    });
  });
}
