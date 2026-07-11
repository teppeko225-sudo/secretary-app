// GET /api/google/status … クラウド版ではGoogle連携は未対応（cloud:true を返す）
import { json } from '../_lib.js';

export const onRequestGet = async () => {
  return json({ hasCredentials: false, connected: false, cloud: true });
};
