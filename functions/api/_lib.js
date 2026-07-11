// Cloudflare Pages Functions 共通ヘルパー
// データは KV 名前空間（バインディング名: DB）の "data" キーに1件のJSONで保存する。
// _ で始まるファイルはルーティングされない（共有モジュール用）。

const KEY = 'data';

export async function loadData(env) {
  const d = (await env.DB.get(KEY, { type: 'json' })) || {};
  return {
    memos: Array.isArray(d.memos) ? d.memos : [],
    tasks: Array.isArray(d.tasks) ? d.tasks : [],
    reviews: Array.isArray(d.reviews) ? d.reviews : [],
  };
}

export async function saveData(env, data) {
  await env.DB.put(KEY, JSON.stringify(data));
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return {};
  }
}
