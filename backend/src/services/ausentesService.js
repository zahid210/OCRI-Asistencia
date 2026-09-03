import { Op } from 'sequelize'
import { Practicante, Asistencia } from '../db.js'
import { limaNow } from './timeService.js'

export const ABSENT_DEADLINE = '16:00:00'
const LIMA_OFFSET = '-05:00'
let runningAbsentJob = false

function isLateForAbsentCheck(time) {
  return time >= ABSENT_DEADLINE
}

export async function markAbsentsForDate(dateStr) {
  const practitioners = await Practicante.findAll({
    where: { estado: 'ACTIVO' },
    attributes: ['id']
  })

  const existing = await Asistencia.findAll({
    where: {
      fecha: dateStr,
      practicante_id: { [Op.in]: practitioners.map((p) => p.id) }
    },
    attributes: ['practicante_id']
  })

  const presentIds = new Set(existing.map((a) => a.practicante_id))
  const absentIds = practitioners
    .map((p) => p.id)
    .filter((id) => !presentIds.has(id))

  if (absentIds.length) {
    await Asistencia.bulkCreate(
      absentIds.map((practicante_id) => ({
        practicante_id,
        fecha: dateStr,
        hora_entrada: null,
        hora_salida: null,
        estado: 'AUSENTE',
        observacion: null
      }))
    )
  }

  return {
    absentIds,
    checked: practitioners.length,
    marked: absentIds.length
  }
}

export async function runAbsentCheck() {
  if (runningAbsentJob) return { skipped: true }
  runningAbsentJob = true
  try {
    const lima = limaNow()
    if (!isLateForAbsentCheck(lima.time)) return { skipped: true, reason: 'before_deadline' }
    return await markAbsentsForDate(lima.date)
  } finally {
    runningAbsentJob = false
  }
}

export function scheduleAbsentJob() {
  const now = limaNow()
  let delayMs

  if (isLateForAbsentCheck(now.time)) {
    delayMs = 10_000
  } else {
    const target = new Date(`${now.date}T${ABSENT_DEADLINE}${LIMA_OFFSET}`)
    delayMs = Math.max(target.getTime() - Date.now(), 0)
  }

  setTimeout(runAbsentJobTick, delayMs)
}

async function runAbsentJobTick() {
  try {
    await runAbsentCheck()
  } catch (err) {
    console.error('[ausentes] Error marcando ausentes:', err.message)
  } finally {
    scheduleAbsentJob()
  }
}