const loginAttempts = new Map()
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const LOGIN_MAX_ATTEMPTS = 20

const buckets = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of loginAttempts) {
    if (now > entry.resetAt) loginAttempts.delete(key)
  }
  for (const [key, entry] of buckets) {
    if (now > entry.resetAt) buckets.delete(key)
  }
}, LOGIN_WINDOW_MS).unref()

export function loginRateLimit(req, res, next) {
  const key = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = loginAttempts.get(key)

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return next()
  }

  entry.count += 1
  if (entry.count > LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ message: 'Demasiados intentos. Intente más tarde.' })
  }
  next()
}

export function apiRateLimit({ windowMs = 15 * 60 * 1000, max = 30, keyPrefix = 'rl' } = {}) {
  return function rateLimit(req, res, next) {
    const key = `${keyPrefix}:${req.ip ?? 'unknown'}`
    const now = Date.now()
    const entry = buckets.get(key)

    if (!entry || now > entry.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    entry.count += 1
    if (entry.count > max) {
      return res.status(429).json({ message: 'Demasiadas solicitudes. Intente más tarde.' })
    }
    next()
  }
}
