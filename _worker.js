const DEFAULT_CORE_API = 'https://reset-salon-api.2808joel.workers.dev';
const DEFAULT_BUSINESS_ID = 'reset-yaleixi';

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const coreApi = String(env.CORE_API_URL || DEFAULT_CORE_API).replace(/\/$/, '');
    const businessId = String(env.BUSINESS_ID || DEFAULT_BUSINESS_ID).trim() || DEFAULT_BUSINESS_ID;

    if (request.method === 'GET' && url.pathname === '/api/public-data') {
      return cachedCoreRead(request, context, coreApi, businessId, '/v1/public/app-data', 30, 8000);
    }
    if (request.method === 'GET' && url.pathname === '/api/booking-availability') {
      const parameters = new URLSearchParams(url.searchParams);
      parameters.delete('fresh');
      return cachedCoreRead(request, context, coreApi, businessId, `/v1/public/booking-availability?${parameters.toString()}`, 20, 6000);
    }
    if (request.method === 'GET' && url.pathname === '/api/availability-matrix') {
      const parameters = new URLSearchParams(url.searchParams);
      parameters.delete('fresh');
      parameters.set('days', String(Math.max(1, Math.min(21, Number(parameters.get('days') || 14)))));
      return cachedCoreRead(request, context, coreApi, businessId, `/v1/public/availability-matrix?${parameters.toString()}`, 60, 10000);
    }
    if (request.method === 'POST' && url.pathname === '/api/compat') {
      return proxyCompatMutation(request, coreApi, businessId);
    }
    return env.ASSETS.fetch(request);
  },
};

async function cachedCoreRead(request, context, coreApi, businessId, upstreamPath, ttlSeconds, timeoutMs) {
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  const forceFresh = cacheUrl.searchParams.has('fresh');
  cacheUrl.searchParams.delete('fresh');
  cacheUrl.searchParams.set('__business', businessId);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached && !forceFresh) {
    const cachedAt = Number(cached.headers.get('x-reset-cached-at') || 0);
    if (cachedAt && Date.now() - cachedAt <= ttlSeconds * 1000) return withRuntimeHeaders(cached, 'HIT', businessId);
  }

  const response = await fetchCoreJson(coreApi, upstreamPath, businessId, ttlSeconds, timeoutMs);
  if (response.ok) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function fetchCoreJson(coreApi, upstreamPath, businessId, ttlSeconds, timeoutMs) {
  const startedAt = Date.now();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  try {
    const upstream = await fetch(`${coreApi}${upstreamPath}`, {
      method: 'GET',
      headers: { accept: 'application/json', 'x-reset-business': businessId },
      signal: abortController.signal,
      cf: { cacheTtl: 0, cacheEverything: false },
    });
    const body = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return errorResponse(upstream.status, body && body.error ? body.error : 'No se pudo consultar la información actualizada.', businessId, Date.now() - startedAt);
    }
    return new Response(JSON.stringify({ ok: true, data: body }), {
      status: 200,
      headers: responseHeaders(businessId, 'MISS', Date.now() - startedAt, ttlSeconds),
    });
  } catch (error) {
    return errorResponse(
      504,
      error && error.name === 'AbortError'
        ? 'La consulta tardó más de lo esperado. Intenta nuevamente.'
        : 'No se pudo consultar la disponibilidad en este momento.',
      businessId,
      Date.now() - startedAt,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function proxyCompatMutation(request, coreApi, businessId) {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 18 * 1024 * 1024) return errorResponse(413, 'La solicitud supera el tamaño permitido.', businessId, 0);
  const startedAt = Date.now();
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 45000);
  try {
    const upstream = await fetch(`${coreApi}/compat`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        accept: 'application/json',
        'x-reset-business': businessId,
      },
      body: await request.text(),
      signal: abortController.signal,
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-reset-backend': 'cloudflare-d1',
        'x-reset-business': businessId,
        'x-reset-upstream-ms': String(Date.now() - startedAt),
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
      },
    });
  } catch (error) {
    return errorResponse(
      504,
      error && error.name === 'AbortError'
        ? 'La operación tardó más de lo esperado. Intenta nuevamente.'
        : 'No se pudo completar la operación en este momento.',
      businessId,
      Date.now() - startedAt,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function responseHeaders(businessId, cacheStatus, upstreamMs, ttlSeconds) {
  return {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': `public, max-age=0, s-maxage=${ttlSeconds}, stale-while-revalidate=${Math.max(60, ttlSeconds * 4)}`,
    'x-reset-cache': cacheStatus,
    'x-reset-cached-at': String(Date.now()),
    'x-reset-backend': 'cloudflare-d1',
    'x-reset-business': businessId,
    'x-reset-upstream-ms': String(upstreamMs),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
}

function errorResponse(status, error, businessId, upstreamMs) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { ...responseHeaders(businessId, 'MISS', upstreamMs, 0), 'cache-control': 'no-store' },
  });
}

function withRuntimeHeaders(response, cacheStatus, businessId) {
  const headers = new Headers(response.headers);
  headers.set('x-reset-cache', cacheStatus);
  headers.set('x-reset-backend', 'cloudflare-d1');
  headers.set('x-reset-business', businessId);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: response.status, headers });
}
