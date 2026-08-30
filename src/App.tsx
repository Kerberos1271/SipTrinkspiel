import { useEffect, useMemo, useRef, useState } from 'react';

type Category = { id: number; name: string };
type Card = { id: number; text: string; category_id: number; category_name?: string };
type GameData = { categories: Category[]; cards: Card[] };
type Screen = 'home' | 'setup' | 'game' | 'finished';
type Theme = 'dark' | 'light';

const PAGE_SIZE = 15;
const fallbackData: GameData = {
  categories: [
    { id: 1, name: 'Fragen' },
    { id: 2, name: 'Gruppenaufgaben' },
    { id: 3, name: 'Einzelaufgaben' },
  ],
  cards: [
    { id: 1, category_id: 1, text: 'Wer würde am ehesten spontan ein Tattoo stechen lassen? Zeigt auf die Person – sie nimmt einen Schluck.' },
    { id: 2, category_id: 1, text: 'Was war dein peinlichster Party-Moment? Die Runde entscheidet, ob die Story einen Schluck wert ist.' },
    { id: 3, category_id: 1, text: '${player} verteilt zwei Schlücke – an wen und warum?' },
    { id: 4, category_id: 2, text: 'Alle stoßen an. Die letzte Person, die ihr Glas hebt, trinkt.' },
    { id: 5, category_id: 2, text: 'Die Person mit dem längsten Vornamen startet eine Runde: reihum ein Wort, bis jemand lacht.' },
    { id: 6, category_id: 3, text: 'Mach den besten Party-Sound, den du kannst. Die leiseste Reaktion trinkt.' },
    { id: 7, category_id: 3, text: '${player}, wähle eine Person. Ihr nehmt gleichzeitig einen Schluck.' },
  ],
};

const colors = ['lime', 'coral', 'sky'];

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Etwas ist schiefgelaufen.');
  return data as T;
}

