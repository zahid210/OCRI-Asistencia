import { Op, literal } from 'sequelize'
import bcrypt from 'bcryptjs'
import { Asistencia, Facultad, Practicante, Trabajador, Usuario } from '../db.js'
import sequelize from '../db.js'
import { ENUMS, LIMITS, isDni } from '../validation.js'
import { createCrud, ApiError, handleError } from '../services/crudService.js'
import { runAbsentCheck } from '../services/ausentesService.js'
import { renderReportePdf, renderGenericoPdf } from '../services/reporteService.js'
import { registrarAuditoria } from '../services/auditoriaService.js'

/* ------------------------- definición de campos ------------------------- */

const text = (key, label, max, required = false) => ({
  key,
  type: 'text',
  label,
  max,
  required
})

const estado = (key, allowed, fallback) => ({ key, type: 'estado', allowed, fallback })

/* ------------------------- Practicantes ------------------------- */

const practicanteCrud = createCrud({
  model: Practicante,
  order: [['apellidos', 'ASC'], ['nombre', 'ASC']],
  include: [{ model: Facultad }],
  notFound: 'Practicante no encontrado.',
  fields: [
    { key: 'dni', type: 'dni' },
    text('nombre', 'Nombre', LIMITS.nombre, true),
    text('apellidos', 'Apellidos', LIMITS.apellidos, true),
    text('codigo_alumno', 'Código de alumno', LIMITS.codigo_alumno, true),
    { key: 'facultad_id', type: 'ref', required: true },
    { key: 'ciclo', type: 'ciclo' },
    estado('estado', ENUMS.practicanteEstado, 'ACTIVO')
  ]
})

export const createPracticante = practicanteCrud.create
export const updatePracticante = practicanteCrud.update

