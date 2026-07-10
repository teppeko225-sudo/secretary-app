// 自分専用の秘書アプリ - Node.js標準モジュールのみで動作
// 実行: node server.js   →  http://localhost:3000 をブラウザで開く

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const google = require('./google');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// ---------- データ読み書き ----------
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    return {
      memos: Array.isArray(data.memos) ? data.memos : [],
      tasks: Array.isArray(data.tasks) ? data.tasks : [],
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
    };
  } catch (e) {
    // ファイルが無い/壊れている場合は空データから開始
    return { memos: [], tasks: [], reviews: [] };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- リクエストボディの読み取り ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // 過大なボディを拒否
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// ---------- APIハンドラ ----------
async function handleApi(req, res, url) {
  const data = loadData();

  // メモ一覧・タスク一覧の取得
  if (req.method === 'GET' && url === '/api/data') {
    return sendJson(res, 200, data);
  }

  // メモ追加
  if (req.method === 'POST' && url === '/api/memos') {
    const body = await readBody(req);
    const title = (body.title || '').toString().trim();
    const content = (body.content || '').toString().trim();
    if (!title && !content) {
      return sendJson(res, 400, { error: 'タイトルか本文を入力してください' });
    }
    const memo = {
      id: newId(),
      title,
      content,
      createdAt: new Date().toISOString(),
    };
    data.memos.unshift(memo);
    saveData(data);
    return sendJson(res, 201, memo);
  }

  // メモ削除
  if (req.method === 'DELETE' && url.startsWith('/api/memos/')) {
    const id = decodeURIComponent(url.split('/').pop());
    const before = data.memos.length;
    data.memos = data.memos.filter((m) => m.id !== id);
    if (data.memos.length === before) {
      return sendJson(res, 404, { error: '見つかりません' });
    }
    saveData(data);
    return sendJson(res, 200, { ok: true });
  }

  // タスク追加
  if (req.method === 'POST' && url === '/api/tasks') {
    const body = await readBody(req);
    const text = (body.text || '').toString().trim();
    if (!text) {
      return sendJson(res, 400, { error: 'タスク内容を入力してください' });
    }
    const task = {
      id: newId(),
      text,
      done: false,
      createdAt: new Date().toISOString(),
    };
    data.tasks.unshift(task);
    saveData(data);
    return sendJson(res, 201, task);
  }

  // タスクの完了状態を切り替え
  if (req.method === 'PATCH' && url.startsWith('/api/tasks/')) {
    const id = decodeURIComponent(url.split('/').pop());
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return sendJson(res, 404, { error: '見つかりません' });
    const body = await readBody(req);
    task.done = typeof body.done === 'boolean' ? body.done : !task.done;
    saveData(data);
    return sendJson(res, 200, task);
  }

  // タスク削除
  if (req.method === 'DELETE' && url.startsWith('/api/tasks/')) {
    const id = decodeURIComponent(url.split('/').pop());
    const before = data.tasks.length;
    data.tasks = data.tasks.filter((t) => t.id !== id);
    if (data.tasks.length === before) {
      return sendJson(res, 404, { error: '見つかりません' });
    }
    saveData(data);
    return sendJson(res, 200, { ok: true });
  }

  // 週次の振り返りを登録/更新（1週につき1件・同じ週なら上書き）
  if (req.method === 'POST' && url === '/api/reviews') {
    const body = await readBody(req);
    const week = (body.week || '').toString().trim(); // 例: "2026-W28"
    const comment = (body.comment || '').toString().trim();
    if (!/^\d{4}-W\d{2}$/.test(week)) {
      return sendJson(res, 400, { error: '週の指定が正しくありません' });
    }
    if (!comment) {
      return sendJson(res, 400, { error: '振り返りコメントを入力してください' });
    }
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
    saveData(data);
    return sendJson(res, 201, review);
  }

  // 振り返り削除
  if (req.method === 'DELETE' && url.startsWith('/api/reviews/')) {
    const id = decodeURIComponent(url.split('/').pop());
    const before = data.reviews.length;
    data.reviews = data.reviews.filter((r) => r.id !== id);
    if (data.reviews.length === before) {
      return sendJson(res, 404, { error: '見つかりません' });
    }
    saveData(data);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: 'Not Found' });
}

// ---------- Googleカレンダー連携ハンドラ ----------
let oauthState = null; // CSRF対策の簡易state（単一ユーザー想定）

function redirectHome(res, status) {
  res.writeHead(302, { Location: '/?google=' + status });
  res.end();
}

async function handleGoogle(req, res, pathname, params) {
  // 連携状態の確認
  if (pathname === '/api/google/status') {
    return sendJson(res, 200, {
      hasCredentials: google.hasCredentials(),
      connected: google.isConnected(),
    });
  }

  // Googleの同意画面へリダイレクト
  if (pathname === '/auth/google') {
    if (!google.hasCredentials()) {
      return sendJson(res, 400, { error: 'credentials.json が見つかりません' });
    }
    oauthState = newId();
    res.writeHead(302, { Location: google.getAuthUrl(oauthState) });
    return res.end();
  }

  // 認可後のコールバック
  if (pathname === '/oauth2callback') {
    const err = params.get('error');
    const code = params.get('code');
    const state = params.get('state');
    if (err || !code || state !== oauthState) return redirectHome(res, 'error');
    try {
      await google.exchangeCode(code);
      return redirectHome(res, 'connected');
    } catch (e) {
      return redirectHome(res, 'error');
    }
  }

  // 連携解除
  if (pathname === '/api/google/disconnect' && req.method === 'POST') {
    google.clearToken();
    return sendJson(res, 200, { ok: true });
  }

  // 今後の予定を取得
  if (pathname === '/api/calendar/events') {
    if (!google.isConnected()) return sendJson(res, 200, { connected: false, events: [] });
    const events = await google.listUpcomingEvents(10);
    return sendJson(res, 200, { connected: true, events });
  }

  return sendJson(res, 404, { error: 'Not Found' });
}

// ---------- サーバー ----------
const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, 'http://localhost');
  const url = parsed.pathname;

  // Google連携関連ルート（クエリ文字列を使うため個別に処理）
  if (
    url === '/auth/google' ||
    url === '/oauth2callback' ||
    url.startsWith('/api/google') ||
    url === '/api/calendar/events'
  ) {
    try {
      await handleGoogle(req, res, url, parsed.searchParams);
    } catch (e) {
      sendJson(res, 500, { error: 'サーバーエラー: ' + e.message });
    }
    return;
  }

  if (url.startsWith('/api/')) {
    try {
      await handleApi(req, res, url);
    } catch (e) {
      sendJson(res, 500, { error: 'サーバーエラー: ' + e.message });
    }
    return;
  }

  // トップページ (index.html) を配信
  if (url === '/' || url === '/index.html') {
    const html = fs.readFileSync(path.join(__dirname, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`秘書アプリ起動中 → http://localhost:${PORT}`);
  console.log('終了するには Ctrl + C を押してください');
});
