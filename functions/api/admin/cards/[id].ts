import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env } from '../../../types';
import { requireAdmin } from '../../../lib/auth';
import { json } from '../../../lib/http';

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return json({ error: 'Ungültige Karte.' }, { status: 400 });
  const result = await context.env.DB.prepare('DELETE FROM cards WHERE id = ?1').bind(id).run();
  return result.meta.changes ? json({ ok: true }) : json({ error: 'Karte nicht gefunden.' }, { status: 404 });
};
