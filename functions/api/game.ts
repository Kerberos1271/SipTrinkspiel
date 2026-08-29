import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, CategoryRow, CardRow } from '../types';
import { json } from '../lib/http';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.DB) return json({ error: 'D1 ist nicht verbunden.' }, { status: 503 });
  await env.DB.prepare('PRAGMA foreign_keys = ON').run();
  const [categories, cards] = await Promise.all([
    env.DB.prepare('SELECT id, name FROM categories ORDER BY id').all<CategoryRow>(),
    env.DB.prepare('SELECT cards.id, cards.text, cards.category_id, categories.name AS category_name FROM cards JOIN categories ON categories.id = cards.category_id ORDER BY cards.id').all<CardRow>(),
  ]);
  return json({ categories: categories.results, cards: cards.results });
};