function Logo({ light = false }: { light?: boolean }) {
  return <span className={`logo ${light ? 'logo-light' : ''}`}>sip<span>.</span></span>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M10.5 4.5 16 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function BackButton({ onClick, label = 'Zurück' }: { onClick: () => void; label?: string }) {
  return <button className="back-button" onClick={onClick} type="button"><span aria-hidden="true">←</span> {label}</button>;
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isLight = theme === 'light';
  return <button className="theme-toggle" type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label={`Zu ${isLight ? 'Dark' : 'Light'} Mode wechseln`}><span className="theme-toggle-icon" aria-hidden="true">{isLight ? '☾' : '☼'}</span><span>{isLight ? 'Dark' : 'Light'}</span></button>;
}

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('sip-theme') === 'light' ? 'light' : 'dark';
  });
  useEffect(() => {
    window.localStorage.setItem('sip-theme', theme);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  const toggleTheme = () => setTheme((current) => current === 'light' ? 'dark' : 'light');
  if (window.location.pathname.startsWith('/admin')) return <AdminApp theme={theme} onToggleTheme={toggleTheme} />;
  if (window.location.pathname === '/install') return <InstallGuide theme={theme} onToggleTheme={toggleTheme} />;
  return <PlayerApp theme={theme} onToggleTheme={toggleTheme} />;
}

function PlayerApp({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [screen, setScreen] = useState<Screen>('home');
  const [data, setData] = useState<GameData>(fallbackData);
  const [players, setPlayers] = useState<string[]>(['Mia', 'Tom']);
  const [activeCategoryIds, setActiveCategoryIds] = useState<number[]>(fallbackData.categories.map((category) => category.id));
  const [deck, setDeck] = useState<Card[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    api<GameData>('/api/game').then((remote) => {
      if (remote.categories?.length) {
        setData(remote);
        setActiveCategoryIds(remote.categories.map((category) => category.id));
      }
    }).catch(() => undefined).finally(() => setLoadState('ready'));
  }, []);

  const startGame = () => {
    const shuffled = [...data.cards].filter((card) => activeCategoryIds.includes(card.category_id));
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    setDeck(shuffled.map((card) => ({ ...card, text: card.text.replaceAll('${player}', players[Math.floor(Math.random() * players.length)]) })));
    setScreen('game');
  };

  if (screen === 'setup') return <SetupScreen theme={theme} onToggleTheme={onToggleTheme} data={data} players={players} setPlayers={setPlayers} activeCategoryIds={activeCategoryIds} setActiveCategoryIds={setActiveCategoryIds} onBack={() => setScreen('home')} onStart={startGame} loading={loadState === 'loading'} />;
  if (screen === 'game') return <GameScreen theme={theme} onToggleTheme={onToggleTheme} deck={deck} players={players} onFinish={() => setScreen('finished')} onExit={() => setScreen('home')} />;
  if (screen === 'finished') return <FinishedScreen theme={theme} onToggleTheme={onToggleTheme} onAgain={() => setScreen('setup')} onHome={() => setScreen('home')} />;
  return <HomeScreen theme={theme} onToggleTheme={onToggleTheme} onPlay={() => setScreen('setup')} />;
}

function AppFrame({ children, className = '', onClick, theme = 'dark' }: { children: React.ReactNode; className?: string; onClick?: () => void; theme?: Theme }) {
  return <main className={`app-frame theme-${theme} ${className}`} onClick={onClick}>{children}</main>;
}

function HomeScreen({ theme, onToggleTheme, onPlay }: { theme: Theme; onToggleTheme: () => void; onPlay: () => void }) {
  const isLight = theme === 'light';
  return <AppFrame theme={theme} className="home-screen">
    <div className="ambient-orb orb-one" /><div className="ambient-orb orb-two" />
    <header className="home-header"><Logo light={!isLight} /><div className="home-tools"><ThemeToggle theme={theme} onToggle={onToggleTheme} /></div></header>
    <section className="home-hero">
      <div className="eyebrow"><span /> Partyspiel für deine Runde</div>
      <h1>Gute Leute.<br /><em>Gute Ausreden.</em><br />Ein Drink.</h1>
      <p className="hero-copy">Das Karten-Partyspiel, bei dem jede Runde ein bisschen anders läuft.</p>
      <button className="play-button" type="button" onClick={onPlay}><span>Play</span><span className="play-arrow"><ArrowIcon /></span></button>
      <a className="install-link" href="/install">Wie installiere ich sip. auf meinem Smartphone? <ArrowIcon /></a>
    </section>
    <footer className="home-footer"><span>Kein Login. Kein Score.</span><a href="/admin">Admin Login <ArrowIcon /></a></footer>
  </AppFrame>;
}

function InstallGuide({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [device, setDevice] = useState<'ios' | 'android'>('ios');
  const steps = device === 'ios'
    ? [
        ['01', 'Teilen öffnen', 'Tippe in Safari auf das Teilen-Symbol – das Quadrat mit dem Pfeil nach oben.'],
        ['02', 'Zum Home-Bildschirm', 'Scrolle im Menü nach unten und wähle „Zum Home-Bildschirm“.'],
        ['03', 'Hinzufügen', 'Bestätige mit „Hinzufügen“. sip. erscheint danach wie eine normale App auf deinem Home-Bildschirm.'],
      ]
    : [
        ['01', 'Browser-Menü öffnen', 'Tippe auf die drei Punkte im Browser-Menü – je nach Browser oben oder unten.'],
        ['02', 'App installieren', 'Wähle „App installieren“ oder „Zum Startbildschirm hinzufügen“.'],
        ['03', 'Bestätigen', 'Bestätige die Auswahl. sip. ist danach direkt über deinen Startbildschirm erreichbar.'],
      ];
  return <AppFrame theme={theme} className="install-screen">
    <header className="install-header"><a className="back-button" href="/" aria-label="Zurück zur Startseite"><span aria-hidden="true">←</span> Zurück</a><Logo light={theme === 'dark'} /><ThemeToggle theme={theme} onToggle={onToggleTheme} /></header>
    <div className="install-content">
      <div className="eyebrow dark"><span /> sip. auf deinem Smartphone</div>
      <h1>Einmal einrichten.<br /><em>Immer bereit.</em></h1>
      <p className="section-intro">Installiere sip. auf deinem Home-Bildschirm – dann ist die nächste Runde nur einen Tipp entfernt.</p>
      <div className="install-tabs" role="tablist" aria-label="Gerät auswählen">
        <button type="button" role="tab" aria-selected={device === 'ios'} className={device === 'ios' ? 'active' : ''} onClick={() => setDevice('ios')}>Apple / iOS</button>
        <button type="button" role="tab" aria-selected={device === 'android'} className={device === 'android' ? 'active' : ''} onClick={() => setDevice('android')}>Android</button>
      </div>
      <div className="install-steps">{steps.map(([number, title, text]) => <article className="install-step" key={number}><span className="install-step-number">{number}</span><div><h2>{title}</h2><p>{text}</p></div></article>)}</div>
      <a className="text-button install-back-link" href="/">Zurück zu sip. <ArrowIcon /></a>
    </div>
  </AppFrame>;
}

function SetupScreen({ theme, onToggleTheme, data, players, setPlayers, activeCategoryIds, setActiveCategoryIds, onBack, onStart, loading }: {
  theme: Theme; onToggleTheme: () => void; data: GameData; players: string[]; setPlayers: (value: string[]) => void; activeCategoryIds: number[]; setActiveCategoryIds: (value: number[]) => void; onBack: () => void; onStart: () => void; loading: boolean;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const addPlayer = () => {
    const clean = name.trim();
    if (!clean) return;
    if (players.some((player) => player.toLowerCase() === clean.toLowerCase())) { setError('Der Name ist schon dabei.'); return; }
    setPlayers([...players, clean]); setName(''); setError('');
  };
  const removePlayer = (index: number) => setPlayers(players.filter((_, playerIndex) => playerIndex !== index));
  const toggleCategory = (id: number) => setActiveCategoryIds(activeCategoryIds.includes(id) ? activeCategoryIds.filter((categoryId) => categoryId !== id) : [...activeCategoryIds, id]);
  const cardCount = data.cards.filter((card) => activeCategoryIds.includes(card.category_id)).length;
  const canStart = players.length >= 2 && activeCategoryIds.length > 0 && cardCount > 0;
  return <AppFrame theme={theme} className="setup-screen">
    <header className="screen-header"><BackButton onClick={onBack} /><Logo light={theme === 'dark'} /><div className="screen-header-right"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><span className="step-count">01 / 02</span></div></header>
    <div className="setup-content">
      <div className="eyebrow dark"><span /> Erst die Runde, dann der Rest</div>
      <h2>Wer ist<br /><em>dabei?</em></h2>
      <p className="section-intro">Mindestens zwei Personen. Namen später ändern? Einfach eine neue Runde starten.</p>
      <section className="setup-section"><div className="section-label"><span>Spieler</span><span className="count-badge">{players.length}</span></div><div className="player-chips">{players.map((player, index) => <div className="player-chip" key={`${player}-${index}`}><span className="avatar" style={{ '--avatar-index': index } as React.CSSProperties}>{player.charAt(0).toUpperCase()}</span><span>{player}</span><button type="button" aria-label={`${player} entfernen`} onClick={() => removePlayer(index)}>×</button></div>)}</div><form className="add-player" onSubmit={(event) => { event.preventDefault(); addPlayer(); }}><input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Name hinzufügen" maxLength={24} aria-label="Spielername" autoComplete="off" inputMode="text" enterKeyHint="done" /><button type="submit" aria-label="Spieler hinzufügen">+</button></form>{error && <p className="field-error">{error}</p>}{players.length < 2 && <p className="field-hint">Noch {2 - players.length} Spieler{2 - players.length === 1 ? '' : 'n'} hinzufügen, dann kann es losgehen.</p>}</section>
      <section className="setup-section category-section"><div className="section-label"><span>Kategorien</span><span className="category-hint">{cardCount} Karten</span></div><div className="category-list">{data.categories.map((category, index) => <label className={`category-toggle ${activeCategoryIds.includes(category.id) ? 'selected' : ''}`} key={category.id}><input type="checkbox" checked={activeCategoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} /><span className={`category-marker marker-${colors[index % colors.length]}`} /><span className="category-name">{category.name}</span><span className="checkmark">✓</span></label>)}</div></section>
      <button className="primary-button start-button" type="button" disabled={!canStart} onClick={onStart}>{loading ? 'Karten laden …' : 'Start Game'} <ArrowIcon /></button>
    </div>
  </AppFrame>;
}

function GameScreen({ theme, onToggleTheme, deck, players, onFinish, onExit }: { theme: Theme; onToggleTheme: () => void; deck: Card[]; players: string[]; onFinish: () => void; onExit: () => void }) {
  const [index, setIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [showQuit, setShowQuit] = useState(false);
  const [isClosingQuit, setIsClosingQuit] = useState(false);
  const card = deck[index];
  const next = () => {
    if (isExiting || showQuit) return;
    if (index >= deck.length - 1) { onFinish(); return; }
    setIsExiting(true);
    window.setTimeout(() => { setIndex((value) => value + 1); setIsExiting(false); }, 180);
  };
  const dismissQuit = () => {
    if (isClosingQuit) return;
    setIsClosingQuit(true);
    window.setTimeout(() => { setShowQuit(false); setIsClosingQuit(false); }, 180);
  };
  const leaveGame = () => {
    if (isClosingQuit) return;
    setIsClosingQuit(true);
    window.setTimeout(onExit, 180);
  };
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === ' ' || event.key === 'Enter') next(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); });
  if (!card) return <FinishedScreen theme={theme} onToggleTheme={onToggleTheme} onAgain={() => undefined} onHome={onFinish} />;
  const category = card.category_name || (card.category_id === 1 ? 'Fragen' : card.category_id === 2 ? 'Gruppenaufgaben' : 'Einzelaufgaben');
  return <AppFrame theme={theme} className="game-screen" onClick={next}>
    <header className="game-header"><div className="game-header-left"><button className="game-exit" type="button" aria-label="Spiel beenden" onClick={(event) => { event.stopPropagation(); setShowQuit(true); }}><span className="game-exit-arrow" aria-hidden="true">←</span><span>Beenden</span></button></div><Logo light={theme === 'dark'} /><div className="game-header-right"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><span className="round-counter">Card <strong>{index + 1}</strong> / {deck.length}</span><span className="player-count">{players.length} dabei</span></div></header>
    <div className="game-stage"><div className={`prompt-card card-${index % 3} ${isExiting ? 'is-exiting' : ''}`}><div className="card-topline"><span className="card-category">{category}</span><span className="card-mark">sip.</span></div><div className="card-copy">{card.text}</div><div className="card-bottomline"><span>Tippen für nächste Karte</span><span className="card-arrow">→</span></div></div></div>
    <footer className="game-footer"><span>Eine Runde. Eine Karte.</span><span className="tap-indicator"><i /> tap anywhere</span></footer>
    {showQuit && <div className={`quit-backdrop ${isClosingQuit ? 'is-closing' : ''}`} role="presentation" onClick={dismissQuit}><section className="quit-dialog" role="dialog" aria-modal="true" aria-labelledby="quit-title" onClick={(event) => event.stopPropagation()}><span className="quit-dialog-mark">sip.</span><h2 id="quit-title">Spiel beenden?</h2><p>Die aktuelle Runde wird beendet. Du kannst jederzeit eine neue starten.</p><div className="quit-actions"><button className="text-button" type="button" onClick={dismissQuit}>Weiterspielen</button><button className="primary-button" type="button" onClick={leaveGame}>Beenden <ArrowIcon /></button></div></section></div>}
  </AppFrame>;
}

function FinishedScreen({ theme, onToggleTheme, onAgain, onHome }: { theme: Theme; onToggleTheme: () => void; onAgain: () => void; onHome: () => void }) {
  return <AppFrame theme={theme} className="finished-screen"><header className="finished-header"><Logo light={theme === 'dark'} /><ThemeToggle theme={theme} onToggle={onToggleTheme} /></header><div className="confetti confetti-a" /><div className="confetti confetti-b" /><div className="finished-inner"><span className="finish-emoji">✦</span><div className="eyebrow dark"><span /> Deck geschafft</div><h2>Das war's<br /><em>für jetzt.</em></h2><p>Ihr habt alle Karten gespielt. Zeit für eine letzte Runde – oder für neue Geschichten.</p><div className="finished-actions"><button className="primary-button" type="button" onClick={onAgain}>Nochmal spielen <ArrowIcon /></button><button className="text-button" type="button" onClick={onHome}>Zur Startseite</button></div></div></AppFrame>;
}

function AdminApp({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [user, setUser] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => { api<{ user: { username: string } }>('/api/auth/me').then((result) => setUser(result.user?.username || null)).catch(() => setUser(null)).finally(() => setChecking(false)); }, []);
  if (checking) return <AppFrame theme={theme} className="admin-loading"><Logo /><span className="loading-dots">● ● ●</span></AppFrame>;
  return user ? <AdminDashboardEnhanced theme={theme} onToggleTheme={onToggleTheme} username={user} onLogout={() => setUser(null)} /> : <AdminLogin theme={theme} onToggleTheme={onToggleTheme} onSuccess={setUser} />;
}

function AdminLogin({ theme, onToggleTheme, onSuccess }: { theme: Theme; onToggleTheme: () => void; onSuccess: (username: string) => void }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const login = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { const result = await api<{ user: { username: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); onSuccess(result.user.username); } catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Login fehlgeschlagen.'); } finally { setBusy(false); } };
  return <AppFrame theme={theme} className="admin-screen"><header className="admin-login-header"><a className="back-button" href="/" aria-label="Zurück zur App"><span aria-hidden="true">←</span> Zurück zur App</a><Logo light={theme === 'dark'} /><ThemeToggle theme={theme} onToggle={onToggleTheme} /></header><div className="admin-grid admin-login-grid"><div className="admin-aside"><div className="admin-aside-copy"><span className="mini-sticker">behind the scenes</span><h1>Mach's<br /><em>zu deinem</em><br />Spiel.</h1><p>Verwalte Karten und Kategorien für deine nächste Runde.</p></div></div><div className="admin-panel"><div className="admin-panel-inner"><div className="eyebrow dark"><span /> Admin-Bereich</div><h2>Willkommen<br /><em>zurück.</em></h2><p className="section-intro">Melde dich an, um dein Karten-Deck zu verwalten.</p><form className="admin-form" onSubmit={login}><label>Benutzername<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" inputMode="text" enterKeyHint="next" placeholder="admin" /></label><label>Passwort<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" enterKeyHint="done" placeholder="••••••••" /></label>{error && <p className="field-error">{error}</p>}<button className="primary-button" type="submit" disabled={busy}>{busy ? 'Anmelden …' : 'Anmelden'} <ArrowIcon /></button></form><p className="admin-security">Deine Session ist sicher und läuft nach 8 Stunden ab.</p></div></div></div></AppFrame>;
}

function CsvImportPanel({ onImport, importing }: { onImport: (event: React.ChangeEvent<HTMLInputElement>) => void; importing: boolean }) {
  return <section className="csv-import-card"><div className="csv-import-copy"><span className="card-kicker">CSV / Deck Import</span><h2>Viele Karten?<br /><em>Einfach rein.</em></h2><p>Importiere ein ganzes Deck als CSV. Fehlende Kategorien werden automatisch angelegt.</p></div><div className="csv-instructions"><p><strong>Format</strong> UTF-8, Trennzeichen <code>;</code>, eine Karte pro Zeile.</p><p><strong>Kopfzeile</strong> muss exakt <code>category_name;card_text</code> lauten.</p><p><strong>Beispiel</strong></p><pre><code>category_name;card_text{`\n`}Fragen;Wer würde am ehesten zuerst lachen?{`\n`}&quot;Gruppenaufgaben&quot;;&quot;Alle stoßen an; die letzte Person trinkt.&quot;</code></pre><p className="csv-note">Semikolons im Inhalt in Anführungszeichen setzen. Anführungszeichen im Inhalt verdoppeln.</p></div><label className="csv-file-button"><input type="file" accept=".csv,text/csv" onChange={onImport} disabled={importing} /><span>{importing ? 'Import läuft …' : 'CSV auswählen'}</span><ArrowIcon /></label></section>;
}

function AdminDashboard({ theme, onToggleTheme, username, onLogout }: { theme: Theme; onToggleTheme: () => void; username: string; onLogout: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [cardText, setCardText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'deck' | 'import'>('deck');

  const refresh = async () => {
    try {
      const [categoryResult, cardResult] = await Promise.all([api<{ categories: Category[] }>('/api/admin/categories'), api<{ cards: Card[] }>('/api/admin/cards')]);
      setCategories(categoryResult.categories);
      setCards(cardResult.cards);
      if (!categoryResult.categories.some((category) => String(category.id) === selectedCategory)) setSelectedCategory(categoryResult.categories[0] ? String(categoryResult.categories[0].id) : '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Daten konnten nicht geladen werden.');
    }
  };
  useEffect(() => { refresh(); }, []);

  const filteredCards = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return cards.filter((card) => {
      const matchesCategory = filter === 'all' || String(card.category_id) === filter;
      const matchesSearch = !normalizedQuery || card.text.toLocaleLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [cards, filter, searchQuery]);
  const pageCount = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const visibleCards = useMemo(() => filteredCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredCards, page]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);

  const addCategory = async (event: React.FormEvent) => { event.preventDefault(); if (!categoryName.trim()) return; try { await api('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name: categoryName }) }); setCategoryName(''); setError(''); setNotice('Kategorie angelegt.'); await refresh(); } catch (addError) { setError(addError instanceof Error ? addError.message : 'Kategorie konnte nicht angelegt werden.'); } };
  const deleteCategory = async (category: Category) => { try { await api(`/api/admin/categories/${category.id}`, { method: 'DELETE' }); setError(''); setNotice('Kategorie und Karten gelöscht.'); await refresh(); } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Löschen fehlgeschlagen.'); } };
  const addCard = async (event: React.FormEvent) => { event.preventDefault(); if (!cardText.trim() || !selectedCategory) return; try { await api('/api/admin/cards', { method: 'POST', body: JSON.stringify({ text: cardText, category_id: Number(selectedCategory) }) }); setCardText(''); setError(''); setNotice('Karte angelegt.'); await refresh(); } catch (addError) { setError(addError instanceof Error ? addError.message : 'Karte konnte nicht angelegt werden.'); } };
  const deleteCard = async (card: Card) => { try { await api(`/api/admin/cards/${card.id}`, { method: 'DELETE' }); setError(''); setNotice('Karte gelöscht.'); await refresh(); } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'Löschen fehlgeschlagen.'); } };
  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setImporting(true); setError(''); try { const result = await api<{ importedCards: number; skippedRows: number; createdCategories: number }>('/api/admin/import', { method: 'POST', body: JSON.stringify({ csv: await file.text() }) }); setNotice(`${result.importedCards} Karten importiert${result.skippedRows ? `, ${result.skippedRows} fehlerhafte Zeile${result.skippedRows === 1 ? '' : 'n'} übersprungen` : ''}${result.createdCategories ? `, ${result.createdCategories} Kategorien neu angelegt` : ''}.`); await refresh(); } catch (importError) { setError(importError instanceof Error ? importError.message : 'CSV konnte nicht importiert werden.'); } finally { setImporting(false); event.target.value = ''; } };
  const logout = async () => { await api('/api/auth/me', { method: 'POST' }).catch(() => undefined); onLogout(); };
  const changeFilter = (value: string) => { setFilter(value); setPage(1); };
  const changeSearch = (value: string) => { setSearchQuery(value); setPage(1); };

  return <AppFrame theme={theme} className="admin-dashboard">
    <header className="dashboard-header"><a href="/" aria-label="Zurück zur App"><Logo light={theme === 'dark'} /></a><div className="dashboard-user"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><div className="dashboard-identity">Angemeldet als <strong>{username}</strong></div><button type="button" onClick={logout}>Abmelden</button></div></header>
    <div className="dashboard-content">
      <div className="dashboard-intro"><div><div className="eyebrow dark"><span /> Dein Backstage</div><h1>Deck<br /><em>Studio.</em></h1></div><div className="dashboard-stats"><div><strong>{categories.length}</strong><span>Kategorien</span></div><div><strong>{cards.length}</strong><span>Karten</span></div></div></div>
      <nav className="dashboard-tabs" aria-label="Adminbereiche"><button type="button" className={activeTab === 'deck' ? 'active' : ''} onClick={() => setActiveTab('deck')}>Deck verwalten <span>{cards.length}</span></button><button type="button" className={activeTab === 'import' ? 'active' : ''} onClick={() => setActiveTab('import')}>CSV importieren</button></nav>
      {activeTab === 'import' ? <CsvImportPanel onImport={importCsv} importing={importing} /> : <div className="admin-columns">
        <section className="admin-card manage-categories"><div className="admin-card-heading"><div><span className="card-kicker">01 / Kategorien</span><h2>Ordnung<br /><em>schaffen.</em></h2></div><span className="heading-icon">✳</span></div><form className="inline-form" onSubmit={addCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={60} placeholder="Neue Kategorie" /><button type="submit" aria-label="Kategorie hinzufügen">+</button></form><div className="admin-category-list">{categories.map((category, index) => <div className="admin-category-row" key={category.id}><span className={`category-marker marker-${colors[index % colors.length]}`} /><span>{category.name}</span><span className="category-card-count">{cards.filter((card) => card.category_id === category.id).length} Karten</span><button type="button" className="row-delete" onClick={() => deleteCategory(category)} aria-label={`${category.name} löschen`}>×</button></div>)}</div></section>
        <section className="admin-card manage-cards"><div className="admin-card-heading"><div><span className="card-kicker">02 / Karten</span><h2>Die guten<br /><em>Fragen.</em></h2></div><span className="heading-icon">✦</span></div><form className="card-create-form" onSubmit={addCard}><textarea value={cardText} onChange={(event) => setCardText(event.target.value)} maxLength={500} placeholder="Neue Karte schreiben …  (Tipp: ${player} wird im Spiel ersetzt)" rows={3} autoComplete="off" inputMode="text" /><div className="form-row"><select value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)} aria-label="Kategorie wählen"><option value="" disabled>Kategorie wählen</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select><button className="small-submit" type="submit">Hinzufügen <ArrowIcon /></button></div></form>
          <div className="card-filter"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => changeFilter('all')}>Alle <span>{cards.length}</span></button>{categories.map((category) => <button type="button" className={filter === String(category.id) ? 'active' : ''} onClick={() => changeFilter(String(category.id))} key={category.id}>{category.name} <span>{cards.filter((card) => card.category_id === category.id).length}</span></button>)}</div>
          <div className="card-list-tools"><label className="card-search"><span aria-hidden="true">⌕</span><input type="search" value={searchQuery} onChange={(event) => changeSearch(event.target.value)} placeholder="Fragen durchsuchen …" aria-label="Fragen durchsuchen" autoComplete="off" inputMode="search" enterKeyHint="search" /></label><span className="result-count">{filteredCards.length} Treffer</span></div>
          <div className="admin-card-list">{visibleCards.map((card) => <div className="admin-prompt-row" key={card.id}><div><span className="prompt-category">{card.category_name}</span><p>{card.text}</p></div><button type="button" className="row-delete" onClick={() => deleteCard(card)} aria-label="Karte löschen">×</button></div>)}{!visibleCards.length && <p className="empty-state">Keine Karten für diese Suche.</p>}</div>
          {filteredCards.length > 0 && <nav className="pagination" aria-label="Karten-Seiten"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Zurück</button><span>Seite {page} von {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Weiter →</button></nav>}
        </section>
      </div>}
    </div>
  </AppFrame>;
}

type DuplicateWarning = { kind: 'exact' | 'similar'; card: Card } | null;

function CardText({ text }: { text: string }) {
  const parts = text.split(/(\$\{player2?\})/g);
  return <>{parts.map((part, index) => part.match(/^\$\{player2?\}$/) ? <span className="placeholder-token" key={`${part}-${index}`}>{part}</span> : <span key={`${part}-${index}`}>{part}</span>)}</>;
}

function normalizeCardText(value: string) {
  return value.toLocaleLowerCase().replaceAll('${player}', 'player').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function findDuplicate(cards: Card[], text: string, excludedId?: number): DuplicateWarning {
  const normalized = normalizeCardText(text);
  if (!normalized) return null;
  const exact = cards.find((card) => card.id !== excludedId && normalizeCardText(card.text) === normalized);
  if (exact) return { kind: 'exact', card: exact };
  if (normalized.length < 16) return null;
  const words = new Set(normalized.split(' ').filter((word) => word.length > 2));
  let best: { card: Card; score: number } | null = null;
  for (const card of cards) {
    if (card.id === excludedId) continue;
    const otherWords = new Set(normalizeCardText(card.text).split(' ').filter((word) => word.length > 2));
    if (words.size < 3 || otherWords.size < 3) continue;
    const shared = [...words].filter((word) => otherWords.has(word)).length;
    const score = shared / Math.min(words.size, otherWords.size);
    if (score >= .78 && (!best || score > best.score)) best = { card, score };
  }
  if (!best) return null;
  return { kind: 'similar', card: best.card };
}

function CardEditorDrawer({ open, mode, text, categoryId, categories, duplicateWarning, onTextChange, onCategoryChange, onSubmit, onClose }: {
  open: boolean; mode: 'create' | 'edit'; text: string; categoryId: string; categories: Category[]; duplicateWarning: DuplicateWarning; onTextChange: (value: string) => void; onCategoryChange: (value: string) => void; onSubmit: () => void; onClose: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) window.setTimeout(() => textareaRef.current?.focus(), 80); }, [open]);
  if (!open) return null;
  const previewText = text.trim() ? (() => { let playerIndex = 0; const dummyPlayers = ['Mia', 'Alex', 'Sam']; return text.replace(/\$\{player\}/g, () => dummyPlayers[playerIndex++ % dummyPlayers.length]); })() : 'Deine Frage erscheint hier …';
  const previewCategory = categories.find((category) => String(category.id) === categoryId)?.name || 'Fragen';
  const insertPlaceholder = () => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? text.length;
    const end = textarea?.selectionEnd ?? text.length;
    const nextText = `${text.slice(0, start)}\${player}${text.slice(end)}`;
    onTextChange(nextText);
    window.requestAnimationFrame(() => { textareaRef.current?.focus(); textareaRef.current?.setSelectionRange(start + 9, start + 9); });
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSubmit(); }
  };
  return <div className="card-editor-backdrop" onClick={onClose}><aside className="card-editor-drawer" role="dialog" aria-modal="true" aria-labelledby="card-editor-title" onClick={(event) => event.stopPropagation()}>
    <div className="card-editor-header"><div><span className="card-kicker">{mode === 'create' ? 'Neue Karte' : 'Karte bearbeiten'}</span><h2 id="card-editor-title">{mode === 'create' ? <>{'Frage'}<br /><em>bauen.</em></> : <>{'Frage'}<br /><em>schärfen.</em></>}</h2></div><button className="drawer-close" type="button" onClick={onClose} aria-label="Editor schließen">×</button></div>
    <form className="card-editor-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <div className="card-editor-scroll">
      <label className="editor-field-label" htmlFor="card-editor-text">Karteninhalt</label>
      <div className="placeholder-tools"><span>Einfügen:</span><button type="button" onClick={insertPlaceholder}><code>${'{player}'}</code><span>Spielername</span></button></div>
      <textarea ref={textareaRef} id="card-editor-text" value={text} onChange={(event) => onTextChange(event.target.value)} onKeyDown={handleKeyDown} maxLength={500} rows={5} autoComplete="off" inputMode="text" aria-describedby="card-editor-hint" placeholder="Schreibe eine Frage …" />
      <p id="card-editor-hint" className="editor-hint">Tipp: <code>${'{player}'}</code> wird im Spiel zufällig durch einen Namen ersetzt. <kbd>Enter</kbd> speichert, <kbd>Shift + Enter</kbd> macht einen Zeilenumbruch.</p>
      {duplicateWarning && <p className={`duplicate-warning ${duplicateWarning.kind === 'exact' ? 'is-exact' : ''}`} role="alert">{duplicateWarning.kind === 'exact' ? 'Diese Frage gibt es bereits.' : 'Diese Frage klingt sehr ähnlich wie:'}<strong>„{duplicateWarning.card.text}“</strong></p>}
      <label className="editor-field-label" htmlFor="card-editor-category">Kategorie</label>
      <select id="card-editor-category" value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>
      <div className="editor-preview"><div className="editor-preview-heading"><span>Live-Vorschau</span><span>wie im Spiel</span></div><div className="editor-preview-card prompt-card card-0"><div className="card-topline"><span>{previewCategory}</span><span className="card-mark">sip.</span></div><div className="card-copy">{previewText}</div><div className="card-bottomline"><span>Tippen für nächste Karte</span><span className="card-arrow">→</span></div></div></div>
      </div>
      <div className="card-editor-actions"><button className="text-button" type="button" onClick={onClose}>Abbrechen</button><button className="primary-button" type="submit" disabled={!text.trim() || !categoryId}>{mode === 'create' ? 'Karte anlegen' : 'Änderungen speichern'} <ArrowIcon /></button></div>
    </form>
  </aside></div>;
}

type ToastMessage = { id: number; kind: 'success' | 'error' | 'info'; message: string };
type DeleteRequest = { kind: 'card'; item: Card } | { kind: 'category'; item: Category };

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  const [isLeaving, setIsLeaving] = useState(false);
  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), 3200);
    const removeTimer = window.setTimeout(onDismiss, 3600);
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(removeTimer); };
  }, [toast.id]);
  return <div className={`toast ${toast.kind === 'error' ? 'is-error' : toast.kind === 'info' ? 'is-info' : ''} ${isLeaving ? 'is-leaving' : ''}`} role={toast.kind === 'error' ? 'alert' : 'status'}><span className="toast-icon" aria-hidden="true">{toast.kind === 'error' ? '!' : toast.kind === 'info' ? 'i' : '✓'}</span><span className="toast-message">{toast.message}</span><button className="toast-dismiss" type="button" onClick={onDismiss} aria-label="Meldung schließen">×</button></div>;
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  return <div className="toast-viewport" aria-live="polite" aria-atomic="false">{toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />)}</div>;
}

