import { Op } from 'sequelize'
import bcrypt from 'bcryptjs'
import { Asistencia, Facultad, Practicante, Trabajador, Usuario } from '../db.js'
import {
  ENUMS,
  LIMITS,
  isDni,
  isCiclo,
  toCiclo,
  isInEnum,
  lengthError,
  passwordError
} from '../validation.js'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function handleError(res, err) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ message: err.message })
  }

  const errno = err.parent?.errno

  if (errno === 1451) {
    return res.status(409).json({ message: 'No se puede eliminar: tiene registros asociados.' })
  }
  if (errno === 1452) {
    return res.status(409).json({ message: 'El registro referenciado no existe.' })
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ message: 'Ya existe un registro con esos datos únicos.' })
  }
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeDatabaseError') {
    return res.status(400).json({ message: 'Datos inválidos.' })
  }

  console.error(err)
  return res.status(500).json({ message: 'Error interno del servidor.' })
}

function textOrThrow(key, body, { label, max, required }) {
  const value = body[key]
  const filled = value != null && String(value).trim() !== ''

  if (!filled) {
    if (required) throw new ApiError(400, `${label} es obligatorio.`)
    return null
  }
  const msg = lengthError(label, value, max)
  if (msg) throw new ApiError(400, msg)
  return String(value).trim()
}

function dniOrThrow(body) {
  if (!isDni(body.dni)) throw new ApiError(400, 'DNI inválido (8 dígitos).')
  return String(body.dni)
}

function estadoOrThrow(allowed, body, fallback) {
  if (body.estado === undefined) return fallback
  if (!isInEnum(allowed, body.estado)) throw new ApiError(400, 'Estado inválido.')
  return body.estado
}

function cicloOrThrow(body) {
  if (body.ciclo === undefined) return undefined
  if (!isCiclo(body.ciclo)) throw new ApiError(400, 'El ciclo debe estar entre 1 y 10.')
  return toCiclo(body.ciclo)
}

function idOrThrow(key, body, { required = false } = {}) {
  if (body[key] === undefined || body[key] === null) {
    if (required) throw new ApiError(400, 'Valor de referencia obligatorio.')
    return null
  }
  if (!Number.isInteger(Number(body[key]))) throw new ApiError(400, 'Valor de referencia inválido.')
  return Number(body[key])
}

function rolOrThrow(body, fallback) {
  if (body.rol === undefined) return fallback
  if (!isInEnum(ENUMS.usuarioRol, body.rol)) throw new ApiError(400, 'Rol inválido.')
  return body.rol
}

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

/* ------------------------- Practicantes ------------------------- */

export async function listPracticantes(_req, res) {
  try {
    const rows = await Practicante.findAll({
      include: [{ model: Facultad }],
      order: [['apellidos', 'ASC'], ['nombre', 'ASC']]
    })
    res.json({ success: true, data: rows })
  } catch (err) {
    handleError(res, err)
  }
}

