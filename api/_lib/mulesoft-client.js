const { warn } = require('./logger');

function hasMuleSoftConfig() {
  return !!(process.env.MULESOFT_BASE_URL && process.env.MULESOFT_CLIENT_ID && process.env.MULESOFT_CLIENT_SECRET);
}

function isPlaceholderBaseUrl(baseUrl) {
  const normalized = String(baseUrl || '').trim().toLowerCase();
  return !normalized || normalized.includes('your-org.anypoint.mulesoft.com');
}

async function callMuleSoft(path, { method = 'GET', body, query } = {}) {
  const baseUrl = String(process.env.MULESOFT_BASE_URL || '').trim();
  const clientId = String(process.env.MULESOFT_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.MULESOFT_CLIENT_SECRET || '').trim();

  if (!baseUrl || !clientId || !clientSecret || isPlaceholderBaseUrl(baseUrl)) {
    return {
      ok: false,
      mocked: true,
      status: 503,
      error: 'MuleSoft not configured'
    };
  }

  const url = new URL(path.replace(/^\/+/, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  const qp = query || {};
  for (const [k, v] of Object.entries(qp)) {
    if (v === undefined || v === null || v === '') continue;
    url.searchParams.set(k, String(v));
  }

  try {
    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': clientId,
        'x-client-secret': clientSecret
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      warn('MuleSoft call failed', { path, status: resp.status, data });
    }

    return {
      ok: resp.ok,
      status: resp.status,
      data,
      mocked: false
    };
  } catch (error) {
    warn('MuleSoft network failure, falling back to mock mode', {
      path,
      message: error?.message || 'fetch failed'
    });
    return {
      ok: false,
      mocked: true,
      status: 503,
      error: error?.message || 'fetch failed'
    };
  }
}

module.exports = {
  hasMuleSoftConfig,
  callMuleSoft
};
