// DELETE /api/reviews/:id … 振り返りを削除
import { loadData, saveData, json } from '../_lib.js';

export const onRequestDelete = async ({ env, params }) => {
  const id = params.id;
  const data = await loadData(env);
  const before = data.reviews.length;
  data.reviews = data.reviews.filter((r) => r.id !== id);
  if (data.reviews.length === before) {
    return json({ error: '見つかりません' }, 404);
  }
  await saveData(env, data);
  return json({ ok: true });
};
