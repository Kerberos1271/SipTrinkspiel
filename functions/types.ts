export interface Env {
  DB: D1Database;
  SESSION_SECRET?: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  sort_order?: number;
}

export interface CardRow {
  id: number;
  text: string;
  category_id: number;
  category_name?: string;
}
