// DELETE /api/memos/:id … メモを削除
import { loadData, saveData, json } from '../_lib.js';

export const onRequestDelete = async ({ env, params }) => {
  const id = params.id;
  const data = await loadData(env);
  const before = data.memos.length;
  data.memos = data.memos.filter((m) => m.id !== id);
  if (data.memos.length === before) {
    return json({ error: '見つかりません' }, 404);
  }
  await saveData(env, data);
  return json({ ok: true });
};
