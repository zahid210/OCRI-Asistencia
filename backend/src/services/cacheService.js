const store = new Map()

const DEFAULT_TTL = 30_000

export function cacheGet(key) {
  const hit = store.get(key)
  if (!hit) return undefined
  if (Date.now() > hit.expires) {
    store.delete(key)
    return undefined
  }
  return hit.data
}

export function cacheSet(key, data, ttlMs = DEFAULT_TTL) {
  store.set(key, { data, expires: Date.now() + ttlMs })
}

export function cacheInvalidate(prefix) {
  if (!prefix) {
    store.clear()
    return
  }
  const exact = '/api/' + prefix
  for (const key of store.keys()) {
    if (key === exact || key.startsWith(exact + '/')) store.delete(key)
  }
}

export function cacheMiddleware(ttlMs = DEFAULT_TTL) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next()

    const key = req.originalUrl
    const hit = cacheGet(key)
    if (hit !== undefined) {
      res.set('X-Cache', 'HIT')
      return res.json(hit)
    }

    const originalJson = res.json.bind(res)
    res.json = (body) => {
      res.json = originalJson
      res.set('X-Cache', 'MISS')
      cacheSet(key, body, ttlMs)
      return originalJson(body)
    }
    next()
  }
}
