import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../../types';
import { expiredSessionCookie, getCookie, sessionSecret, verifySession } from '../../lib/auth';
import { json } from '../../lib/http';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const username = await verifySession(getCookie(request, 'sip_session'), sessionSecret(env));
  return username ? json({ user: { username } }) : json({ user: null }, { status: 401 });
};

export const onRequestPost: PagesFunction<Env> = async () => json({ ok: true }, { headers: { 'Set-Cookie': expiredSessionCookie } });
