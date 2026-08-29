export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, {
    headers: { 'Cache-Control': 'no-store', ...(init?.headers || {}) },
    ...init,
  });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}
