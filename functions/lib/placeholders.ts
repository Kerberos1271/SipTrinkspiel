const LEGACY_PLAYER_PLACEHOLDER_REGEX = /\$\{player(\d*)\}/g;

/** Converts the legacy ${player...} syntax to the canonical #player... syntax. */
export function normalizePlaceholders(value: unknown): string {
  return typeof value === 'string'
    ? value.replace(LEGACY_PLAYER_PLACEHOLDER_REGEX, (_match, suffix: string) => `#player${suffix}`)
    : '';
}

/** Normalizes and trims card text before it is written to D1. */
export function sanitizeQuestion(value: unknown): string {
  return typeof value === 'string' ? normalizePlaceholders(value).trim() : '';
}