function DeleteConfirmDialog({ request, onCancel, onConfirm }: { request: DeleteRequest | null; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!request) return;
    confirmRef.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
      if (event.key === 'Enter' && !(event.target as HTMLElement | null)?.closest('button')) { event.preventDefault(); void onConfirm(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [request, onCancel, onConfirm]);
  if (!request) return null;
  const isCategory = request.kind === 'category';
  const title = isCategory ? 'Kategorie löschen?' : 'Karte löschen?';
  const description = isCategory ? `„${request.item.name}“ und alle zugehörigen Karten werden endgültig gelöscht.` : 'Möchtest du diese Karte wirklich löschen?';
  return <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onCancel(); }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description"><span className="confirm-dialog-icon" aria-hidden="true">!</span><div className="confirm-dialog-copy"><span className="card-kicker">Aktion bestätigen</span><h2 id="delete-dialog-title">{title}</h2><p id="delete-dialog-description">{description}</p>{!isCategory && <strong className="confirm-preview">„{request.item.text}“</strong>}</div><div className="confirm-actions"><button className="text-button" type="button" onClick={onCancel}>Abbrechen</button><button ref={confirmRef} className="danger-button" type="button" onClick={() => void onConfirm()}>Löschen</button></div></section></div>;
}

function AdminCardRow({ card, categories, duplicateChecker, onSave, onDelete, onEditDrawer }: {
  card: Card; categories: Category[]; duplicateChecker: (text: string, excludedId: number) => DuplicateWarning; onSave: (id: number, text: string, categoryId: number) => Promise<boolean>; onDelete: (card: Card) => void; onEditDrawer: (card: Card) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [categoryId, setCategoryId] = useState(String(card.category_id));
  useEffect(() => { if (!editing) { setText(card.text); setCategoryId(String(card.category_id)); } }, [card, editing]);
  const save = async () => { if (!text.trim() || !categoryId) return; if (await onSave(card.id, text, Number(categoryId))) setEditing(false); };
  if (editing) return <div className="admin-prompt-row inline-editing"><div className="prompt-category-cell"><span className="prompt-category">Bearbeiten</span><select className="inline-category-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Kategorie ändern">{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></div><div className="prompt-text-cell"><textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setEditing(false); } if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void save(); } }} autoFocus maxLength={500} rows={3} aria-label="Karteninhalt bearbeiten" />{duplicateChecker(text, card.id) && <span className="inline-duplicate-warning">Ähnliche Frage vorhanden</span>}</div><div className="row-actions"><button className="row-action primary-action" type="button" onClick={() => void save()}>Speichern</button><button className="row-action" type="button" onClick={() => setEditing(false)}>Abbrechen</button></div></div>;
  return <div className="admin-prompt-row" onDoubleClick={() => setEditing(true)}><div className="prompt-category-cell"><span className="prompt-category">{card.category_name}</span></div><div className="prompt-text-cell"><p><CardText text={card.text} /></p></div><div className="row-actions"><button className="row-action edit-action" type="button" onClick={() => onEditDrawer(card)}><span className="row-action-icon" aria-hidden="true">✏️</span><span className="row-action-label">Bearbeiten</span></button><button type="button" className="row-delete" onClick={() => onDelete(card)} aria-label="Karte löschen"><span aria-hidden="true">🗑️</span><span className="row-delete-label">Löschen</span></button></div></div>;
}

