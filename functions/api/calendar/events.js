// GET /api/calendar/events … クラウド版では未対応（空を返す）
import { json } from '../_lib.js';

export const onRequestGet = async () => {
  return json({ connected: false, events: [] });
};
