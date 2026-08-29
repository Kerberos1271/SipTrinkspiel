import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../../types';
import { createSession, hashPassword, sessionCookie, sessionSecret } from '../../lib/auth';
import { json, readJson } from '../../lib/http';

interface LoginBody { username?: string; password?: string }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<LoginBody>(request);
  const username = body?.username?.trim();
  const password = body?.password || '';
  if (!username || !password) return json({ error: 'Bitte Benutzername und Passwort eingeben.' }, { status: 400 });

  if (!env.DB) return json({ error: 'Das Pages-Projekt hat noch kein D1-Binding „DB“.' }, { status: 503 });
  try {
    const admin = await env.DB.prepare('SELECT username, password_hash FROM admins WHERE username = ?1').bind(username).first<{ username: string; password_hash: string }>();
    const matches = admin && (await hashPassword(password)) === admin.password_hash;
    if (!matches) return json({ error: 'Benutzername oder Passwort ist falsch.' }, { status: 401 });

    const token = await createSession(admin.username, sessionSecret(env));
    return json({ user: { username: admin.username } }, { headers: { 'Set-Cookie': sessionCookie(token, request) } });
  } catch (error) {
    console.error('Admin login failed', error);
    return json({ error: 'Die Admin-Datenbank ist nicht erreichbar oder noch nicht migriert.' }, { status: 503 });
  }
};
