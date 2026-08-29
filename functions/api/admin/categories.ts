import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, CategoryRow } from '../../types';
import { requireAdmin } from '../../lib/auth';
import { json, readJson } from '../../lib/http';

interface CategoryBody { name?: string }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const result = await context.env.DB.prepare('SELECT id, name FROM categories ORDER BY name COLLATE NOCASE').all<CategoryRow>();
  return json({ categories: result.results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const body = await readJson<CategoryBody>(context.request);
  const name = body?.name?.trim();
  if (!name || name.length > 60) return json({ error: 'Bitte einen Namen mit 1–60 Zeichen eingeben.' }, { status: 400 });
  try {
    const result = await context.env.DB.prepare('INSERT INTO categories (name) VALUES (?1) RETURNING id, name').bind(name).first<CategoryRow>();
    return json({ category: result }, { status: 201 });
  } catch {
    return json({ error: 'Diese Kategorie gibt es bereits.' }, { status: 409 });
  }
};
