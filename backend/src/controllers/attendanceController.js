import {
  registerAttendance,
  normalizeAttendanceError
} from '../services/attendanceService.js'
import { limaDateParts } from '../services/timeService.js'

export async function time(_req, res) {
  res.set('Cache-Control', 'no-store')
  res.json(limaDateParts())
}

export async function attendance(req, res) {
  const dni = String(req.body?.dni ?? '')

  if (!/^\d{8}$/.test(dni)) {
    return res.status(400).json({
      message: 'El DNI debe contener exactamente 8 dígitos.'
    })
  }

  try {
    const result = await registerAttendance(dni)
    const status = result.code === 'ATTENDANCE_COMPLETED' ? 200 : 201
    return res.status(status).json({
      success: true,
      ...result,
      ...limaDateParts()
    })
  } catch (err) {
    const normalized = normalizeAttendanceError(err)
    if (normalized) {
      return res.status(normalized.status).json({
        success: false,
        code: normalized.code ?? 'ERROR',
        message: normalized.message
      })
    }
    console.error('Attendance error:', err)
    return res.status(500).json({
      message: 'Error interno del servidor.'
    })
  }
}
