import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Usuario, Trabajador } from '../db.js'
import { JWT_SECRET, setAuthCookie, clearAuthCookie } from '../middleware/authMiddleware.js'
import { registrarAuditoria } from '../services/auditoriaService.js'

const MAX_INTENTOS = 5
const BLOQUEO_MS = 15 * 60 * 1000

const loginFails = new Map()

function auditorDatos(req) {
  return { ip: req.ip, user_agent: req.headers['user-agent'] || null }
}

const fallaBloqueada = (usuarioKey) => {
  const e = loginFails.get(usuarioKey)
  return e && e.count >= MAX_INTENTOS && Date.now() < e.hasta
}

function registrarFallo(usuarioKey, req) {
  const e = loginFails.get(usuarioKey)
  if (!e) {
    loginFails.set(usuarioKey, { count: 1, hasta: Date.now() + BLOQUEO_MS })
    return 1
  }
  e.count += 1
  e.hasta = Date.now() + BLOQUEO_MS
  return e.count
}

async function bloquearCuenta(user, req) {
  const hasta = new Date(Date.now() + BLOQUEO_MS)
  await Usuario.update({ locked_until: hasta }, { where: { id: user.id } })
  loginFails.set(user.usuario.toLowerCase(), { count: MAX_INTENTOS, hasta: Date.now() + BLOQUEO_MS })
  await registrarAuditoria({
    ...auditorDatos(req),
    usuario: user.usuario,
    usuario_id: user.id,
    rol: user.rol,
    entidad: 'auth',
    accion: 'LOCKED',
    descripcion: `Cuenta "${user.usuario}" bloqueada hasta ${hasta.toISOString()} por ${MAX_INTENTOS} intentos fallidos de acceso.`,
    origen: 'auto'
  })
  console.error(`[SEGURIDAD] Cuenta "${user.usuario}" bloqueada temporalmente por intentos fallidos (IP: ${req.ip}).`)
}

function publicUserData(usuario) {
  const trabajador = usuario.Trabajador
  return {
    id: usuario.id,
    usuario: usuario.usuario,
    rol: usuario.rol,
    trabajador: trabajador
      ? {
          id: trabajador.id,
          dni: trabajador.dni,
          nombre: trabajador.nombre,
          apellidos: trabajador.apellidos,
          codigo_trabajador: trabajador.codigo_trabajador,
          cargo: trabajador.cargo,
          area: trabajador.area
        }
      : null
  }
}

export async function login(req, res) {
  const usuario = String(req.body?.usuario ?? '').trim()
  const password = String(req.body?.password ?? '')

  if (!usuario || !password) {
    return res.status(400).json({ message: 'Ingrese usuario y contraseña.' })
  }

  if (usuario.length > 50) {
    return res.status(400).json({ message: 'Usuario inválido.' })
  }

  const usuarioKey = usuario.toLowerCase()
  if (fallaBloqueada(usuarioKey)) {
    return res.status(429).json({
      message: 'Demasiados intentos. La cuenta está bloqueada temporalmente, intente más tarde.'
    })
  }

  try {
    const user = await Usuario.findOne({
      where: { usuario },
      include: [{ model: Trabajador }]
    })

    if (!user) {
      const intentos = registrarFallo(usuarioKey, req)
      if (intentos >= MAX_INTENTOS) {
        await registrarAuditoria({
          ...auditorDatos(req),
          usuario,
          entidad: 'auth',
          accion: 'LOCKED',
          descripcion: `Cuenta "${usuario}" bloqueada temporalmente por ${MAX_INTENTOS} intentos fallidos de acceso.`,
          origen: 'auto'
        })
        return res.status(429).json({
          message: 'Demasiados intentos. La cuenta está bloqueada temporalmente, intente más tarde.'
        })
      }
      await registrarAuditoria({
        ...auditorDatos(req),
        usuario,
        entidad: 'auth',
        accion: 'LOGIN_FAIL',
        descripcion: `Intento de inicio de sesión fallido para el usuario "${usuario}".`,
        origen: 'manual'
      })
      return res.status(401).json({ message: 'Credenciales inválidas.' })
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      return res.status(429).json({
        message: 'Demasiados intentos. La cuenta está bloqueada temporalmente, intente más tarde.'
      })
    }

    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({ message: 'Usuario inactivo.' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      const intentos = registrarFallo(usuarioKey, req)
      if (intentos >= MAX_INTENTOS) {
        await bloquearCuenta(user, req)
        return res.status(429).json({
          message: 'Demasiados intentos. La cuenta está bloqueada temporalmente, intente más tarde.'
        })
      }
      await registrarAuditoria({
        ...auditorDatos(req),
        usuario: user.usuario,
        usuario_id: user.id,
        rol: user.rol,
        entidad: 'auth',
        accion: 'LOGIN_FAIL',
        descripcion: `Intento de inicio de sesión fallido para el usuario "${user.usuario}".`,
        origen: 'manual'
      })
      return res.status(401).json({ message: 'Credenciales inválidas.' })
    }

    loginFails.delete(usuarioKey)

    await Usuario.update(
      { ultimo_acceso: new Date(), locked_until: null },
      { where: { id: user.id } }
    )

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    )

    setAuthCookie(res, token)

    await registrarAuditoria({
      ...auditorDatos(req),
      usuario: user.usuario,
      usuario_id: user.id,
      rol: user.rol,
      entidad: 'auth',
      accion: 'LOGIN',
      descripcion: `Inicio de sesión exitoso del usuario "${user.usuario}".`,
      origen: 'manual'
    })

    res.json({ success: true, token, user: publicUserData(user) })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export async function logout(req, res) {
  try {
    clearAuthCookie(res)
    await registrarAuditoria({
      usuario: req.user.usuario,
      usuario_id: req.user.id,
      rol: req.user.rol,
      entidad: 'auth',
      accion: 'LOGOUT',
      descripcion: `Cierre de sesión del usuario "${req.user.usuario}".`,
      origen: 'manual',
      ip: req.ip,
      user_agent: req.headers['user-agent'] || null
    })
    res.json({ success: true })
  } catch (err) {
    console.error('Logout error:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
}

export async function me(req, res) {
  try {
    const user = await Usuario.findOne({
      where: { id: req.user.id, estado: 'ACTIVO' },
      include: [{ model: Trabajador }]
    })

    if (!user) {
      return res.status(401).json({ message: 'No autorizado.' })
    }

    res.json({ success: true, user: publicUserData(user) })
  } catch (err) {
    console.error('Me error:', err)
    res.status(500).json({ message: 'Error interno del servidor.' })
  }
}
