import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../../../types';
import { requireAdmin } from '../../../lib/auth';
import { json, readJson } from '../../../lib/http';

interface CardBody { text?: string; category_id?: number }

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: 'Ungültige Karte.' }, { status: 400 });
  const result = await context.env.DB.prepare('DELETE FROM cards WHERE id = ?1').bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: 'Karte nicht gefunden.' }, { status: 404 });
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const id = Number(context.params.id);
  const body = await readJson<CardBody>(context.request);
  const text = body?.text?.trim();
  const categoryId = Number(body?.category_id);
  if (!Number.isInteger(id) || !text || text.length > 500 || !Number.isInteger(categoryId)) return json({ error: 'Bitte Text und Kategorie ausfüllen.' }, { status: 400 });
  const category = await context.env.DB.prepare('SELECT id FROM categories WHERE id = ?1').bind(categoryId).first();
  if (!category) return json({ error: 'Kategorie nicht gefunden.' }, { status: 400 });
  const result = await context.env.DB.prepare('UPDATE cards SET text = ?1, category_id = ?2 WHERE id = ?3 RETURNING id, text, category_id').bind(text, categoryId, id).first();
  return result ? json({ card: result }) : json({ error: 'Karte nicht gefunden.' }, { status: 404 });
};
