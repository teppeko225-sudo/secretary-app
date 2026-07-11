// POST /api/reviews … 週次の振り返りを登録/更新（1週につき1件・同じ週なら上書き）
import { loadData, saveData, newId, json, readJson } from '../_lib.js';

export const onRequestPost = async ({ env, request }) => {
  const body = await readJson(request);
  const week = (body.week || '').toString().trim(); // 例: "2026-W28"
  const comment = (body.comment || '').toString().trim();
  if (!/^\d{4}-W\d{2}$/.test(week)) {
    return json({ error: '週の指定が正しくありません' }, 400);
  }
  if (!comment) {
    return json({ error: '振り返りコメントを入力してください' }, 400);
  }
  const data = await loadData(env);
  const now = new Date().toISOString();
  const existing = data.reviews.find((r) => r.week === week);
  let review;
  if (existing) {
    existing.comment = comment;
    existing.updatedAt = now;
    review = existing;
  } else {
    review = { id: newId(), week, comment, createdAt: now, updatedAt: now };
    data.reviews.push(review);
  }
  // 週の新しい順に並べる（"YYYY-Www" は文字列比較で正しく並ぶ）
  data.reviews.sort((a, b) => (a.week < b.week ? 1 : a.week > b.week ? -1 : 0));
  await saveData(env, data);
  return json(review, 201);
};
