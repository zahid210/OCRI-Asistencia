import { Op } from 'sequelize'
import bcrypt from 'bcryptjs'
import { Asistencia, Facultad, Practicante, Trabajador, Usuario } from '../db.js'
import { ENUMS, LIMITS, isDni } from '../validation.js'
import { createCrud, ApiError, handleError } from '../services/crudService.js'

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

export const listPracticantes = practicanteCrud.list
export const createPracticante = practicanteCrud.create
export const updatePracticante = practicanteCrud.update
export const deletePracticante = practicanteCrud.remove

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
  }
})

export const listUsuarios = usuarioCrud.list
export const createUsuario = usuarioCrud.create
export const updateUsuario = usuarioCrud.update

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
