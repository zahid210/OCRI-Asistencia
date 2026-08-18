import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { pool } from './db.js'
import { findPractitionerByDni, createAttendance } from './db.js'

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
  methods: ['GET', 'POST']
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

app.get('/api/time', (_req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json(limaDateParts())
})

app.post('/api/attendance', async (req, res) => {
  const dni = String(req.body?.dni ?? '')

  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({
      message: 'El DNI debe contener exactamente 8 dígitos.'
    })
  }

  try {
    const practitioner = await findPractitionerByDni(dni)

    if (!practitioner) {
      return res.status(404).json({
        message: 'DNI no registrado.'
      })
    }

    const lima = limaNow()

    const [existingRows] = await pool.query(
      'SELECT id, hora_entrada, hora_salida, estado, observacion FROM asistencias WHERE practicante_id = ? AND fecha = ?',
      [practitioner.id, lima.date]
    )

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

    if (existingRows.length === 0) {
      await createAttendance(practitioner.id, lima.date, lima.time)

      const [attendanceRows] = await pool.query(
        'SELECT id, fecha, hora_entrada, hora_salida, estado, observacion FROM asistencias WHERE practicante_id = ? AND fecha = ?',
        [practitioner.id, lima.date]
      )

      return res.status(201).json({
        success: true,
        code: 'ATTENDANCE_REGISTERED',
        message: 'Asistencia registrada correctamente.',
        practitioner: practitionerData,
        attendance: attendanceRows[0],
        ...limaDateParts()
      })
    }

    const existing = existingRows[0]

    if (existing.hora_salida == null) {
      await pool.query(
        'UPDATE asistencias SET hora_salida = ?, estado = ? WHERE id = ?',
        [lima.time, 'COMPLETA', existing.id]
      )

      const [attendanceRows] = await pool.query(
        'SELECT id, fecha, hora_entrada, hora_salida, estado, observacion FROM asistencias WHERE practicante_id = ? AND fecha = ?',
        [practitioner.id, lima.date]
      )

      return res.status(200).json({
        success: true,
        code: 'ATTENDANCE_COMPLETED',
        message: 'Salida registrada correctamente.',
        practitioner: practitionerData,
        attendance: attendanceRows[0],
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
    if (err.code === 'ER_DUP_ENTRY') {
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
    const [rows] = await pool.query('SELECT 1')
    res.json({ ok: true, timezone: LIMA_TZ })
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Database connection failed' })
  }
})

app.use(express.static(path.join(__dirname, '../../frontend/dist')))

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
})

app.listen(PORT, () => {
  console.log(`OCRI API ejecutándose en http://localhost:${PORT}`)
})