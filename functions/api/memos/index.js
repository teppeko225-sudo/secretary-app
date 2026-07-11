// POST /api/memos … メモを追加
import { loadData, saveData, newId, json, readJson } from '../_lib.js';

export const onRequestPost = async ({ env, request }) => {
  const body = await readJson(request);
  const title = (body.title || '').toString().trim();
  const content = (body.content || '').toString().trim();
  if (!title && !content) {
    return json({ error: 'タイトルか本文を入力してください' }, 400);
  }
  const data = await loadData(env);
  const memo = { id: newId(), title, content, createdAt: new Date().toISOString() };
  data.memos.unshift(memo);
  await saveData(env, data);
  return json(memo, 201);
};
