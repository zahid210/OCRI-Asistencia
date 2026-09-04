import { AsyncLocalStorage } from 'node:async_hooks'

const almacen = new AsyncLocalStorage()

const CAMPOS_SENSIBLES = new Set(['password_hash', 'password'])

function auditorActual() {
  return almacen.getStore() ?? null
}

function ejecutarConAuditor(auditor, fn) {
  return almacen.run(auditor, fn)
}

function quitarSensibles(data) {
  if (!data || typeof data !== 'object') return data
  const out = {}
  for (const [k, v] of Object.entries(data)) {
    if (CAMPOS_SENSIBLES.has(k)) continue
    out[k] = v
  }
  return out
}

export async function registrarAuditoria({
  usuario = null,
  usuario_id = null,
  rol = null,
  entidad,
  entidad_id = null,
  accion,
  descripcion = null,
  antes = null,
  despues = null,
  origen = 'manual',
  ip = null,
  user_agent = null
}) {
  try {
    const { Auditoria } = await import('../db.js')
    await Auditoria.create({
      usuario,
      usuario_id,
      rol,
      entidad,
      entidad_id: entidad_id != null ? String(entidad_id) : null,
      accion,
      descripcion: descripcion ? String(descripcion).slice(0, 500) : null,
      antes: antes ? quitarSensibles(antes) : null,
      despues: despues ? quitarSensibles(despues) : null,
      origen,
      ip,
      user_agent: user_agent ? String(user_agent).slice(0, 255) : null
    })
  } catch (err) {
    console.error('[auditoria] No se pudo registrar:', err.message)
  }
}

export async function registrarDesdeHook(instance, accion) {
  const auditor = auditorActual()
  if (!auditor) return

  const data = instance ? instance.get({ plain: true }) : null
  let antes = null
  let despues = null

  if (accion === 'CREATE') {
    despues = data
  } else if (accion === 'UPDATE') {
    antes = instance.previous()
    despues = data
  } else if (accion === 'DELETE') {
    antes = data
  }

  const verbo = accion === 'CREATE' ? 'creó' : accion === 'UPDATE' ? 'actualizó' : 'eliminó'
  const descripcion = `Se ${verbo} ${instance.constructor.name.toLowerCase()} #${instance.id}`

  await registrarAuditoria({
    usuario: auditor.usuario,
    usuario_id: auditor.usuario_id,
    rol: auditor.rol,
    entidad: instance.constructor.name.toLowerCase(),
    entidad_id: instance.id,
    accion,
    descripcion,
    antes,
    despues,
    origen: 'manual',
    ip: auditor.ip,
    user_agent: auditor.user_agent
  })
}

export { auditorActual, ejecutarConAuditor }