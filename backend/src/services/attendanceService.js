import { Practicante, Asistencia } from '../db.js'
import { limaNow } from './timeService.js'

export class AttendanceServiceError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code
  }
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

export async function registerAttendance(dni) {
  const practitioner = await Practicante.findOne({
    where: { dni, estado: 'ACTIVO' }
  })

  if (!practitioner) {
    throw new AttendanceServiceError(404, 'DNI no registrado.')
  }

  const lima = limaNow()
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
