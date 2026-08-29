import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../types';

const COOKIE_NAME = 'sip_session';
const SESSION_TTL = 60 * 60 * 8;
const PASSWORD_ITERATIONS = 100_000;

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return base64UrlEncode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}

export async function hashPassword(password: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const digest = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode('sip-admin-password-salt-v1'), iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' }, key, 256);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSession(username: string, secret: string): Promise<string> {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL }));
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${await sign(unsigned, secret)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<string | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, base64UrlDecode(signature), new TextEncoder().encode(`${header}.${payload}`));
  if (!valid) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { sub?: string; exp?: number };
    return data.sub && data.exp && data.exp > Math.floor(Date.now() / 1000) ? data.sub : null;
  } catch {
    return null;
  }
}

export function getCookie(request: Request, name: string): string | undefined {
  return request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export function sessionSecret(env: Env): string {
  return env.SESSION_SECRET || 'sip-local-development-secret-change-me';
}

export async function requireAdmin(context: Parameters<PagesFunction<Env>>[0]): Promise<string | Response> {
  const username = await verifySession(getCookie(context.request, COOKIE_NAME), sessionSecret(context.env));
  if (!username) return Response.json({ error: 'Nicht autorisiert.' }, { status: 401 });
  return username;
}

export function sessionCookie(token: string, request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL}${secure}`;
}

export const expiredSessionCookie = 'sip_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