function CategoryManagerRow({ category, index, total, cardCount, onRename, onMove, onDelete }: { category: Category; index: number; total: number; cardCount: number; onRename: (id: number, name: string) => Promise<boolean>; onMove: (id: number, direction: 'up' | 'down') => void; onDelete: (category: Category) => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  useEffect(() => { if (!editing) setName(category.name); }, [category.name, editing]);
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (name.trim() && await onRename(category.id, name)) setEditing(false); };
  if (editing) return <form className="admin-category-row category-editing" onSubmit={save}><span className="category-marker marker-lime" /><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); setEditing(false); } }} autoFocus maxLength={60} autoComplete="off" inputMode="text" enterKeyHint="done" aria-label="Kategorie umbenennen" /><button className="row-action primary-action" type="submit">Speichern</button><button className="row-action" type="button" onClick={() => setEditing(false)} aria-label="Umbenennen abbrechen">×</button></form>;
  return <div className="admin-category-row"><span className={`category-marker marker-${colors[index % colors.length]}`} /><button className="category-title" type="button" onDoubleClick={() => setEditing(true)} onClick={() => setEditing(true)}>{category.name}</button><span className="category-card-count">{cardCount} Karten</span><div className="category-order-actions"><button type="button" disabled={index === 0} onClick={() => onMove(category.id, 'up')} aria-label={`${category.name} nach oben`}>↑</button><button type="button" disabled={index === total - 1} onClick={() => onMove(category.id, 'down')} aria-label={`${category.name} nach unten`}>↓</button></div><button type="button" className="row-delete" onClick={() => onDelete(category)} aria-label={`${category.name} löschen`}>×</button></div>;
}

