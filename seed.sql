PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  category_id INTEGER NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cards_category_id ON cards(category_id);

INSERT OR IGNORE INTO categories (id, name) VALUES
  (1, 'Fragen'),
  (2, 'Gruppenaufgaben'),
  (3, 'Einzelaufgaben');

INSERT INTO admins (username, password_hash)
VALUES ('admin', 'b4432f83179c84d8b37c9dd9dcc37e971e3e706c1c77f4390b4354a16e816ac9')
ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash;

INSERT OR IGNORE INTO cards (id, text, category_id) VALUES
  (1, 'Wer von euch würde am ehesten spontan ein Tattoo stechen lassen? Zeigt auf die Person – sie nimmt einen Schluck.', 1),
  (2, 'Was war dein peinlichster Party-Moment? Die Runde entscheidet, ob die Story einen Schluck wert ist.', 1),
  (3, 'Welche drei Dinge würdest du auf eine einsame Insel mitnehmen? Keine Antwort ohne Schluck.', 1),
  (4, '#player verteilt zwei Schlücke – an wen und warum?', 1),
  (5, 'Alle, die heute schon zu spät waren, trinken. Ihr wisst, wer gemeint ist.', 2),
  (6, 'Die Person mit dem längsten Vornamen startet eine Runde: reihum ein Wort, bis jemand lacht. Wer lacht, trinkt.', 2),
  (7, 'Alle stoßen an. Die letzte Person, die ihr Glas hebt, trinkt.', 2),
  (8, 'Erfindet gemeinsam einen neuen Namen für dieses Spiel. Der kreativste Vorschlag verteilt drei Schlücke.', 2),
  (9, '#player macht eine 10-Sekunden-Imitation. Wer sie errät, darf zwei Schlücke verteilen.', 3),
  (10, 'Sag das Alphabet rückwärts, so weit du kommst. Bei einem Fehler: ein Schluck.', 3),
  (11, 'Halte dein Glas wie ein Mikrofon und halte eine 15-Sekunden-Dankesrede an die Runde.', 3),
  (12, 'Sprich bis zu deinem nächsten Zug nur noch in Fragen. Vergisst du es, trinkst du.', 3),
  (13, 'Mach den besten Party-Sound, den du kannst. Die Runde bewertet – der leiseste Applaus trinkt.', 3),
  (14, '#player, wähle eine Person. Ihr müsst gleichzeitig einen Schluck nehmen und dabei ernst bleiben.', 3);
