const LEGACY_PLAYER_PLACEHOLDER_REGEX = /\$\{player(\d*)\}/g;
const PLAYER_PLACEHOLDER_REGEX = /#player(\d*)|\$\{player(\d*)\}/g;

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

function shuffle<T>(values: T[]): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

/** Replaces all supported player placeholders with unique random players per card. */
export function replacePlayerPlaceholders(text: unknown, players: unknown[] | null | undefined): string {
  if (typeof text !== 'string') return '';

  const validPlayers = Array.isArray(players)
    ? players.filter((player): player is string => typeof player === 'string' && player.trim().length > 0).map((player) => player.trim())
    : [];
  if (!validPlayers.length) return text;

  let pool = shuffle([...validPlayers]);
  let poolIndex = 0;
  const nextPlayer = () => {
    if (poolIndex >= pool.length) {
      pool = shuffle([...validPlayers]);
      poolIndex = 0;
    }
    return pool[poolIndex++];
  };

  return text.replace(PLAYER_PLACEHOLDER_REGEX, nextPlayer);
}
