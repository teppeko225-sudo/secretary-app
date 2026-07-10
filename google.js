// Googleカレンダー連携モジュール（外部ライブラリ不要・Node標準httpsのみ）
// OAuth2 で認可 → primaryカレンダーの今後の予定を読み取り専用で取得する

const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL, URLSearchParams } = require('url');

const CRED_FILE = path.join(__dirname, 'credentials.json'); // Google Cloudからダウンロードした認証情報
const TOKEN_FILE = path.join(__dirname, 'token.json');       // 取得したトークンの保存先
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

// ---------- 認証情報 / トークンの読み書き ----------
function loadCredentials() {
  const raw = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
  const c = raw.web || raw.installed || raw; // Googleの形式(web/installed)どちらにも対応
  if (!c.client_id || !c.client_secret) throw new Error('credentials.json の形式が正しくありません');
  return { clientId: c.client_id, clientSecret: c.client_secret };
}

function hasCredentials() {
  try { loadCredentials(); return true; } catch (e) { return false; }
}

function loadToken() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch (e) { return null; }
}
function saveToken(t) { fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), 'utf8'); }
function clearToken() { try { fs.unlinkSync(TOKEN_FILE); } catch (e) {} }

function isConnected() {
  const t = loadToken();
  return !!(t && t.refresh_token);
}

// ---------- OAuth2 ----------
function getAuthUrl(state) {
  const { clientId } = loadCredentials();
  const p = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline', // refresh_token を得る
    prompt: 'consent',
    state,
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
}

// フォーム形式でトークンエンドポイントにPOST
function postForm(host, pathName, form) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(form).toString();
    const req = https.request(
      {
        host,
        path: pathName,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            if (res.statusCode >= 400) reject(new Error(j.error_description || j.error || d));
            else resolve(j);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 認可コード → トークン交換
async function exchangeCode(code) {
  const { clientId, clientSecret } = loadCredentials();
  const t = await postForm('oauth2.googleapis.com', '/token', {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const token = {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expiry: Date.now() + t.expires_in * 1000,
  };
  saveToken(token);
  return token;
}

// 有効なアクセストークンを返す（期限切れなら自動更新）
async function getAccessToken() {
  const t = loadToken();
  if (!t) throw new Error('Googleと連携していません');
  if (t.access_token && t.expiry && Date.now() < t.expiry - 60000) return t.access_token;

  const { clientId, clientSecret } = loadCredentials();
  const r = await postForm('oauth2.googleapis.com', '/token', {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: t.refresh_token,
    grant_type: 'refresh_token',
  });
  t.access_token = r.access_token;
  t.expiry = Date.now() + r.expires_in * 1000;
  if (r.refresh_token) t.refresh_token = r.refresh_token;
  saveToken(t);
  return t.access_token;
}

// ---------- カレンダー取得 ----------
function httpsGetJson(urlStr, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      { host: u.host, path: u.pathname + u.search, method: 'GET', headers: { Authorization: 'Bearer ' + token } },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            const j = JSON.parse(d);
            if (res.statusCode >= 400) reject(new Error((j.error && j.error.message) || d));
            else resolve(j);
          } catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// 今後の予定を取得
async function listUpcomingEvents(max = 10) {
  const token = await getAccessToken();
  const p = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: String(max),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const data = await httpsGetJson(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?' + p.toString(),
    token
  );
  return (data.items || []).map((ev) => ({
    id: ev.id,
    summary: ev.summary || '(タイトルなし)',
    start: ev.start && (ev.start.dateTime || ev.start.date),
    end: ev.end && (ev.end.dateTime || ev.end.date),
    allDay: !!(ev.start && ev.start.date && !ev.start.dateTime),
    location: ev.location || '',
    htmlLink: ev.htmlLink || '',
  }));
}

module.exports = {
  hasCredentials,
  isConnected,
  getAuthUrl,
  exchangeCode,
  listUpcomingEvents,
  clearToken,
};
