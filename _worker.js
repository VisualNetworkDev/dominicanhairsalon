const PUBLIC_API = 'https://script.google.com/macros/s/AKfycbzunUZqlntWZWulmE3ORRnrJszzaIWv4nfZX0-ZnXdZx2V7N_gCpSUwn7lXIZXH5t0K/exec';

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/public-data') {
      return cachedAppsScriptRead(request, context, 'getAppData', [], 30);
    }
    if (request.method === 'GET' && url.pathname === '/api/booking-availability') {
      const payload = {
        serviceId: url.searchParams.get('serviceId') || '',
        category: url.searchParams.get('category') || '',
        service: url.searchParams.get('service') || '',
        date: url.searchParams.get('date') || '',
        language: url.searchParams.get('language') || 'es',
        preferredWorker: url.searchParams.get('preferredWorker') || '',
        catalogVersion: url.searchParams.get('catalogVersion') || ''
      };
      return cachedAppsScriptRead(request, context, 'getBookingAvailability', [payload], 60);
    }
    if (request.method === 'GET' && url.pathname === '/api/availability-matrix') {
      const startDate = url.searchParams.get('startDate') || '';
      const requestedDays = Math.max(1, Math.min(31, Number(url.searchParams.get('days') || 21)));
      return cachedAppsScriptRead(request, context, 'getAvailabilityMatrix', [startDate, requestedDays], 120);
    }
    return env.ASSETS.fetch(request);
  }
};

async function cachedAppsScriptRead(request, context, functionName, args, ttlSeconds) {
  const cache = caches.default;
  const cacheUrl = new URL(request.url);
  const forceFresh = cacheUrl.searchParams.has('fresh');
  cacheUrl.searchParams.delete('fresh');
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached && !forceFresh) {
    const cachedAt = Number(cached.headers.get('x-reset-cached-at') || 0);
    const ageMs = cachedAt ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
    if (ageMs <= ttlSeconds * 1000) {
      return withRuntimeHeaders(cached, 'HIT');
    }
  }

  const response = await fetchAppsScriptResponse(functionName, args, ttlSeconds);
  if (response.ok) context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

async function fetchAppsScriptResponse(functionName, args, ttlSeconds) {
  const upstreamUrl = new URL(PUBLIC_API);
  upstreamUrl.searchParams.set('fn', functionName);
  upstreamUrl.searchParams.set('args', JSON.stringify(args));
  upstreamUrl.searchParams.set('requestId', crypto.randomUUID());
  const startedAt = Date.now();
  const abortController = new AbortController();
  const timeoutMs = functionName === 'getAppData' ? 45000 : 30000;
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);
  let upstream;
  let body;
  try {
    upstream = await fetch(upstreamUrl.toString(), {
      redirect: 'follow',
      signal: abortController.signal,
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    body = await upstream.text();
  } catch (error) {
    const elapsed = Date.now() - startedAt;
    return new Response(JSON.stringify({
      ok: false,
      error: error && error.name === 'AbortError'
        ? (functionName === 'getAppData'
          ? 'La información del salón tardó más de lo normal. Intenta nuevamente.'
          : 'La consulta de horarios tardó más de lo normal. Intenta nuevamente.')
        : (functionName === 'getAppData'
          ? 'No se pudo cargar la información del salón en este momento.'
          : 'No se pudo consultar la disponibilidad en este momento.')
    }), {
      status: 504,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-reset-cache': 'MISS',
        'x-reset-upstream-ms': String(elapsed),
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer'
      }
    });
  } finally {
    clearTimeout(timeout);
  }
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=0, s-maxage=86400, stale-while-revalidate=86400',
    'x-reset-cache': 'MISS',
    'x-reset-cached-at': String(Date.now()),
    'x-reset-upstream-ms': String(Date.now() - startedAt),
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  });
  const response = new Response(body, { status: upstream.ok ? 200 : 502, headers });
  return response;
}

function withRuntimeHeaders(response, cacheStatus) {
  const headers = new Headers(response.headers);
  headers.set('x-reset-cache', cacheStatus);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: response.status, headers });
}
