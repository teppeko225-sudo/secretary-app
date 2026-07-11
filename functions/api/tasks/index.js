// POST /api/tasks … タスクを追加
import { loadData, saveData, newId, json, readJson } from '../_lib.js';

export const onRequestPost = async ({ env, request }) => {
  const body = await readJson(request);
  const text = (body.text || '').toString().trim();
  if (!text) {
    return json({ error: 'タスク内容を入力してください' }, 400);
  }
  const data = await loadData(env);
  const task = { id: newId(), text, done: false, createdAt: new Date().toISOString() };
  data.tasks.unshift(task);
  await saveData(env, data);
  return json(task, 201);
};
