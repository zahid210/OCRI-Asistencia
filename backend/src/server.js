import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'path'
import { fileURLToPath } from 'url'
import sequelize, { Practicante, Asistencia, Trabajador, Usuario } from './db.js'
import { authMiddleware, requireAdmin, JWT_SECRET } from './auth.js'
import adminRouter from './routes/admin.js'

const app = express()
const PORT = process.env.PORT || 3000
const LIMA_TZ = 'America/Lima'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const clockFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: LIMA_TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: LIMA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
})

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: LIMA_TZ,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
})

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? undefined : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '10kb' }))

function limaDateParts() {
  const parts = clockFormatter.formatToParts(new Date())

  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  const hour = get('hour') === '24' ? '00' : get('hour')

  return {
    time: `${hour}:${get('minute')}`,
    seconds: get('second'),
    meridiem: Number(hour) >= 12 ? 'pm' : 'am'
  }
}

function limaNow() {
  const dateParts = dateFormatter.formatToParts(new Date())
  const timeParts = timeFormatter.formatToParts(new Date())

  const get = (parts, type) => parts.find((part) => part.type === type)?.value ?? '00'
  let hour = get(timeParts, 'hour')
  if (hour === '24') hour = '00'

  return {
    date: `${get(dateParts, 'year')}-${get(dateParts, 'month')}-${get(dateParts, 'day')}`,
    time: `${hour}:${get(timeParts, 'minute')}:${get(timeParts, 'second')}`
  }
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

app.post('/api/auth/login', async (req, res) => {
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
})

app.get('/api/auth/me', authMiddleware, async (req, res) => {
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
})

app.get('/api/time', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(limaDateParts())
})

app.post('/api/attendance', authMiddleware, async (req, res) => {
  const dni = String(req.body?.dni ?? '')

  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({
      message: 'El DNI debe contener exactamente 8 dígitos.'
    })
  }

  try {
    const practitioner = await Practicante.findOne({
      where: { dni, estado: 'ACTIVO' }
    })

    if (!practitioner) {
      return res.status(404).json({
        message: 'DNI no registrado.'
      })
    }

    const lima = limaNow()

    let existing = await Asistencia.findOne({
      where: { practicante_id: practitioner.id, fecha: lima.date }
    })

    const practitionerData = {
      id: practitioner.id,
      dni: practitioner.dni,
      nombre: practitioner.nombre,
      apellidos: practitioner.apellidos,
      codigo_alumno: practitioner.codigo_alumno,
      facultad_id: practitioner.facultad_id,
      ciclo: practitioner.ciclo,
      estado: practitioner.estado
    }

    if (!existing) {
      await Asistencia.create({
        practicante_id: practitioner.id,
        fecha: lima.date,
        hora_entrada: lima.time,
        estado: 'PENDIENTE'
      })

      existing = await Asistencia.findOne({
        where: { practicante_id: practitioner.id, fecha: lima.date }
      })

      return res.status(201).json({
        success: true,
        code: 'ATTENDANCE_REGISTERED',
        message: 'Asistencia registrada correctamente.',
        practitioner: practitionerData,
        attendance: existing.get({ plain: true }),
        ...limaDateParts()
      })
    }

    if (existing.hora_salida == null) {
      await Asistencia.update(
        { hora_salida: lima.time, estado: 'COMPLETA' },
        { where: { id: existing.id } }
      )

      existing = await Asistencia.findOne({
        where: { practicante_id: practitioner.id, fecha: lima.date }
      })

      return res.status(200).json({
        success: true,
        code: 'ATTENDANCE_COMPLETED',
        message: 'Salida registrada correctamente.',
        practitioner: practitionerData,
        attendance: existing.get({ plain: true }),
        ...limaDateParts()
      })
    }

    return res.status(409).json({
      success: false,
      code: 'ALREADY_REGISTERED',
      message: 'La asistencia de hoy ya fue registrada.'
    })
  } catch (err) {
    console.error('Attendance error:', err)
    if (err.name === 'SequelizeUniqueConstraintError' || err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_REGISTERED',
        message: 'La asistencia de hoy ya fue registrada.'
      })
    }
    return res.status(500).json({
      message: 'Error interno del servidor.'
    })
  }
})

app.get('/api/health', async (_req, res) => {
  try {
    await sequelize.authenticate()
    res.json({ ok: true, timezone: LIMA_TZ })
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Database connection failed' })
  }
})

app.use('/api/admin', authMiddleware, requireAdmin, adminRouter)

app.use(express.static(path.join(__dirname, '../../frontend/dist')))

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`OCRI API ejecutándose en http://localhost:${PORT}`)
})