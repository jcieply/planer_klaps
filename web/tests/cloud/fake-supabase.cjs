/* Sztuczny Supabase do testów: prawdziwy Postgres + schemat supabase/schema.sql, a przed nim cienka warstwa HTTP/WebSocket
   udająca Auth, PostgREST i Realtime w zakresie używanym przez Klaps. Dzięki temu testy przechodzą przez prawdziwe supabase-js
   i prawdziwe reguły RLS / funkcje SQL. Użycie: const s = await start(); s.url, s.anonKey; await s.stop(). */
const http = require('http');
const crypto = require('crypto');
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WebSocketServer } = require('ws');

const ANON = 'test-anon-key-' + 'x'.repeat(30);
const lit = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : "'" + String(typeof v === 'object' ? JSON.stringify(v) : v).replace(/'/g, "''") + "'");
const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const uuid = () => crypto.randomUUID();

async function startPostgres() {
  if (process.env.PGHOST) return { env: process.env, stop: async () => {} };
  const bin = fs.readdirSync('/usr/lib/postgresql').sort().map((v) => `/usr/lib/postgresql/${v}/bin`).pop();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-pg-'));
  const sock = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-sock-'));
  fs.chmodSync(dir, 0o777); fs.chmodSync(sock, 0o777);
  const asPg = process.getuid && process.getuid() === 0 ? (cmd, args) => ['runuser', ['-u', 'postgres', '--', cmd, ...args]] : (cmd, args) => [cmd, args];
  const run = (cmd, args) => { const [c, a] = asPg(cmd, args); const r = cp.spawnSync(c, a, { encoding: 'utf8' }); if (r.status !== 0) throw new Error(cmd + ': ' + r.stderr); };
  run(bin + '/initdb', ['-D', dir + '/data', '-U', 'postgres', '-A', 'trust']);
  run(bin + '/pg_ctl', ['-D', dir + '/data', '-o', `-k ${sock} -c listen_addresses=''`, '-l', dir + '/log', '-w', 'start']);
  return { env: { ...process.env, PGHOST: sock, PGUSER: 'postgres', PGDATABASE: 'postgres' }, stop: async () => { try { run(bin + '/pg_ctl', ['-D', dir + '/data', '-m', 'immediate', 'stop']); } catch (e) { /* brak */ } } };
}

async function start(opts = {}) {
  const pg = await startPostgres();
  const psql = (sql, input) => new Promise((resolve, reject) => {
    const p = cp.spawn('psql', ['-X', '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { env: pg.env });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve(out.trim()) : reject(new Error(err.replace(/^psql:<stdin>:\d+: /, '').replace(/^ERROR:\s+/, '').split('\n')[0] || 'sql error'))));
    p.stdin.end(sql);
  });
  const schemaDir = [path.resolve(__dirname, '../../supabase'), path.resolve(__dirname, '../../../supabase')].find((d) => fs.existsSync(path.join(d, 'schema.sql')));
  await psql(fs.readFileSync(path.join(schemaDir, 'tests/stub.sql'), 'utf8'));
  await psql(fs.readFileSync(path.join(schemaDir, 'schema.sql'), 'utf8'));
  // jako zalogowany użytkownik (RLS działa jak w Supabase)
  const asUser = (uid, body) => psql(`begin; select set_config('request.jwt.claim.sub', ${lit(uid)}, true); set local role authenticated;\n${body};\ncommit;`);

  const users = new Map(); // email → {id, password, meta}
  const byId = new Map();
  const tokens = new Map(); // access → uid
  const refresh = new Map();
  const confirmRequired = !!opts.confirmEmail;
  const session = (u) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const access = b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u({ sub: u.id, role: 'authenticated', aud: 'authenticated', exp, email: u.email }) + '.' + crypto.randomBytes(12).toString('base64url');
    const ref = crypto.randomBytes(12).toString('hex');
    tokens.set(access, u.id); refresh.set(ref, u.id);
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: ref, user: userJson(u) };
  };
  const userJson = (u) => ({ id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: u.meta || {}, created_at: new Date().toISOString() });
  const uidOf = (req) => tokens.get(String(req.headers.authorization || '').replace(/^Bearer /, '')) || null;

  /* ---------- Realtime (protokół Phoenix v2) ---------- */
  const subs = []; // {ws, topic, uid, changes:[{id,event,table,filter}]}
  const presence = new Map(); // topic → Map(key → metas[])
  const send = (ws, joinRef, ref, topic, event, payload) => { if (ws.readyState === 1) ws.send(JSON.stringify([joinRef, ref, topic, event, payload])); };
  async function visible(uid, table, projectId) {
    try { return (await asUser(uid, `select public.klaps_is_member(${lit(projectId)})`)).split('\n').pop().trim() === 't'; } catch { return false; }
  }
  async function emit(type, table, record) {
    for (const s of subs) for (const c of s.changes) {
      if (c.table !== table || (c.event !== '*' && c.event !== type)) continue;
      const m = /^project_id=eq\.(.+)$/.exec(c.filter || '');
      if (m && record.project_id !== m[1]) continue;
      if (!(await visible(s.uid, table, record.project_id))) continue;
      send(s.ws, null, null, s.topic, 'postgres_changes', { ids: [c.id], data: { schema: 'public', table, commit_timestamp: new Date().toISOString(), type, record, columns: [], errors: null } });
    }
  }
  const pushPresence = (topic) => {
    const st = {}; for (const [k, metas] of presence.get(topic) || []) st[k] = { metas };
    for (const s of subs) if (s.topic === topic) send(s.ws, null, null, topic, 'presence_state', st);
  };

  let down = false;
  const server = http.createServer(async (req, res) => {
    if (down) { req.socket.destroy(); return; }
    const url = new URL(req.url, 'http://x');
    const body = await new Promise((r) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => r(b ? JSON.parse(b) : {})); });
    const json = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(o === undefined ? '' : JSON.stringify(o)); };
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*', 'Access-Control-Allow-Methods': '*' }); return res.end(); }
    try {
      const p = url.pathname;
      if (p === '/auth/v1/signup') {
        if (users.has(body.email)) return json(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
        const u = { id: uuid(), email: body.email, password: body.password, meta: body.data || {} };
        if (String(body.password || '').length < 8) return json(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 8 characters.' });
        users.set(u.email, u); byId.set(u.id, u);
        await psql(`insert into auth.users(id, email) values (${lit(u.id)}, ${lit(u.email)})`);
        return confirmRequired ? json(200, userJson(u)) : json(200, session(u));
      }
      if (p === '/auth/v1/token') {
        const g = url.searchParams.get('grant_type');
        if (g === 'password') {
          const u = users.get(body.email);
          if (!u || u.password !== body.password) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          if (confirmRequired && !u.confirmed) return json(400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
          return json(200, session(u));
        }
        if (g === 'refresh_token') { const id = refresh.get(body.refresh_token); return id ? json(200, session(byId.get(id))) : json(400, { code: 400, msg: 'Invalid Refresh Token' }); }
      }
      if (p === '/auth/v1/user') { const id = uidOf(req); return id ? json(200, userJson(byId.get(id))) : json(401, { code: 401, msg: 'invalid JWT' }); }
      if (p === '/auth/v1/logout') return json(204);
      if (p === '/auth/v1/recover') return json(200, {});
      if (p === '/__confirm') { const u = users.get(url.searchParams.get('email')); if (u) u.confirmed = true; return json(200, { ok: true }); }
      const uid = uidOf(req);
      if (p.startsWith('/rest/v1/rpc/')) {
        if (!uid) return json(401, { message: 'JWT required' });
        const fn = p.slice('/rest/v1/rpc/'.length);
        if (!/^klaps_[a-z_]+$/.test(fn)) return json(404, { message: 'no function' });
        const args = Object.entries(body).map(([k, v]) => `${k.replace(/[^a-z_]/g, '')} => ${lit(v)}`).join(', ');
        const setof = fn === 'klaps_redeem_invite';
        const out = await asUser(uid, setof ? `select coalesce(jsonb_agg(t), '[]'::jsonb) from public.${fn}(${args}) t` : `select to_jsonb(public.${fn}(${args}))`);
        const last = out.split('\n').filter((l) => l && l !== 'BEGIN' && l !== 'COMMIT' && l !== 'SET').pop();
        let val = null; try { val = last === undefined || last === '' ? null : JSON.parse(last); } catch { val = last; }
        const row = setof ? val : val;
        if (row && row.startsWith) { /* nie dotyczy */ }
        for (const f of ['klaps_push_ops']) if (fn === f && typeof val === 'number') {
          const r = await psql(`select row_to_json(o) from public.klaps_ops o where project_id = ${lit(body.p_project)} and seq = ${val}`);
          if (r) await emit('INSERT', 'klaps_ops', JSON.parse(r));
        }
        if (['klaps_set_role', 'klaps_remove_member', 'klaps_transfer_owner', 'klaps_redeem_invite'].includes(fn)) {
          const pid = body.p_project || (Array.isArray(val) && val[0] && val[0].project_id);
          if (pid) await emit('UPDATE', 'klaps_members', { project_id: pid });
        }
        return json(200, val);
      }
      if (p.startsWith('/rest/v1/')) {
        if (!uid) return json(401, { message: 'JWT required' });
        const table = p.slice('/rest/v1/'.length);
        if (!/^klaps_[a-z_]+$/.test(table)) return json(404, { message: 'no table' });
        const cols = (url.searchParams.get('select') || '*').split(',').map((c) => c.trim()).filter((c) => /^(\*|[a-z_]+)$/.test(c));
        const where = [];
        for (const [k, v] of url.searchParams) {
          if (['select', 'order', 'limit'].includes(k)) continue;
          if (!/^[a-z_]+$/.test(k)) continue;
          const m = /^(eq|gt|lt|in)\.(.*)$/.exec(v); if (!m) continue;
          if (m[1] === 'in') where.push(`${k} in (${m[2].replace(/^\(|\)$/g, '').split(',').map((x) => lit(x.replace(/^"|"$/g, ''))).join(',')})`);
          else where.push(`${k} ${{ eq: '=', gt: '>', lt: '<' }[m[1]]} ${lit(m[2])}`);
        }
        const order = (url.searchParams.get('order') || '').split(',').filter(Boolean).map((o) => { const [c, d] = o.split('.'); return /^[a-z_]+$/.test(c) ? c + (d === 'desc' ? ' desc' : ' asc') : ''; }).filter(Boolean).join(', ');
        const lim = parseInt(url.searchParams.get('limit') || '0', 10);
        const sql = `select coalesce(jsonb_agg(t), '[]'::jsonb) from (select ${cols.join(',') || '*'} from public.${table}${where.length ? ' where ' + where.join(' and ') : ''}${order ? ' order by ' + order : ''}${lim ? ' limit ' + lim : ''}) t`;
        const out = await asUser(uid, sql);
        const last = out.split('\n').filter((l) => l && !['BEGIN', 'COMMIT', 'SET'].includes(l)).pop();
        return json(200, JSON.parse(last));
      }
      json(404, { message: 'not found' });
    } catch (e) {
      const msg = String(e.message || e);
      json(/permission denied/.test(msg) ? 403 : 400, { code: /permission denied/.test(msg) ? '42501' : 'P0001', message: msg, details: null, hint: null });
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, sock, head) => { if (down) { sock.destroy(); return; } if (req.url.startsWith('/realtime/v1/websocket')) wss.handleUpgrade(req, sock, head, (ws) => wss.emit('connection', ws, req)); else sock.destroy(); });
  wss.on('connection', (ws) => {
    ws.on('close', () => {
      for (let i = subs.length - 1; i >= 0; i--) if (subs[i].ws === ws) {
        const s = subs[i]; subs.splice(i, 1);
        const pr = presence.get(s.topic); if (pr && s.presenceKey) { pr.delete(s.presenceKey); pushPresence(s.topic); }
      }
    });
    ws.on('message', (raw, isBinary) => {
      if (isBinary) return;
      let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
      const [joinRef, ref, topic, event, payload] = msg;
      if (topic === 'phoenix') return send(ws, null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} });
      if (event === 'phx_join') {
        const cfg = (payload && payload.config) || {};
        const uid = tokens.get(payload && payload.access_token) || null;
        const changes = (cfg.postgres_changes || []).map((c, i) => ({ id: Math.floor(Math.random() * 1e9) + i, event: c.event, schema: c.schema, table: c.table, filter: c.filter }));
        const key = cfg.presence && cfg.presence.key;
        subs.push({ ws, topic, uid, changes, presenceKey: key });
        send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: changes.map((c) => ({ id: c.id, event: c.event, schema: c.schema, table: c.table, ...(c.filter ? { filter: c.filter } : {}) })) } });
        if (changes.length) send(ws, joinRef, null, topic, 'system', { status: 'ok', message: 'Subscribed to PostgreSQL', channel: topic.replace(/^realtime:/, ''), extension: 'postgres_changes' });
        if (key) { if (!presence.has(topic)) presence.set(topic, new Map()); pushPresence(topic); }
        return;
      }
      if (event === 'presence' && payload && payload.event === 'track') {
        const s = subs.find((x) => x.ws === ws && x.topic === topic);
        if (s && s.presenceKey) { if (!presence.has(topic)) presence.set(topic, new Map()); presence.get(topic).set(s.presenceKey, [{ phx_ref: uuid(), ...payload.payload }]); }
        send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
        return pushPresence(topic);
      }
      if (event === 'phx_leave') {
        const i = subs.findIndex((x) => x.ws === ws && x.topic === topic);
        if (i >= 0) { const s = subs[i]; subs.splice(i, 1); const pr = presence.get(topic); if (pr && s.presenceKey) { pr.delete(s.presenceKey); pushPresence(topic); } }
        return send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
      }
      send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
    });
  });

  await new Promise((r) => server.listen(opts.port || 0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  return {
    url, anonKey: ANON, sql: psql,
    /** symulacja awarii sieci: zrywa połączenia i odrzuca żądania, dopóki nie wywołasz setDown(false) */
    setDown: (b) => { down = !!b; if (down) for (const c of wss.clients) c.terminate(); },
    /** wyłącza internet dla wszystkich (symulacja awarii): zrywa połączenia i odrzuca żądania */
    stop: async () => { for (const c of wss.clients) c.terminate(); await new Promise((r) => server.close(r)); await pg.stop(); },
  };
}
module.exports = { start, ANON };
if (require.main === module) start({ port: +process.env.PORT || 54321 }).then((s) => console.log('fake supabase:', s.url));
