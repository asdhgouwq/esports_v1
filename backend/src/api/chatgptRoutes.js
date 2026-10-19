const express = require('express');
const crypto = require('node:crypto');
const { ChatGptAuthError } = require('../services/chatgptAuth');

function createChatGptRouter(auth, { frontendOrigin = 'http://127.0.0.1:5173' } = {}) {
  const router = express.Router();
  const expected = new URL(frontendOrigin);
  if (expected.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(expected.hostname)) throw new Error('ChatGPT login is local-only');
  const origins = new Set([expected.origin, `${expected.protocol}//${expected.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1'}:${expected.port}`]);
  const launches = new Map();
  function guard(req, res, next) {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const allowedHost = [`127.0.0.1:${req.socket.localPort}`, `localhost:${req.socket.localPort}`].includes(req.headers.host);
    const origin = req.headers.origin;
    if (!local || !allowedHost || (origin && !origins.has(origin)) || (req.method === 'POST' && (!origin || !req.is('application/json')))) {
      return res.status(403).json({ error: '이 기기의 dol.gg 화면에서 연결을 시작해 주세요.' });
    }
    next();
  }
  router.use('/api/chatgpt', guard);
  const handle = (action) => async (req, res) => {
    try { res.json(await action(req)); }
    catch (error) {
      const known = error instanceof ChatGptAuthError;
      console.error('[ChatGPT connection]', known ? error.code : 'UNEXPECTED_ERROR');
      res.status(known ? error.status : 500).json({ code: known ? error.code : 'AUTH_ERROR', error: known ? error.message : 'ChatGPT 연결을 확인하지 못했습니다. 다시 시도해 주세요.' });
    }
  };
  router.get('/api/chatgpt/status', handle(() => auth.status()));
  router.get('/api/chatgpt/models', handle(async () => ({ models: await auth.listModels(), ...(await auth.status()) })));
  router.post('/api/chatgpt/sign-in', handle(async (req) => {
    for (const [ticket, launch] of launches) if (launch.expiresAt <= Date.now()) launches.delete(ticket);
    const result = await auth.beginSignIn({ profileId: req.body?.profileId, newAccount: req.body?.newAccount === true });
    const ticket = crypto.randomBytes(32).toString('base64url');
    launches.set(ticket, { url: result.authorizationUrl, expiresAt: Date.now() + result.expiresIn * 1000 });
    // Keep returning-account id_token_hint out of application JavaScript.
    return { authorizationUrl: `http://${req.headers.host}/auth/chatgpt/start?request=${ticket}`, expiresIn: result.expiresIn };
  }));
  router.get('/auth/chatgpt/start', guard, (req, res) => {
    const ticket = typeof req.query.request === 'string' ? req.query.request : '';
    const launch = launches.get(ticket);
    launches.delete(ticket);
    if (!launch || launch.expiresAt <= Date.now()) return res.status(400).type('text').send('로그인 요청이 만료되었습니다. dol.gg에서 다시 시작해 주세요.');
    res.redirect(302, launch.url);
  });
  router.post('/api/chatgpt/account', handle((req) => auth.selectAccount(req.body?.id)));
  router.post('/api/chatgpt/model', handle((req) => auth.selectModel(req.body?.slug)));
  router.post('/api/chatgpt/welcome', handle(() => auth.acknowledgeWelcome()));
  router.post('/api/chatgpt/disconnect', handle(() => { launches.clear(); return auth.disconnect(); }));
  const escape = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  router.get('/auth/callback', guard, async (req, res) => {
    let title, message, status = 200;
    try {
      const result = await auth.completeSignIn(req.query);
      title = 'ChatGPT 로그인 완료';
      message = result.planEnabled ? 'ChatGPT 구독 사용이 연결되었습니다. dol.gg 화면으로 돌아가 주세요.' : '로그인은 완료했지만 구독 사용 권한이 연결되지 않았습니다. dol.gg에서 구독 사용 연결을 다시 진행해 주세요.';
    } catch (error) {
      const known = error instanceof ChatGptAuthError;
      console.error('[ChatGPT callback]', known ? error.code : 'UNEXPECTED_ERROR');
      status = known ? error.status : 500;
      title = '로그인을 완료하지 못했습니다';
      message = known ? error.message : 'dol.gg 화면에서 로그인을 다시 시작해 주세요.';
    }
    res.status(status).set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")
      .type('html').send(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>dol.gg · ChatGPT 연결</title><style>body{background:#161d1c;color:#dfe9d6;font:16px/1.8 system-ui;max-width:600px;margin:14vh auto;padding:24px}h1{font-size:26px}p{color:#aebfac}a{display:inline-block;color:#192015;background:#d4e88c;padding:10px 20px;text-decoration:none;border-radius:4px;margin-top:20px}</style><h1>${escape(title)}</h1><p>${escape(message)}</p><a href="${expected.origin}/">dol.gg로 돌아가기</a></html>`);
  });
  return router;
}

module.exports = { createChatGptRouter };