export async function deletePracticante(req, res) {
  try {
    const practicante = await Practicante.findByPk(req.params.id)
    if (!practicante) throw new ApiError(404, 'Practicante no encontrado.')

    await sequelize.transaction(async (tx) => {
      await Asistencia.destroy({
        where: { practicante_id: req.params.id },
        transaction: tx,
        individualHooks: true
      })
      await Practicante.destroy({
        where: { id: req.params.id },
        transaction: tx,
        individualHooks: true
      })
    })

    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
}

export async function listPracticantes(_req, res) {
  try {
    const rows = await Practicante.findAll({
      order: [['apellidos', 'ASC'], ['nombre', 'ASC']],
      include: [{ model: Facultad }],
      attributes: {
        include: [
          [
            literal(
              '(SELECT COUNT(*) FROM asistencias WHERE asistencias.practicante_id = Practicante.id)'
            ),
            'asistencias_count'
          ]
        ]
      }
    })
    const data = rows.map((r) => {
      const plain = r.get({ plain: true })
      plain.asistencias_count = Number(plain.asistencias_count)
      return plain
    })
    res.json({ success: true, data })
  } catch (err) {
    handleError(res, err)
  }
}

/* ------------------------- Facultades ------------------------- */

const facultadCrud = createCrud({
  model: Facultad,
  order: [['nombre', 'ASC']],
  notFound: 'Facultad no encontrada.',
  fields: [
    text('nombre', 'Nombre', LIMITS.nombre_facultad, true),
    text('abreviatura', 'Abreviatura', LIMITS.abreviatura),
    estado('estado', ENUMS.facultadEstado, 'ACTIVO')
  ]
})

export const listFacultades = facultadCrud.list
export const createFacultad = facultadCrud.create
export const updateFacultad = facultadCrud.update
export const deleteFacultad = facultadCrud.remove

/* ------------------------- Trabajadores ------------------------- */

const trabajadorCrud = createCrud({
  model: Trabajador,
  order: [['apellidos', 'ASC'], ['nombre', 'ASC']],
  notFound: 'Trabajador no encontrado.',
  fields: [
    { key: 'dni', type: 'dni' },
    text('nombre', 'Nombre', LIMITS.nombre, true),
    text('apellidos', 'Apellidos', LIMITS.apellidos, true),
    text('codigo_trabajador', 'Código de trabajador', LIMITS.codigo_trabajador),
    text('cargo', 'Cargo', LIMITS.cargo),
    text('area', 'Área', LIMITS.area),
    estado('estado', ENUMS.trabajadorEstado, 'ACTIVO')
  ]
})

export const listTrabajadores = trabajadorCrud.list
export const createTrabajador = trabajadorCrud.create
export const updateTrabajador = trabajadorCrud.update
export const deleteTrabajador = trabajadorCrud.remove

/* ------------------------- Usuarios ------------------------- */

function sanitizeUsuario(u) {
  return {
    id: u.id,
    usuario: u.usuario,
    rol: u.rol,
    estado: u.estado,
    trabajador_id: u.trabajador_id,
    ultimo_acceso: u.ultimo_acceso,
    Trabajador: u.Trabajador
      ? {
          id: u.Trabajador.id,
          dni: u.Trabajador.dni,
          nombre: u.Trabajador.nombre,
          apellidos: u.Trabajador.apellidos
        }
      : null
  }
}

const usuarioCrud = createCrud({
  model: Usuario,
  order: [['usuario', 'ASC']],
  include: [{ model: Trabajador }],
  notFound: 'Usuario no encontrado.',
  sanitize: sanitizeUsuario,
  fields: [
    text('usuario', 'Usuario', LIMITS.usuario, true),
    { key: 'password', type: 'password' },
    { key: 'trabajador_id', type: 'ref' },
    { key: 'rol', type: 'rol', allowed: ENUMS.usuarioRol, fallback: 'SUPERVISOR' },
    estado('estado', ENUMS.usuarioEstado, 'ACTIVO')
  ],
  beforeCreate: async (req, values) => {
    if (!values.password) throw new ApiError(400, 'La contraseña es obligatoria.')
    values.password_hash = await bcrypt.hash(values.password, 10)
    delete values.password
  },
  beforeUpdate: async (req, changes) => {
    if (changes.password) {
      changes.password_hash = await bcrypt.hash(changes.password, 10)
      delete changes.password
    }

    const isSelf = Number(req.params.id) === Number(req.user.id)
    if (isSelf) {
      if (changes.estado === 'INACTIVO') {
        throw new ApiError(400, 'No puedes desactivar tu propia cuenta.')
      }
      if (changes.rol && changes.rol !== 'ADMIN') {
        throw new ApiError(400, 'No puedes quitarte el rol de administrador.')
      }
    }
  },
  beforeRemove: async (req) => {
    if (Number(req.params.id) === Number(req.user.id)) {
      throw new ApiError(400, 'No puedes eliminar tu propia cuenta.')
    }
  }
})

export const listUsuarios = usuarioCrud.list
export const createUsuario = usuarioCrud.create
export const updateUsuario = usuarioCrud.update
export const deleteUsuario = usuarioCrud.remove

/* ------------------------- Asistencias ------------------------- */

const ASIST_ESTADOS = ['PENDIENTE', 'COMPLETA', 'AUSENTE', 'JUSTIFICADA']

function asistFilters(query) {
  const where = {}

  if (query.fecha) {
    where.fecha = query.fecha
  } else {
    const range = {}
    if (query.desde) range[Op.gte] = query.desde
    if (query.hasta) range[Op.lte] = query.hasta
    if (Object.keys(range).length) where.fecha = range
  }

  if (query.estado) {
    if (!ASIST_ESTADOS.includes(query.estado)) throw new ApiError(400, 'Estado inválido.')
    where.estado = query.estado
  }

  const practicanteWhere = {}
  if (query.facultad_id) {
    if (!Number.isInteger(Number(query.facultad_id))) throw new ApiError(400, 'Facultad inválida.')
    practicanteWhere.facultad_id = Number(query.facultad_id)
  }
  if (query.dni) {
    if (!isDni(query.dni)) throw new ApiError(400, 'DNI inválido (8 dígitos).')
    practicanteWhere.dni = String(query.dni)
  }
  if (query.practicante_id) {
    if (!Number.isInteger(Number(query.practicante_id))) throw new ApiError(400, 'Practicante inválido.')
    practicanteWhere.id = Number(query.practicante_id)
  }

  return {
    where,
    include: [{ model: Practicante, where: practicanteWhere, include: [{ model: Facultad }] }]
  }
}

const esc = (value) => {
  const s = String(value ?? '')
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const ASIST_HEADER = [
  'Fecha',
  'DNI',
  'Apellidos',
  'Nombres',
  'Código',
  'Facultad',
  'Ciclo',
  'Entrada',
  'Salida',
  'Estado',
  'Observación'
]

export async function historialPracticante(req, res) {
  try {
    const practicanteId = req.params.id
    if (!Number.isInteger(Number(practicanteId))) {
      throw new ApiError(400, 'Practicante inválido.')
    }

    const practicante = await Practicante.findByPk(practicanteId, {
      include: [{ model: Facultad }]
    })
    if (!practicante) throw new ApiError(404, 'Practicante no encontrado.')

    const limit = Math.min(Number(req.query.limit) || 30, 100)
    const rows = await Asistencia.findAll({
      where: { practicante_id: practicanteId },
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      limit
    })

    res.json({ success: true, practicante, data: rows })
  } catch (err) {
    handleError(res, err)
  }
}

export async function reportePracticante(req, res) {
  try {
    const practicanteId = Number(req.params.id)
    if (!Number.isInteger(practicanteId)) {
      throw new ApiError(400, 'Practicante inválido.')
    }

    const practicante = await Practicante.findByPk(practicanteId, {
      include: [{ model: Facultad }]
    })
    if (!practicante) throw new ApiError(404, 'Practicante no encontrado.')

    const asistencias = await Asistencia.findAll({
      where: { practicante_id: practicanteId },
      order: [['fecha', 'DESC'], ['id', 'DESC']]
    })

    const pdf = await renderReportePdf({
      practicante: practicante.get({ plain: true }),
      facultad: practicante.Facultad ? practicante.Facultad.get({ plain: true }) : null,
      asistencias: asistencias.map((a) => a.get({ plain: true }))
    })

res.setHeader('Content-Type', 'application/pdf')
res.setHeader(
  'Content-Disposition',
  `inline; filename="reporte-asistencia-${practicanteId}.pdf"`
)
    res.send(Buffer.from(pdf))

    await registrarAuditoria({
      usuario: req.user.usuario,
      usuario_id: req.user.id,
      rol: req.user.rol,
      entidad: 'reporte',
      entidad_id: practicanteId,
      accion: 'REPORTE',
      descripcion: `Descargó el reporte PDF de asistencia del practicante ${practicante.apellidos}, ${practicante.nombre}.`,
      origen: 'manual',
      ip: req.ip,
      user_agent: req.headers['user-agent'] || null
    })
  } catch (err) {
    handleError(res, err)
  }
}

export async function exportAsistencias(req, res) {
  try {
    const { where, include } = asistFilters(req.query)
    const rows = await Asistencia.findAll({
      where,
      include,
      order: [['fecha', 'ASC'], ['id', 'ASC']],
      limit: 10000
    })

    const lines = rows.map((r) =>
      [
        r.fecha,
        r.Practicante?.dni,
        r.Practicante?.apellidos,
        r.Practicante?.nombre,
        r.Practicante?.codigo_alumno,
        r.Practicante?.Facultad?.nombre,
        r.Practicante?.ciclo,
        r.hora_entrada,
        r.hora_salida,
        r.estado,
        r.observacion
      ]
        .map(esc)
        .join(';')
    )

    const csv = '\uFEFF' + [ASIST_HEADER.map(esc).join(';'), ...lines].join('\r\n')
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="asistencias.csv"')
    res.send(csv)

    await registrarAuditoria({
      usuario: req.user.usuario,
      usuario_id: req.user.id,
      rol: req.user.rol,
      entidad: 'asistencia',
      accion: 'EXPORT',
      descripcion: `Exportó el CSV de asistencias (${rows.length} registros).`,
      origen: 'manual',
      ip: req.ip,
      user_agent: req.headers['user-agent'] || null
    })
  } catch (err) {
    handleError(res, err)
  }
}

export async function listAsistencias(req, res) {
  try {
    try {
      await runAbsentCheck()
      cacheInvalidate('admin/asistencias')
    } catch (_e) { /* on-demand no debe romper el listado */ }

    const { where, include } = asistFilters(req.query)
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const page = Math.max(Number(req.query.page) || 1, 1)
    const offset = (page - 1) * limit

    const { rows, count } = await Asistencia.findAndCountAll({
      where,
      include,
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      limit,
      offset
    })

    res.json({
      success: true,
      data: rows,
      total: count,
      page,
      pages: Math.max(Math.ceil(count / limit), 1)
    })
  } catch (err) {
    handleError(res, err)
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

const ALLOWED_STATE_TRANSITIONS = {
  AUSENTE: ['AUSENTE', 'JUSTIFICADA'],
  JUSTIFICADA: ['JUSTIFICADA', 'AUSENTE'],
  COMPLETA: ['COMPLETA'],
  PENDIENTE: []
}

export async function updateAsistencia(req, res) {
  try {
    const id = req.params.id
    if (!Number.isInteger(Number(id))) throw new ApiError(400, 'Asistencia inválida.')

    const asistencia = await Asistencia.findByPk(id)
    if (!asistencia) throw new ApiError(404, 'Asistencia no encontrada.')

    const { hora_entrada, hora_salida, estado, observacion } = req.body

    if (`${hora_entrada ?? ''}`.length && hora_entrada !== null && !TIME_RE.test(hora_entrada)) {
      throw new ApiError(400, 'Hora de entrada inválida (HH:MM).')
    }
    if (`${hora_salida ?? ''}`.length && hora_salida !== null && !TIME_RE.test(hora_salida)) {
      throw new ApiError(400, 'Hora de salida inválida (HH:MM).')
    }
    if (estado !== undefined && !ASIST_ESTADOS.includes(estado)) {
      throw new ApiError(400, 'Estado inválido.')
    }
    if (
      estado !== undefined &&
      estado !== asistencia.estado &&
      !ALLOWED_STATE_TRANSITIONS[asistencia.estado]?.includes(estado)
    ) {
      throw new ApiError(400, 'No se permite cambiar al estado seleccionado.')
    }
    if (observacion !== undefined && observacion !== null && String(observacion).length > 500) {
      throw new ApiError(400, 'La observación no puede exceder 500 caracteres.')
    }

    const changes = {}
    if (hora_entrada !== undefined) changes.hora_entrada = hora_entrada || null
    if (hora_salida !== undefined) changes.hora_salida = hora_salida || null
    if (estado !== undefined) changes.estado = estado
    if (observacion !== undefined) changes.observacion = observacion || null

    await asistencia.update(changes)
    res.json({ success: true, data: asistencia })
  } catch (err) {
    handleError(res, err)
  }
}

/* ------------------------- Auditoría ------------------------- */

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/
const AUDIT_ENTIDADES = ['facultad', 'practicante', 'asistencia', 'trabajador', 'usuario', 'auth', 'reporte']
const AUDIT_ACCIONES = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAIL', 'LOCKED', 'AUTO_AUSENTE', 'REPORTE', 'EXPORT']
const AUDIT_ORIGENES = ['manual', 'auto']

const ACCION_LABELS = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
  LOGIN: 'Inicio de sesión',
  LOGOUT: 'Cierre de sesión',
  LOGIN_FAIL: 'Intento fallido',
  LOCKED: 'Cuenta bloqueada',
  AUTO_AUSENTE: 'Ausencia automática',
  REPORTE: 'Reporte descargado',
  EXPORT: 'Exportación'
}

function auditFilters(query) {
  const where = {}

  if (query.desde || query.hasta) {
    if (query.desde && !FECHA_RE.test(query.desde)) throw new ApiError(400, 'Fecha "desde" inválida.')
    if (query.hasta && !FECHA_RE.test(query.hasta)) throw new ApiError(400, 'Fecha "hasta" inválida.')
    where.createdAt = {}
    if (query.desde) where.createdAt[Op.gte] = `${query.desde} 00:00:00`
    if (query.hasta) where.createdAt[Op.lte] = `${query.hasta} 23:59:59`
  }

  if (query.usuario) where.usuario = { [Op.like]: `%${String(query.usuario).trim()}%` }
  if (query.entidad) {
    if (!AUDIT_ENTIDADES.includes(query.entidad)) throw new ApiError(400, 'Entidad inválida.')
    where.entidad = query.entidad
  }
  if (query.accion) {
    if (!AUDIT_ACCIONES.includes(query.accion)) throw new ApiError(400, 'Acción inválida.')
    where.accion = query.accion
  }
  if (query.origen) {
    if (!AUDIT_ORIGENES.includes(query.origen)) throw new ApiError(400, 'Origen inválido.')
    where.origen = query.origen
  }

  return where
}

export async function listAuditorias(req, res) {
  try {
    const where = auditFilters(req.query)
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const page = Math.max(Number(req.query.page) || 1, 1)
    const offset = (page - 1) * limit

    const { rows, count } = await sequelize.models.Auditoria.findAndCountAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset
    })

    res.json({
      success: true,
      data: rows,
      total: count,
      page,
      pages: Math.max(Math.ceil(count / limit), 1)
    })
  } catch (err) {
    handleError(res, err)
  }
}

const AUDIT_HEADER = ['Fecha', 'Usuario', 'Rol', 'Entidad', 'Registro', 'Acción', 'Origen', 'Descripción', 'IP']

export async function exportAuditorias(req, res) {
  try {
    const where = auditFilters(req.query)
    let rows
    if (req.query.formato === 'pdf') {
      rows = await sequelize.models.Auditoria.findAll({
        where,
        order: [['createdAt', 'DESC'], ['id', 'DESC']]
      })
    } else {
      rows = await sequelize.models.Auditoria.findAll({
        where,
        order: [['createdAt', 'DESC'], ['id', 'DESC']],
        limit: 10000
      })
    }

    const usuarioLabel = req.user.usuario

    if (req.query.formato === 'pdf') {
      const filas = rows
        .map(
          (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${esc(r.createdAt)}</td>
          <td>${esc(r.usuario ?? '—')}</td>
          <td>${esc(r.entidad)}</td>
          <td>${esc(r.entidad_id ?? '—')}</td>
          <td>${esc(ACCION_LABELS[r.accion] ?? r.accion)}</td>
          <td>${esc(r.origen)}</td>
          <td>${esc(r.descripcion ?? '')}</td>
        </tr>`
        )
        .join('\n')

      const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Auditoría</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #fff; font-family: Helvetica; font-size: 11px; color: #000; }
  @page { size: A4 landscape; margin: 12mm 10mm; }
  .title { text-align: center; font-size: 15px; font-weight: bold; margin: 0 0 4px 0; text-decoration: underline; }
  .sub { text-align: center; font-size: 11px; margin: 0 0 14px 0; }
  table.report { width: 100%; border-collapse: collapse; font-size: 9px; }
  .report th { border: 1px solid #000; padding: 4px 6px; background: #e8e8e8; text-align: left; }
  .report td { border: 1px solid #999; padding: 4px 6px; }
</style>
</head>
<body>
  <p class="title">Reporte de Auditoría</p>
  <p class="sub">Generado por ${esc(usuarioLabel)} · ${new Date().toLocaleString('es-PE')} · ${rows.length} registro(s)</p>
  <table class="report">
    <thead>
      <tr><th>#</th><th>Fecha</th><th>Usuario</th><th>Entidad</th><th>Registro</th><th>Acción</th><th>Origen</th><th>Descripción</th></tr>
    </thead>
    <tbody>${filas || '<tr><td colspan="8">Sin registros.</td></tr>'}</tbody>
  </table>
</body>
</html>`

      const pdf = await renderGenericoPdf(html)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', 'inline; filename="reporte-auditoria.pdf"')
      res.send(Buffer.from(pdf))
    } else {
      const lines = rows.map((r) =>
        [
          r.createdAt,
          r.usuario,
          r.rol,
          r.entidad,
          r.entidad_id,
          r.accion,
          r.origen,
          r.descripcion,
          r.ip
        ]
          .map(esc)
          .join(';')
      )
      const csv = '\uFEFF' + [AUDIT_HEADER.map(esc).join(';'), ...lines].join('\r\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="auditoria.csv"')
      res.send(csv)
    }

    await registrarAuditoria({
      usuario: req.user.usuario,
      usuario_id: req.user.id,
      rol: req.user.rol,
      entidad: 'auditoria',
      accion: 'EXPORT',
      descripcion: `Exportó ${req.query.formato === 'pdf' ? 'el PDF de auditoría' : 'el CSV de auditoría'} (${rows.length} registros).`,
      origen: 'manual',
      ip: req.ip,
      user_agent: req.headers['user-agent'] || null
    })
  } catch (err) {
    handleError(res, err)
  }
}
