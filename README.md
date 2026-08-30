# sip.

Ein mobiles Karten-Partyspiel als Progressive Web App – ohne Spieler-Login, mit einem geschützten Admin-Bereich für Kategorien und Karten.

## Voraussetzungen

- Node.js 18+
- Ein Cloudflare-Konto mit Pages und D1

## Lokal entwickeln

```bash
npm install
npm run dev
```

`npm run dev` startet direkt den vollständigen Cloudflare-Pages-Workflow auf `http://127.0.0.1:8788`, damit Login und Admin-API lokal verfügbar sind. Für reines Frontend-HMR ohne Pages Functions gibt es `npm run dev:frontend`; dort funktionieren `/api/*` und der Admin-Login absichtlich nicht.

Alternativ den Pages-/D1-Workflow manuell starten:

```bash
npm run build
npx wrangler pages dev dist --local
```

Das entspricht dem Kurzskript `npm run dev:cf`. Beim ersten lokalen Start Datenbank anlegen und befüllen:

```bash
npx wrangler d1 migrations apply sip-db --local
npx wrangler d1 execute sip-db --local --file=seed.sql
```

Die lokale Admin-Anmeldung ist `admin` / `admin1234`. Im Admin-Deck-Studio lassen sich Karten über den Desktop-Drawer oder per Doppelklick inline bearbeiten; auf kleinen Displays öffnet `+` das mobile Bottom-Sheet. `Ctrl/Cmd + K` beziehungsweise `/` fokussiert die Suche, `Esc` schließt offene Editoren.

## Als App installieren

Die Startseite enthält den Link **Wie installiere ich sip. auf meinem Smartphone?**. Alternativ kann die Anleitung direkt unter `/install` geöffnet werden. Dort wird zwischen Apple/Safari und Android-Browsern unterschieden.

Die PWA-Assets liegen unter `public/`: `manifest.webmanifest`, `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `pwa-192x192.png` und `pwa-512x512.png`. Der Service Worker cached den App-Shell inklusive der Installationsseite und Icons.

## CSV-Import

Im Admin-Bereich können mehrere Karten auf einmal importiert werden. Die Datei muss UTF-8-kodiert sein, `;` als Trennzeichen verwenden und exakt diese Kopfzeile enthalten:

```csv
category_name;card_text
Fragen;Wer würde am ehesten zuerst lachen?
Gruppenaufgaben;Alle stoßen an und die letzte Person trinkt.
"Einzelaufgaben";"Mache eine Aufgabe; die Runde entscheidet."
```

Die erste Spalte ist der Kategoriename, die zweite der Karteninhalt. Eine Zeile entspricht einer Karte. Kategorien, die noch nicht existieren, werden beim Import automatisch angelegt. Enthält der Karteninhalt selbst ein Semikolon, muss das Feld in doppelte Anführungszeichen gesetzt werden. Doppelte Anführungszeichen innerhalb eines Feldes werden verdoppelt. Ein strukturell ungültiges CSV wird abgelehnt; einzelne ungültige Zeilen werden übersprungen und in der Importmeldung gezählt. Pro Import sind maximal 1.000 Karten und 1 MB erlaubt.

## D1 und Deployment

1. Remote-Datenbank anlegen:

   ```bash
   npx wrangler d1 create sip-db
   ```

2. Die ausgegebene `database_id` in `wrangler.toml` eintragen. Das Binding muss `DB` heißen.

3. Schema remote anwenden und Seeds ausführen:

   ```bash
   npx wrangler d1 migrations apply sip-db --remote
   npx wrangler d1 execute sip-db --remote --file=seed.sql
   ```

   Falls `d1 migrations apply --remote` trotz korrekter Anmeldung mit Cloudflare-Fehler 7403 abbricht, kann die einzelne Migration einmalig direkt ausgeführt werden. Danach wird sie manuell als angewendet markiert, damit sie bei späteren Deployments nicht erneut ausgeführt wird:

   ```bash
   npx wrangler d1 execute sip-db --remote --file=./migrations/0001_category_order.sql
   npx wrangler d1 execute sip-db --remote --command="INSERT INTO d1_migrations (name, applied_at) VALUES ('0001_category_order.sql', datetime('now'));"
   ```

   Anschließend sollte `npx wrangler d1 migrations list sip-db --remote` keine offenen Migrationen mehr anzeigen.

4. `SESSION_SECRET` als geheime Production-Variable setzen, zum Beispiel über das Cloudflare-Dashboard unter Pages → Settings → Environment variables. Für lokale Entwicklung ist ein harmloser Fallback vorhanden.

5. Pages-Projekt deployen:

   ```bash
   npm run deploy
   ```

   Alternativ im Cloudflare-Dashboard das Git-Repository verbinden. Build command: `npm run build`, Output directory: `dist`.

6. Eine eigene Domain im Pages-Projekt unter Custom domains hinzufügen und die DNS-Anweisungen von Cloudflare befolgen.

## Datenmodell

`cards.category_id` ist `NOT NULL` und referenziert `categories(id)` mit `ON DELETE CASCADE`. Beim Löschen einer Kategorie werden die zugehörigen Karten automatisch mitgelöscht. Die API aktiviert `PRAGMA foreign_keys = ON` ebenfalls für ihre Datenbankzugriffe.

## Projektstruktur

- `src/` – React-App und mobile-first Styles
- `functions/api/` – Cloudflare Pages Functions für Spiel-Daten, Login und Admin-CRUD
- `migrations/0000_init.sql` und `migrations/0001_category_order.sql` – D1-Schema und manuelle Kategorie-Reihenfolge
- `seed.sql` – Kategorien, Beispielkarten und Admin-Account
- `public/manifest.webmanifest`, `public/sw.js` – PWA-Setup
