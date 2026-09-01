import type { PagesFunction } from '@cloudflare/workers-types';
import type { Env, CategoryRow } from '../../types';
import { requireAdmin } from '../../lib/auth';
import { json, readJson } from '../../lib/http';
import { sanitizeQuestion } from '../../lib/placeholders';

interface ImportBody { csv?: string }
interface ImportRow { categoryName: string; cardText: string }

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStarted = false;
  let closedQuote = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (character === '"') {
      if (quoted) {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else if (fieldStarted) {
        throw new Error('Ungültige Anführungszeichen');
      } else {
        quoted = true;
        fieldStarted = true;
      }
    } else if (character === ';' && !quoted) {
      if (closedQuote) closedQuote = false;
      row.push(field);
      field = '';
      fieldStarted = false;
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      if (closedQuote) closedQuote = false;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
      fieldStarted = false;
    } else {
      if (closedQuote) throw new Error('Zeichen nach geschlossenem Feld');
      field += character;
      fieldStarted = true;
    }
  }

  if (quoted) throw new Error('Nicht geschlossenes Anführungszeichen');
  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

const key = (value: string) => value.trim().toLocaleLowerCase('de-DE');

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const auth = await requireAdmin(context);
  if (auth instanceof Response) return auth;
  const body = await readJson<ImportBody>(context.request);
  const source = body?.csv?.replace(/^\uFEFF/, '');
  if (!source) return json({ error: 'Die CSV-Datei ist leer.' }, { status: 400 });
  if (source.length > 1_000_000) return json({ error: 'Die CSV-Datei darf maximal 1 MB groß sein.' }, { status: 413 });

  let rows: string[][];
  try {
    rows = parseCsv(source);
  } catch {
    return json({ error: 'Die CSV-Datei ist strukturell ungültig. Bitte Anführungszeichen und Trennzeichen prüfen.' }, { status: 400 });
  }
  const [headerCategory, headerText] = rows.shift() || [];
  if (key(headerCategory || '') !== 'category_name' || key(headerText || '') !== 'card_text') {
    return json({ error: 'Die erste Zeile muss exakt „category_name;card_text“ lauten.' }, { status: 400 });
  }
  if (!rows.length) return json({ error: 'Die CSV-Datei enthält keine Karten.' }, { status: 400 });
  if (rows.length > 1000) return json({ error: 'Pro Import sind maximal 1.000 Karten erlaubt.' }, { status: 400 });

  const importRows: ImportRow[] = [];
  let skippedRows = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (row.length !== 2) { skippedRows += 1; continue; }
    const categoryName = row[0].trim();
    const cardText = sanitizeQuestion(row[1]);
    if (!categoryName || !cardText || categoryName.length > 60 || cardText.length > 500) { skippedRows += 1; continue; }
    importRows.push({ categoryName, cardText });
  }
  if (!importRows.length) return json({ error: 'Die CSV-Datei enthält keine gültigen Karten. Fehlerhafte Zeilen werden übersprungen.' }, { status: 400 });

  await context.env.DB.prepare('PRAGMA foreign_keys = ON').run();
  const existing = await context.env.DB.prepare('SELECT id, name FROM categories').all<CategoryRow>();
  const categories = new Map(existing.results.map((category) => [key(category.name), category]));
  let createdCategories = 0;

  for (const row of importRows) {
    if (categories.has(key(row.categoryName))) continue;
    await context.env.DB.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?1)').bind(row.categoryName).run();
    const category = await context.env.DB.prepare('SELECT id, name FROM categories WHERE name = ?1').bind(row.categoryName).first<CategoryRow>();
    if (!category) return json({ error: `Kategorie „${row.categoryName}“ konnte nicht angelegt werden.` }, { status: 500 });
    categories.set(key(category.name), category);
    createdCategories += 1;
  }

  const statements = importRows.map((row) => context.env.DB.prepare('INSERT INTO cards (text, category_id) VALUES (?1, ?2)').bind(row.cardText, categories.get(key(row.categoryName))!.id));
  await context.env.DB.batch(statements);
  return json({ importedCards: importRows.length, skippedRows, createdCategories });
};
