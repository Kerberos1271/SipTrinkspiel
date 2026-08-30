import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, CategoryRow } from '../../types';
import { requireAdmin } from '../../lib/auth';
import { json, readJson } from '../../lib/http';

interface CategoryBody { name?: string }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const result = await context.env.DB.prepare('SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, name COLLATE NOCASE').all<CategoryRow>();
  return json({ categories: result.results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const body = await readJson<CategoryBody>(context.request);
  const name = body?.name?.trim();
  if (!name || name.length > 60) return json({ error: 'Bitte einen Namen mit 1–60 Zeichen eingeben.' }, { status: 400 });
  try {
    const nextOrder = await context.env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM categories').first<{ next_order: number }>();
    const result = await context.env.DB.prepare('INSERT INTO categories (name, sort_order) VALUES (?1, ?2) RETURNING id, name, sort_order').bind(name, nextOrder?.next_order ?? 0).first<CategoryRow>();
    return json({ category: result }, { status: 201 });
  } catch {
    return json({ error: 'Diese Kategorie gibt es bereits.' }, { status: 409 });
  }
};
