const LEGACY_PLAYER_PLACEHOLDER_REGEX = /\$\{player(\d*)\}/g;
const PLAYER_PLACEHOLDER_REGEX = /#player(\d*)|\$\{player(\d*)\}/g;

type PlayerList = readonly unknown[] | null | undefined;

/** Converts legacy ${player...} markup to the canonical #player... syntax. */
export function normalizePlaceholders(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(LEGACY_PLAYER_PLACEHOLDER_REGEX, (_match, suffix: string) => `#player${suffix}`)
    : '';
}

/** Normalizes and trims card text before it is sent to the persistence layer. */
export function sanitizeQuestion(value: unknown): string {
  return typeof value === 'string' ? normalizePlaceholders(value).trim() : '';
}

function getValidPlayers(players: PlayerList): string[] {
  if (!Array.isArray(players)) return [];

  return [...new Set(
    players
      .filter((player): player is string => typeof player === 'string' && player.trim().length > 0)
      .map((player) => player.trim()),
  )];
}

function samePlayers(first: string[], second: string[]): boolean {
  return first.length === second.length && first.every((player, index) => player === second[index]);
}

function shuffle<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

/**
 * Persistent draw pool for one game. Every placeholder consumes one player;
 * the pool is refilled only after all players in it have been consumed.
 */
export class PlayerDrawPool {
  private activePlayers: string[] = [];
  private remainingPlayers: string[] = [];

  constructor(players: PlayerList = []) {
    this.reset(players);
  }

  /** Rebuilds and shuffles the pool, for example when a new game starts. */
  reset(players: PlayerList = this.activePlayers): void {
    this.activePlayers = getValidPlayers(players);
    this.remainingPlayers = shuffle([...this.activePlayers]);
  }

  /** Resets automatically when the active player list changes. */
  setPlayers(players: PlayerList): void {
    const nextPlayers = getValidPlayers(players);
    if (!samePlayers(this.activePlayers, nextPlayers)) this.reset(nextPlayers);
  }

  replace(text: unknown): string {
    if (typeof text !== 'string') return '';
    if (!this.activePlayers.length) return text;

    const usedInCurrentCard = new Set<string>();
    return text.replace(
      PLAYER_PLACEHOLDER_REGEX,
      () => this.drawForCard(usedInCurrentCard),
    );
  }

  private drawForCard(usedInCurrentCard: Set<string>): string {
    // Refill only at the pool boundary. The refill contains every active
    // player, including players already used on this card.
    if (this.remainingPlayers.length === 0) {
      this.remainingPlayers = shuffle([...this.activePlayers]);
    }

    // Prefer a player not used on this card. Splicing only this candidate
    // leaves already-used players in the pool for future cards.
    let playerIndex = this.findUnusedPlayerIndex(usedInCurrentCard);

    // If every player left in the pool was already used on this card, a
    // duplicate is unavoidable. Consume one remaining player and continue.
    if (playerIndex === -1) playerIndex = this.remainingPlayers.length - 1;

    const player = this.remainingPlayers[playerIndex];
    if (typeof player !== 'string') {
      // Defensive fallback for an inconsistent/empty pool. This branch is
      // unreachable with a valid active player list, but never returns undefined.
      return this.activePlayers[0] ?? '';
    }

    this.remainingPlayers.splice(playerIndex, 1);
    usedInCurrentCard.add(player);
    return player;
  }

  private findUnusedPlayerIndex(usedInCurrentCard: Set<string>): number {
    for (let index = this.remainingPlayers.length - 1; index >= 0; index -= 1) {
      if (!usedInCurrentCard.has(this.remainingPlayers[index])) return index;
    }
    return -1;
  }
}

/** Explicit reset helper for game-start or player-list changes. */
export function resetPlayerPool(pool: PlayerDrawPool, players: PlayerList): void {
  pool.reset(players);
}

/**
 * Replaces placeholders using the supplied persistent pool. Omitting the pool
 * keeps this helper backwards-compatible, but callers should pass one pool
 * instance for all cards in a game.
 */
export function replacePlayerPlaceholders(
  text: unknown,
  players: PlayerList,
  pool = new PlayerDrawPool(players),
): string {
  pool.setPlayers(players);
  return pool.replace(text);
}
