// GET /api/data … メモ・タスク・振り返りをまとめて返す
import { loadData, json } from './_lib.js';

export const onRequestGet = async ({ env }) => {
  return json(await loadData(env));
};