function AdminDashboardEnhanced({ theme, onToggleTheme, username, onLogout }: { theme: Theme; onToggleTheme: () => void; username: string; onLogout: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categoryName, setCategoryName] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'deck' | 'import'>('deck');
  const [editorMode, setEditorMode] = useState<'create' | 'edit' | null>(null);
  const [editorCardId, setEditorCardId] = useState<number | null>(null);
  const [editorText, setEditorText] = useState('');
  const [editorCategory, setEditorCategory] = useState('');
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const toastIdRef = useRef(0);

  const showToast = (message: string, kind: ToastMessage['kind'] = 'success') => {
    const id = ++toastIdRef.current;
    setToasts((current) => [...current.slice(-2), { id, kind, message }]);
  };
  const dismissToast = (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id));

  const refresh = async () => {
    try {
      const [categoryResult, cardResult] = await Promise.all([api<{ categories: Category[] }>('/api/admin/categories'), api<{ cards: Card[] }>('/api/admin/cards')]);
      setCategories(categoryResult.categories); setCards(cardResult.cards);
      if (!categoryResult.categories.some((category) => String(category.id) === editorCategory)) setEditorCategory(categoryResult.categories[0] ? String(categoryResult.categories[0].id) : '');
    } catch (loadError) { showToast(loadError instanceof Error ? loadError.message : 'Daten konnten nicht geladen werden.', 'error'); }
  };
  useEffect(() => { refresh(); }, []);
  const filteredCards = useMemo(() => { const query = searchQuery.trim().toLocaleLowerCase(); return cards.filter((card) => (filter === 'all' || String(card.category_id) === filter) && (!query || card.text.toLocaleLowerCase().includes(query))); }, [cards, filter, searchQuery]);
  const pageCount = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const visibleCards = useMemo(() => filteredCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredCards, page]);
  useEffect(() => { setPage((current) => Math.min(current, pageCount)); }, [pageCount]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isField = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
      else if (event.key === '/' && !isField) { event.preventDefault(); searchRef.current?.focus(); }
      else if (event.key === 'Escape' && editorMode) { event.preventDefault(); setEditorMode(null); setEditorCardId(null); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [editorMode]);

  const openCreate = () => { setEditorMode('create'); setEditorCardId(null); setEditorText(''); setEditorCategory(categories[0] ? String(categories[0].id) : ''); };
  const openEdit = (card: Card) => { setEditorMode('edit'); setEditorCardId(card.id); setEditorText(card.text); setEditorCategory(String(card.category_id)); };
  const closeEditor = () => { setEditorMode(null); setEditorCardId(null); };
  const currentDuplicate = useMemo(() => findDuplicate(cards, editorText, editorCardId ?? undefined), [cards, editorText, editorCardId]);
  const submitEditor = async () => {
    if (!editorText.trim() || !editorCategory) return;
    if (currentDuplicate?.kind === 'exact') { showToast('Diese Frage existiert bereits und wurde nicht gespeichert.', 'error'); return; }
    try { await api(editorMode === 'edit' ? `/api/admin/cards/${editorCardId}` : '/api/admin/cards', { method: editorMode === 'edit' ? 'PUT' : 'POST', body: JSON.stringify({ text: editorText, category_id: Number(editorCategory) }) }); showToast(editorMode === 'edit' ? 'Karte aktualisiert.' : 'Karte angelegt.'); closeEditor(); await refresh(); } catch (saveError) { showToast(saveError instanceof Error ? saveError.message : 'Karte konnte nicht gespeichert werden.', 'error'); }
  };
  const saveInlineCard = async (id: number, text: string, categoryId: number) => {
    if (findDuplicate(cards, text, id)?.kind === 'exact') { showToast('Diese Frage existiert bereits.', 'error'); return false; }
    try { await api(`/api/admin/cards/${id}`, { method: 'PUT', body: JSON.stringify({ text, category_id: categoryId }) }); showToast('Karte aktualisiert.'); await refresh(); return true; } catch (saveError) { showToast(saveError instanceof Error ? saveError.message : 'Karte konnte nicht aktualisiert werden.', 'error'); return false; }
  };
  const addCategory = async (event: React.FormEvent) => { event.preventDefault(); if (!categoryName.trim()) return; try { await api('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name: categoryName }) }); setCategoryName(''); showToast('Kategorie angelegt.'); await refresh(); } catch (addError) { showToast(addError instanceof Error ? addError.message : 'Kategorie konnte nicht angelegt werden.', 'error'); } };
  const renameCategory = async (id: number, name: string) => { try { await api(`/api/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }); showToast('Kategorie umbenannt.'); await refresh(); return true; } catch (renameError) { showToast(renameError instanceof Error ? renameError.message : 'Kategorie konnte nicht umbenannt werden.', 'error'); return false; } };
  const moveCategory = async (id: number, direction: 'up' | 'down') => { try { await api(`/api/admin/categories/${id}`, { method: 'PUT', body: JSON.stringify({ direction }) }); showToast('Reihenfolge aktualisiert.'); await refresh(); } catch (moveError) { showToast(moveError instanceof Error ? moveError.message : 'Reihenfolge konnte nicht geändert werden.', 'error'); } };
  const deleteCategory = async (category: Category) => { try { await api(`/api/admin/categories/${category.id}`, { method: 'DELETE' }); showToast('Kategorie und Karten gelöscht.'); setFilter('all'); setPage(1); await refresh(); } catch (deleteError) { showToast(deleteError instanceof Error ? deleteError.message : 'Löschen fehlgeschlagen.', 'error'); } };
  const deleteCard = async (card: Card) => { try { await api(`/api/admin/cards/${card.id}`, { method: 'DELETE' }); showToast('Karte gelöscht.'); await refresh(); } catch (deleteError) { showToast(deleteError instanceof Error ? deleteError.message : 'Löschen fehlgeschlagen.', 'error'); } };
  const requestDeleteCategory = (category: Category) => setDeleteRequest({ kind: 'category', item: category });
  const requestDeleteCard = (card: Card) => setDeleteRequest({ kind: 'card', item: card });
  const confirmDelete = async () => { const request = deleteRequest; if (!request) return; setDeleteRequest(null); if (request.kind === 'category') await deleteCategory(request.item); else await deleteCard(request.item); };
  const importCsv = async (event: React.ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; setImporting(true); try { const result = await api<{ importedCards: number; skippedRows: number; createdCategories: number }>('/api/admin/import', { method: 'POST', body: JSON.stringify({ csv: await file.text() }) }); showToast(`${result.importedCards} Karten importiert${result.skippedRows ? `, ${result.skippedRows} fehlerhafte Zeile${result.skippedRows === 1 ? '' : 'n'} übersprungen` : ''}${result.createdCategories ? `, ${result.createdCategories} Kategorien neu angelegt` : ''}.`); await refresh(); } catch (importError) { showToast(importError instanceof Error ? importError.message : 'CSV konnte nicht importiert werden.', 'error'); } finally { setImporting(false); event.target.value = ''; } };
  const logout = async () => { await api('/api/auth/me', { method: 'POST' }).catch(() => undefined); onLogout(); };
  const changeFilter = (value: string) => { setFilter(value); setPage(1); };
  const changeSearch = (value: string) => { setSearchQuery(value); setPage(1); };
  const duplicateChecker = (text: string, excludedId: number) => findDuplicate(cards, text, excludedId);

  return <AppFrame theme={theme} className="admin-dashboard">
    <header className="dashboard-header"><a href="/" aria-label="Zurück zur App"><Logo light={theme === 'dark'} /></a><div className="dashboard-user"><ThemeToggle theme={theme} onToggle={onToggleTheme} /><div className="dashboard-identity">Angemeldet als <strong>{username}</strong></div><button type="button" onClick={logout}>Abmelden</button></div></header>
    <div className="dashboard-content"><div className="dashboard-intro"><div><div className="eyebrow dark"><span /> Dein Backstage</div><h1>Deck<br /><em>Studio.</em></h1></div><div className="dashboard-stats"><div><strong>{categories.length}</strong><span>Kategorien</span></div><div><strong>{cards.length}</strong><span>Karten</span></div></div></div>
      <nav className="dashboard-tabs" aria-label="Adminbereiche"><button type="button" className={activeTab === 'deck' ? 'active' : ''} onClick={() => setActiveTab('deck')}>Deck verwalten <span>{cards.length}</span></button><button type="button" className={activeTab === 'import' ? 'active' : ''} onClick={() => setActiveTab('import')}>CSV importieren</button></nav>
      {activeTab === 'import' ? <CsvImportPanel onImport={importCsv} importing={importing} /> : <>
        <div className="admin-columns"><section className="admin-card manage-categories"><div className="admin-card-heading"><div><span className="card-kicker">01 / Kategorien</span><h2>Ordnung<br /><em>schaffen.</em></h2></div><span className="heading-icon">✳</span></div><form className="inline-form" onSubmit={addCategory}><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} maxLength={60} placeholder="Neue Kategorie" autoComplete="off" inputMode="text" enterKeyHint="done" /><button type="submit" aria-label="Kategorie hinzufügen">+</button></form><div className="admin-category-list">{categories.map((category, index) => <CategoryManagerRow key={category.id} category={category} index={index} total={categories.length} cardCount={cards.filter((card) => card.category_id === category.id).length} onRename={renameCategory} onMove={moveCategory} onDelete={requestDeleteCategory} />)}</div></section>
          <section className="admin-card manage-cards"><div className="admin-card-heading"><div><span className="card-kicker">02 / Karten</span><h2>Die guten<br /><em>Fragen.</em></h2></div><button className="desktop-create-button" type="button" onClick={openCreate}><span aria-hidden="true">+</span><span>Frage erstellen</span></button></div><div className="card-filter"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => changeFilter('all')}>Alle <span className="filter-count">{cards.length}</span></button>{categories.map((category) => <button type="button" className={filter === String(category.id) ? 'active' : ''} onClick={() => changeFilter(String(category.id))} key={category.id}>{category.name} <span className="filter-count">{cards.filter((card) => card.category_id === category.id).length}</span></button>)}</div><div className="card-list-tools"><label className="card-search"><span aria-hidden="true">⌕</span><input ref={searchRef} type="search" value={searchQuery} onChange={(event) => changeSearch(event.target.value)} placeholder="Fragen durchsuchen …" aria-label="Fragen durchsuchen" autoComplete="off" inputMode="search" enterKeyHint="search" /><span className="shortcut-hint"><kbd>⌘</kbd><kbd>K</kbd></span></label><span className="result-count">{filteredCards.length} Treffer</span></div><div className="admin-list-header"><span>Kategorie</span><span>Frage</span><span>Aktionen</span></div><div className="admin-card-list">{visibleCards.map((card) => <AdminCardRow key={card.id} card={card} categories={categories} duplicateChecker={duplicateChecker} onSave={saveInlineCard} onDelete={requestDeleteCard} onEditDrawer={openEdit} />)}{!visibleCards.length && <p className="empty-state">Keine Karten für diese Suche.</p>}</div>{filteredCards.length > 0 && <nav className="pagination" aria-label="Karten-Seiten"><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Zurück</button><span>Seite {page} von {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Weiter →</button></nav>}</section></div>
      </>}
    </div>
    <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    <DeleteConfirmDialog request={deleteRequest} onCancel={() => setDeleteRequest(null)} onConfirm={confirmDelete} />
    <CardEditorDrawer open={editorMode !== null} mode={editorMode || 'create'} text={editorText} categoryId={editorCategory} categories={categories} duplicateWarning={currentDuplicate} onTextChange={setEditorText} onCategoryChange={setEditorCategory} onSubmit={() => void submitEditor()} onClose={closeEditor} />
  </AppFrame>;
}

export default App;
