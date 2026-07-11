// PATCH /api/tasks/:id … 完了状態を切り替え / DELETE … 削除
import { loadData, saveData, json, readJson } from '../_lib.js';

export const onRequestPatch = async ({ env, request, params }) => {
  const id = params.id;
  const data = await loadData(env);
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return json({ error: '見つかりません' }, 404);
  const body = await readJson(request);
  task.done = typeof body.done === 'boolean' ? body.done : !task.done;
  await saveData(env, data);
  return json(task);
};

export const onRequestDelete = async ({ env, params }) => {
  const id = params.id;
  const data = await loadData(env);
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  if (data.tasks.length === before) {
    return json({ error: '見つかりません' }, 404);
  }
  await saveData(env, data);
  return json({ ok: true });
};
