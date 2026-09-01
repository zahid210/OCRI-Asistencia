import { Op } from 'sequelize'
import { Practicante, Asistencia } from '../db.js'
import { limaNow } from './timeService.js'

export const WORK_START = '08:00:00'
export const WORK_END = '20:00:00'
export const AUTO_CLOSE_TIME = '20:00:00'

export class AttendanceServiceError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

function isWithinWorkHours(time) {
  return time > WORK_START && time < WORK_END
}

function practitionerData(practitioner) {
  return {
    id: practitioner.id,
    dni: practitioner.dni,
    nombre: practitioner.nombre,
    apellidos: practitioner.apellidos,
    codigo_alumno: practitioner.codigo_alumno,
    facultad_id: practitioner.facultad_id,
    ciclo: practitioner.ciclo,
    estado: practitioner.estado
  }
}

async function autoClosePending(today) {
  await Asistencia.update(
    { hora_salida: AUTO_CLOSE_TIME, estado: 'COMPLETA' },
    {
      where: {
        fecha: { [Op.lt]: today },
        estado: 'PENDIENTE',
        hora_salida: null
      }
    }
  )
}

export async function registerAttendance(dni) {
  const practitioner = await Practicante.findOne({
    where: { dni, estado: 'ACTIVO' }
  })

  if (!practitioner) {
    throw new AttendanceServiceError(404, 'DNI no registrado.')
  }

  const lima = limaNow()

  if (!isWithinWorkHours(lima.time)) {
    throw new AttendanceServiceError(
      403,
      'Fuera de horario laboral (8:00 a.m. - 8:00 p.m.).',
      'OUTSIDE_WORK_HOURS'
    )
  }

  await autoClosePending(lima.date)
  let existing = await Asistencia.findOne({
    where: { practicante_id: practitioner.id, fecha: lima.date }
  })

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

    return {
      code: 'ATTENDANCE_REGISTERED',
      message: 'Asistencia registrada correctamente.',
      practitioner: practitionerData(practitioner),
      attendance: existing.get({ plain: true })
    }
  }

  if (existing.hora_salida == null) {
    await Asistencia.update(
      { hora_salida: lima.time, estado: 'COMPLETA' },
      { where: { id: existing.id } }
    )

    existing = await Asistencia.findOne({
      where: { practicante_id: practitioner.id, fecha: lima.date }
    })

    return {
      code: 'ATTENDANCE_COMPLETED',
      message: 'Salida registrada correctamente.',
      practitioner: practitionerData(practitioner),
      attendance: existing.get({ plain: true })
    }
  }

  throw new AttendanceServiceError(
    409,
    'La asistencia de hoy ya fue registrada.',
    'ALREADY_REGISTERED'
  )
}

export function normalizeAttendanceError(err) {
  if (err instanceof AttendanceServiceError) return err
  if (err.name === 'SequelizeUniqueConstraintError' || err.code === 'ER_DUP_ENTRY') {
    return new AttendanceServiceError(
      409,
      'La asistencia de hoy ya fue registrada.',
      'ALREADY_REGISTERED'
    )
  }
  return null
}
