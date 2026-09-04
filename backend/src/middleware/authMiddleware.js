import jwt from 'jsonwebtoken'
import { ejecutarConAuditor } from '../services/auditoriaService.js'

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET debe configurarse en producción.')
}

export const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'

export function authRequired(req, res, next) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null

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
