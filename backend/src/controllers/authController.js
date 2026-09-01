import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Usuario, Trabajador } from '../db.js'
import { JWT_SECRET } from '../middleware/authMiddleware.js'

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

  try {
    const user = await Usuario.findOne({
      where: { usuario },
      include: [{ model: Trabajador }]
    })

    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas.' })
    }

    if (user.estado !== 'ACTIVO') {
      return res.status(403).json({ message: 'Usuario inactivo.' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ message: 'Credenciales inválidas.' })
    }

    await Usuario.update(
      { ultimo_acceso: new Date() },
      { where: { id: user.id } }
    )

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      JWT_SECRET,
      { expiresIn: '12h' }
    )

    res.json({ success: true, token, user: publicUserData(user) })
  } catch (err) {
    console.error('Login error:', err)
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
