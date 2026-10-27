/* Atrapa Supabase (GoTrue + PostgREST) do testów synchronizacji: logowanie, select/eq/in, upsert (merge-duplicates), patch, RLS po właścicielu. */
const http = require('http');
module.exports = function mock(port) {
  const users = {}, tokens = {}, tables = { klaps_projects: new Map(), klaps_media: new Map() };
  const stats = { requests: 0, bigBodies: 0 };
  let n = 0;
  const issue = (u) => { const a = 'at' + (++n), r = 'rt' + n; tokens[a] = u.id; tokens[r] = u.id; return { access_token: a, refresh_token: r, expires_in: 3600, user: { id: u.id, email: u.email } }; };
  const srv = http.createServer((req, res) => {
    stats.requests++;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type, prefer');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      if (body.length > 900000) stats.bigBodies++;
      const send = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(obj == null ? '' : JSON.stringify(obj)); };
      if (req.headers.apikey !== 'anon-test') return send(401, { message: 'No API key' });
      const u = new URL(req.url, 'http://x');
      const data = body ? JSON.parse(body) : null;
      if (u.pathname === '/auth/v1/signup') { if (users[data.email]) return send(422, { msg: 'User already registered' }); const usr = users[data.email] = { id: 'u' + Object.keys(users).length, email: data.email, password: data.password }; return send(200, issue(usr)); }
      if (u.pathname === '/auth/v1/token') {
        if (u.searchParams.get('grant_type') === 'password') { const usr = users[data.email]; if (!usr || usr.password !== data.password) return send(400, { error_description: 'Invalid login credentials' }); return send(200, issue(usr)); }
        const uid = tokens[data.refresh_token]; if (!uid) return send(400, { error_description: 'Invalid refresh token' }); return send(200, issue(Object.values(users).find((x) => x.id === uid)));
      }
      const m = /^\/rest\/v1\/(\w+)$/.exec(u.pathname);
      if (!m || !tables[m[1]]) return send(404, { message: 'not found' });
      const uid = tokens[(req.headers.authorization || '').replace('Bearer ', '')];
      if (!uid) return send(401, { message: 'JWT expired' });
      const tb = tables[m[1]];
      let rows = [...tb.values()].filter((r) => r.owner === uid);
      const idf = u.searchParams.get('id');
      if (idf) { if (idf.startsWith('eq.')) rows = rows.filter((r) => r.id === idf.slice(3)); else if (idf.startsWith('in.(')) { const ids = idf.slice(4, -1).split(',').map(decodeURIComponent); rows = rows.filter((r) => ids.includes(r.id)); } }
      if (req.method === 'GET') {
        const sel = (u.searchParams.get('select') || '*').split(',');
        return send(200, rows.map((r) => (sel[0] === '*' ? r : Object.fromEntries(sel.map((k) => [k, r[k]])))));
      }
      if (req.method === 'POST') {
        for (const row of [].concat(data)) {
          const cur = tb.get(row.id);
          if (cur && cur.owner !== uid) return send(403, { message: 'row-level security' });
          tb.set(row.id, Object.assign(cur || { owner: uid, deleted: false, media_ids: [], plan: null, script: null }, row, { owner: uid }));
        }
        return send(201, null);
      }
      if (req.method === 'PATCH') { rows.forEach((r) => Object.assign(r, data)); return send(204, null); }
      send(405, null);
    });
  });
  return { listen: () => new Promise((r) => srv.listen(port, r)), close: () => srv.close(), tables, users, stats };
};
