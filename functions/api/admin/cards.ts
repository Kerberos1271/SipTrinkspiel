import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, CardRow } from '../../types';
import { requireAdmin } from '../../lib/auth';
import { json, readJson } from '../../lib/http';

interface CardBody { text?: string; category_id?: number }

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const result = await context.env.DB.prepare('SELECT cards.id, cards.text, cards.category_id, categories.name AS category_name FROM cards JOIN categories ON categories.id = cards.category_id ORDER BY categories.name COLLATE NOCASE, cards.id DESC').all<CardRow>();
  return json({ cards: result.results });
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const body = await readJson<CardBody>(context.request);
  const text = body?.text?.trim();
  const categoryId = Number(body?.category_id);
  if (!text || text.length > 500 || !Number.isInteger(categoryId)) return json({ error: 'Bitte Text und Kategorie ausfüllen.' }, { status: 400 });
  const category = await context.env.DB.prepare('SELECT id FROM categories WHERE id = ?1').bind(categoryId).first();
  if (!category) return json({ error: 'Kategorie nicht gefunden.' }, { status: 400 });
  const result = await context.env.DB.prepare('INSERT INTO cards (text, category_id) VALUES (?1, ?2) RETURNING id, text, category_id').bind(text, categoryId).first<CardRow>();
  return json({ card: result }, { status: 201 });
};
