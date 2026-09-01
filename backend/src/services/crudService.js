import { isCiclo, toCiclo, isInEnum, lengthError, passwordError } from '../validation.js'

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
    this.name = 'ApiError'
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

/* ------------------------- definición de tipos de campo ------------------------- */

const fieldProcessors = {
  text: (value, { label, max, required }) => {
    const filled = value != null && String(value).trim() !== ''
    if (!filled) {
      if (required) throw new ApiError(400, `${label} es obligatorio.`)
      return null
    }
    const msg = lengthError(label, value, max)
    if (msg) throw new ApiError(400, msg)
    return String(value).trim()
  },
  dni: (value) => {
    if (!/^\d{8}$/.test(String(value ?? ''))) throw new ApiError(400, 'DNI inválido (8 dígitos).')
    return String(value)
  },
  password: (value) => {
    if (!value) return undefined
    const msg = passwordError(value)
    if (msg) throw new ApiError(400, msg)
    return String(value)
  },
  ciclo: (value) => {
    if (value === undefined || value === null) return undefined
    if (!isCiclo(value)) throw new ApiError(400, 'El ciclo debe estar entre 1 y 10.')
    return toCiclo(value)
  },
  ref: (value, { required = false }) => {
    if (value === undefined || value === null) {
      if (required) throw new ApiError(400, 'Valor de referencia obligatorio.')
      return null
    }
    if (!Number.isInteger(Number(value))) throw new ApiError(400, 'Valor de referencia inválido.')
    return Number(value)
  },
  estado: (value, { allowed, fallback }) => {
    if (value === undefined) return fallback
    if (!isInEnum(allowed, value)) throw new ApiError(400, 'Estado inválido.')
    return value
  },
  rol: (value, { allowed, fallback }) => {
    if (value === undefined) return fallback
    if (!isInEnum(allowed, value)) throw new ApiError(400, 'Rol inválido.')
    return value
  }
}

function buildValue(field, body) {
  const processor = fieldProcessors[field.type]
  return processor(body[field.key], field)
}

export function createCrud({ model, order = [], include, fields, notFound, beforeCreate, beforeUpdate, sanitize }) {
  const listOpts = { order }
  if (include) listOpts.include = include

  return {
    list: async (_req, res) => {
      try {
        const rows = await model.findAll({ ...listOpts })
        const data = sanitize ? rows.map(sanitize) : rows
        res.json({ success: true, data })
      } catch (err) {
        handleError(res, err)
      }
    },

    create: async (req, res) => {
      try {
        const values = {}
        for (const field of fields) {
          const value = buildValue(field, req.body)
          if (value !== undefined) values[field.key] = value
        }
        if (beforeCreate) await beforeCreate(req, values)
        const row = await model.create(values)
        const full = await model.findByPk(row.id, include ? { include } : undefined)
        res.status(201).json({ success: true, data: sanitize ? sanitize(full ?? row) : (full ?? row) })
      } catch (err) {
        handleError(res, err)
      }
    },

    update: async (req, res) => {
      try {
        const changes = {}
        for (const field of fields) {
          if (req.body[field.key] === undefined) continue
          const value = buildValue(field, req.body)
          if (value !== undefined) changes[field.key] = value
        }
        if (beforeUpdate) await beforeUpdate(req, changes)
        await model.update(changes, { where: { id: req.params.id } })
        const row = await model.findByPk(req.params.id, include ? { include } : undefined)
        if (!row) throw new ApiError(404, notFound)
        res.json({ success: true, data: sanitize ? sanitize(row) : row })
      } catch (err) {
        handleError(res, err)
      }
    },

    remove: async (req, res) => {
      try {
        const deleted = await model.destroy({ where: { id: req.params.id } })
        if (!deleted) throw new ApiError(404, notFound)
        res.json({ success: true })
      } catch (err) {
        handleError(res, err)
      }
    }
  }
}