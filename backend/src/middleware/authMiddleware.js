import jwt from 'jsonwebtoken'
import { ejecutarConAuditor } from '../services/auditoriaService.js'

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET debe configurarse en producción.')
}

export const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'
export const JWT_COOKIE = 'ocri_token'

export function readCookie(req, name) {
  const cookies = req.headers.cookie || ''
  for (const part of cookies.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (key === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}

export function setAuthCookie(res, token) {
  res.cookie(JWT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/'
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(JWT_COOKIE, { path: '/' })
}

export function authRequired(req, res, next) {
  const header = req.headers.authorization ?? ''
  const token =
    readCookie(req, JWT_COOKIE) ||
    (header.startsWith('Bearer ') ? header.slice(7) : null)

  if (!token) {
    return res.status(401).json({ message: 'No autorizado.' })
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    return ejecutarConAuditor(
      {
        usuario: req.user.usuario,
        usuario_id: req.user.id,
        rol: req.user.rol,
        ip: req.ip,
        user_agent: req.headers['user-agent'] || null
      },
      () => next()
    )
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada.' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'ADMIN') {
    return res.status(403).json({ message: 'Acceso restringido a administradores.' })
  }
  next()
}
