import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, CategoryRow } from '../../../types';
import { requireAdmin } from '../../../lib/auth';
import { json, readJson } from '../../../lib/http';

interface CategoryBody { name?: string; direction?: 'up' | 'down' }

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: 'Ungültige Kategorie.' }, { status: 400 });
  const result = await context.env.DB.prepare('DELETE FROM categories WHERE id = ?1').bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: 'Kategorie nicht gefunden.' }, { status: 404 });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const id = Number(context.params.id);
  const body = await readJson<CategoryBody>(context.request);
  if (!Number.isInteger(id) || !body) return json({ error: 'Ungültige Kategorie.' }, { status: 400 });

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name || name.length > 60) return json({ error: 'Bitte einen Namen mit 1–60 Zeichen eingeben.' }, { status: 400 });
    try {
      const result = await context.env.DB.prepare('UPDATE categories SET name = ?1 WHERE id = ?2 RETURNING id, name, sort_order').bind(name, id).first<CategoryRow>();
      return result ? json({ category: result }) : json({ error: 'Kategorie nicht gefunden.' }, { status: 404 });
    } catch {
      return json({ error: 'Diese Kategorie gibt es bereits.' }, { status: 409 });
    }
  }

  if (body.direction !== 'up' && body.direction !== 'down') return json({ error: 'Keine gültige Änderung.' }, { status: 400 });
  const current = await context.env.DB.prepare('SELECT id, sort_order FROM categories WHERE id = ?1').bind(id).first<{ id: number; sort_order: number }>();
  if (!current) return json({ error: 'Kategorie nicht gefunden.' }, { status: 404 });
  const neighbor = body.direction === 'up'
    ? await context.env.DB.prepare('SELECT id, sort_order FROM categories WHERE sort_order < ?1 ORDER BY sort_order DESC LIMIT 1').bind(current.sort_order).first<{ id: number; sort_order: number }>()
    : await context.env.DB.prepare('SELECT id, sort_order FROM categories WHERE sort_order > ?1 ORDER BY sort_order ASC LIMIT 1').bind(current.sort_order).first<{ id: number; sort_order: number }>();
  if (!neighbor) return json({ ok: true });
  await context.env.DB.batch([
    context.env.DB.prepare('UPDATE categories SET sort_order = ?1 WHERE id = ?2').bind(neighbor.sort_order, current.id),
    context.env.DB.prepare('UPDATE categories SET sort_order = ?1 WHERE id = ?2').bind(current.sort_order, neighbor.id),
  ]);
  return json({ ok: true });
};