export async function createPracticante(req, res) {
  try {
    const nombre = textOrThrow('nombre', req.body, { label: 'Nombre', max: LIMITS.nombre, required: true })
    const apellidos = textOrThrow('apellidos', req.body, { label: 'Apellidos', max: LIMITS.apellidos, required: true })
    const codigoAlumno = textOrThrow('codigo_alumno', req.body, { label: 'Código de alumno', max: LIMITS.codigo_alumno, required: true })

    const row = await Practicante.create({
      dni: dniOrThrow(req.body),
      nombre,
      apellidos,
      codigo_alumno: codigoAlumno,
      facultad_id: idOrThrow('facultad_id', req.body, { required: true }),
      ciclo: cicloOrThrow(req.body),
      estado: estadoOrThrow(ENUMS.practicanteEstado, req.body, 'ACTIVO')
    })
    res.status(201).json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
}

export async function updatePracticante(req, res) {
  try {
    const changes = {}
    if (req.body.dni !== undefined) changes.dni = dniOrThrow(req.body)
    if (req.body.nombre !== undefined) {
      changes.nombre = textOrThrow('nombre', req.body, { label: 'Nombre', max: LIMITS.nombre, required: false })
    }
    if (req.body.apellidos !== undefined) {
      changes.apellidos = textOrThrow('apellidos', req.body, { label: 'Apellidos', max: LIMITS.apellidos, required: false })
    }
    if (req.body.codigo_alumno !== undefined) {
      changes.codigo_alumno = textOrThrow('codigo_alumno', req.body, { label: 'Código de alumno', max: LIMITS.codigo_alumno, required: false })
    }
    if (req.body.facultad_id !== undefined) changes.facultad_id = idOrThrow('facultad_id', req.body)
    const ciclo = cicloOrThrow(req.body)
    if (ciclo !== undefined) changes.ciclo = ciclo
    const estado = estadoOrThrow(ENUMS.practicanteEstado, req.body)
    if (estado !== undefined) changes.estado = estado

    await Practicante.update(changes, { where: { id: req.params.id } })
    const row = await Practicante.findByPk(req.params.id, { include: [{ model: Facultad }] })
    if (!row) throw new ApiError(404, 'Practicante no encontrado.')
    res.json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
}

export async function deletePracticante(req, res) {
  try {
    const deleted = await Practicante.destroy({ where: { id: req.params.id } })
    if (!deleted) throw new ApiError(404, 'Practicante no encontrado.')
    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
}

/* ------------------------- Facultades ------------------------- */

export async function listFacultades(_req, res) {
  try {
    const rows = await Facultad.findAll({ order: [['nombre', 'ASC']] })
    res.json({ success: true, data: rows })
  } catch (err) {
    handleError(res, err)
  }
}

export async function createFacultad(req, res) {
  try {
    const row = await Facultad.create({
      nombre: textOrThrow('nombre', req.body, { label: 'Nombre', max: LIMITS.nombre_facultad, required: true }),
      abreviatura: textOrThrow('abreviatura', req.body, { label: 'Abreviatura', max: LIMITS.abreviatura, required: false }),
      estado: estadoOrThrow(ENUMS.facultadEstado, req.body, 'ACTIVO')
    })
    res.status(201).json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
}

export async function updateFacultad(req, res) {
  try {
    const changes = {}
    if (req.body.nombre !== undefined) {
      changes.nombre = textOrThrow('nombre', req.body, { label: 'Nombre', max: LIMITS.nombre_facultad, required: false })
    }
    if (req.body.abreviatura !== undefined) {
      changes.abreviatura = textOrThrow('abreviatura', req.body, { label: 'Abreviatura', max: LIMITS.abreviatura, required: false })
    }
    const estado = estadoOrThrow(ENUMS.facultadEstado, req.body)
    if (estado !== undefined) changes.estado = estado

    await Facultad.update(changes, { where: { id: req.params.id } })
    const row = await Facultad.findByPk(req.params.id)
    if (!row) throw new ApiError(404, 'Facultad no encontrada.')
    res.json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
}

export async function deleteFacultad(req, res) {
  try {
    const deleted = await Facultad.destroy({ where: { id: req.params.id } })
    if (!deleted) throw new ApiError(404, 'Facultad no encontrada.')
    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
}

/* ------------------------- Trabajadores ------------------------- */

export async function listTrabajadores(_req, res) {
  try {
    const rows = await Trabajador.findAll({ order: [['apellidos', 'ASC'], ['nombre', 'ASC']] })
    res.json({ success: true, data: rows })
  } catch (err) {
    handleError(res, err)
  }
}

export async function createTrabajador(req, res) {
  try {
    const row = await Trabajador.create({
      dni: dniOrThrow(req.body),
      nombre: textOrThrow('nombre', req.body, { label: 'Nombre', max: LIMITS.nombre, required: true }),
      apellidos: textOrThrow('apellidos', req.body, { label: 'Apellidos', max: LIMITS.apellidos, required: true }),
      codigo_trabajador: textOrThrow('codigo_trabajador', req.body, { label: 'Código de trabajador', max: LIMITS.codigo_trabajador, required: false }),
      cargo: textOrThrow('cargo', req.body, { label: 'Cargo', max: LIMITS.cargo, required: false }),
      area: textOrThrow('area', req.body, { label: 'Área', max: LIMITS.area, required: false }),
      estado: estadoOrThrow(ENUMS.trabajadorEstado, req.body, 'ACTIVO')
    })
    res.status(201).json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
}

export async function updateTrabajador(req, res) {
  try {
    const changes = {}
    if (req.body.dni !== undefined) changes.dni = dniOrThrow(req.body)
    if (req.body.nombre !== undefined) {
      changes.nombre = textOrThrow('nombre', req.body, { label: 'Nombre', max: LIMITS.nombre, required: false })
    }
    if (req.body.apellidos !== undefined) {
      changes.apellidos = textOrThrow('apellidos', req.body, { label: 'Apellidos', max: LIMITS.apellidos, required: false })
    }
    if (req.body.codigo_trabajador !== undefined) {
      changes.codigo_trabajador = textOrThrow('codigo_trabajador', req.body, { label: 'Código de trabajador', max: LIMITS.codigo_trabajador, required: false })
    }
    if (req.body.cargo !== undefined) {
      changes.cargo = textOrThrow('cargo', req.body, { label: 'Cargo', max: LIMITS.cargo, required: false })
    }
    if (req.body.area !== undefined) {
      changes.area = textOrThrow('area', req.body, { label: 'Área', max: LIMITS.area, required: false })
    }
    const estado = estadoOrThrow(ENUMS.trabajadorEstado, req.body)
    if (estado !== undefined) changes.estado = estado

    await Trabajador.update(changes, { where: { id: req.params.id } })
    const row = await Trabajador.findByPk(req.params.id)
    if (!row) throw new ApiError(404, 'Trabajador no encontrado.')
    res.json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
}

export async function deleteTrabajador(req, res) {
  try {
    const deleted = await Trabajador.destroy({ where: { id: req.params.id } })
    if (!deleted) throw new ApiError(404, 'Trabajador no encontrado.')
    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
}

/* ------------------------- Usuarios ------------------------- */

export async function listUsuarios(_req, res) {
  try {
    const rows = await Usuario.findAll({
      include: [{ model: Trabajador }],
      order: [['usuario', 'ASC']]
    })
    res.json({ success: true, data: rows.map(sanitizeUsuario) })
  } catch (err) {
    handleError(res, err)
  }
}

export async function createUsuario(req, res) {
  try {
    const usuario = textOrThrow('usuario', req.body, { label: 'Usuario', max: LIMITS.usuario, required: true })
    const password = String(req.body.password ?? '')
    const pwdError = passwordError(password)
    if (pwdError) throw new ApiError(400, pwdError)

    const row = await Usuario.create({
      usuario,
      password_hash: await bcrypt.hash(password, 10),
      trabajador_id: idOrThrow('trabajador_id', req.body),
      rol: rolOrThrow(req.body, 'SUPERVISOR'),
      estado: estadoOrThrow(ENUMS.usuarioEstado, req.body, 'ACTIVO')
    })
    const created = await Usuario.findByPk(row.id, { include: [{ model: Trabajador }] })
    res.status(201).json({ success: true, data: sanitizeUsuario(created) })
  } catch (err) {
    handleError(res, err)
  }
}

export async function updateUsuario(req, res) {
  try {
    const changes = {}
    if (req.body.usuario !== undefined) {
      changes.usuario = textOrThrow('usuario', req.body, { label: 'Usuario', max: LIMITS.usuario, required: false })
    }
    if (req.body.password) {
      const pwdError = passwordError(req.body.password)
      if (pwdError) throw new ApiError(400, pwdError)
      changes.password_hash = await bcrypt.hash(req.body.password, 10)
    }
    if (req.body.trabajador_id !== undefined) {
      changes.trabajador_id = idOrThrow('trabajador_id', req.body)
    }
    if (req.body.rol !== undefined) {
      changes.rol = rolOrThrow(req.body)
    }
    const estado = estadoOrThrow(ENUMS.usuarioEstado, req.body)
    if (estado !== undefined) changes.estado = estado

    const isSelf = Number(req.params.id) === Number(req.user.id)
    if (isSelf) {
      if (changes.estado === 'INACTIVO') {
        throw new ApiError(400, 'No puedes desactivar tu propia cuenta.')
      }
      if (changes.rol && changes.rol !== 'ADMIN') {
        throw new ApiError(400, 'No puedes quitarte el rol de administrador.')
      }
    }

    await Usuario.update(changes, { where: { id: req.params.id } })
    const row = await Usuario.findByPk(req.params.id, { include: [{ model: Trabajador }] })
    if (!row) throw new ApiError(404, 'Usuario no encontrado.')
    res.json({ success: true, data: sanitizeUsuario(row) })
  } catch (err) {
    handleError(res, err)
  }
}

export async function deleteUsuario(req, res) {
  try {
    if (Number(req.params.id) === Number(req.user.id)) {
      throw new ApiError(400, 'No puedes eliminar tu propia cuenta.')
    }
    const deleted = await Usuario.destroy({ where: { id: req.params.id } })
    if (!deleted) throw new ApiError(404, 'Usuario no encontrado.')
    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
}

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
  } catch (err) {
    handleError(res, err)
  }
}

export async function listAsistencias(req, res) {
  try {
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
