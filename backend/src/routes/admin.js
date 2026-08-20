import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { Facultad, Practicante, Trabajador, Usuario } from '../db.js'

const router = Router()

function handleError(res, err) {
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

  console.error(err)
  return res.status(500).json({ message: 'Error interno del servidor.' })
}

const validDni = (dni) => /^\d{8}$/.test(String(dni ?? ''))

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

router.get('/practicantes', async (_req, res) => {
  try {
    const rows = await Practicante.findAll({
      include: [{ model: Facultad }],
      order: [['apellidos', 'ASC'], ['nombre', 'ASC']]
    })
    res.json({ success: true, data: rows })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/practicantes', async (req, res) => {
  const { dni, nombre, apellidos, codigo_alumno, facultad_id, ciclo, estado } = req.body ?? {}

  if (!validDni(dni)) {
    return res.status(400).json({ message: 'DNI inválido (8 dígitos).' })
  }
  if (!nombre || !apellidos || !codigo_alumno || !facultad_id) {
    return res.status(400).json({ message: 'Complete los campos obligatorios.' })
  }

  try {
    const row = await Practicante.create({
      dni,
      nombre,
      apellidos,
      codigo_alumno,
      facultad_id,
      ciclo: ciclo ?? null,
      estado: estado || 'ACTIVO'
    })
    res.status(201).json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
})

router.put('/practicantes/:id', async (req, res) => {
  const { dni, nombre, apellidos, codigo_alumno, facultad_id, ciclo, estado } = req.body ?? {}

  if (dni != null && !validDni(dni)) {
    return res.status(400).json({ message: 'DNI inválido (8 dígitos).' })
  }

  try {
    await Practicante.update(
      { dni, nombre, apellidos, codigo_alumno, facultad_id, ciclo, estado },
      { where: { id: req.params.id } }
    )
    const row = await Practicante.findByPk(req.params.id, { include: [{ model: Facultad }] })
    res.json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
})

router.delete('/practicantes/:id', async (req, res) => {
  try {
    await Practicante.destroy({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
})

/* ------------------------- Facultades ------------------------- */

router.get('/facultades', async (_req, res) => {
  try {
    const rows = await Facultad.findAll({ order: [['nombre', 'ASC']] })
    res.json({ success: true, data: rows })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/facultades', async (req, res) => {
  const { nombre, abreviatura, estado } = req.body ?? {}

  if (!nombre) {
    return res.status(400).json({ message: 'El nombre es obligatorio.' })
  }

  try {
    const row = await Facultad.create({
      nombre,
      abreviatura: abreviatura ?? null,
      estado: estado || 'ACTIVO'
    })
    res.status(201).json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
})

router.put('/facultades/:id', async (req, res) => {
  const { nombre, abreviatura, estado } = req.body ?? {}

  try {
    await Facultad.update(
      { nombre, abreviatura, estado },
      { where: { id: req.params.id } }
    )
    const row = await Facultad.findByPk(req.params.id)
    res.json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
})

router.delete('/facultades/:id', async (req, res) => {
  try {
    await Facultad.destroy({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
})

/* ------------------------- Trabajadores ------------------------- */

router.get('/trabajadores', async (_req, res) => {
  try {
    const rows = await Trabajador.findAll({ order: [['apellidos', 'ASC'], ['nombre', 'ASC']] })
    res.json({ success: true, data: rows })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/trabajadores', async (req, res) => {
  const { dni, nombre, apellidos, codigo_trabajador, cargo, area, estado } = req.body ?? {}

  if (!validDni(dni)) {
    return res.status(400).json({ message: 'DNI inválido (8 dígitos).' })
  }
  if (!nombre || !apellidos) {
    return res.status(400).json({ message: 'Complete los campos obligatorios.' })
  }

  try {
    const row = await Trabajador.create({
      dni,
      nombre,
      apellidos,
      codigo_trabajador: codigo_trabajador ?? null,
      cargo: cargo ?? null,
      area: area ?? null,
      estado: estado || 'ACTIVO'
    })
    res.status(201).json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
})

router.put('/trabajadores/:id', async (req, res) => {
  const { dni, nombre, apellidos, codigo_trabajador, cargo, area, estado } = req.body ?? {}

  if (dni != null && !validDni(dni)) {
    return res.status(400).json({ message: 'DNI inválido (8 dígitos).' })
  }

  try {
    await Trabajador.update(
      { dni, nombre, apellidos, codigo_trabajador, cargo, area, estado },
      { where: { id: req.params.id } }
    )
    const row = await Trabajador.findByPk(req.params.id)
    res.json({ success: true, data: row })
  } catch (err) {
    handleError(res, err)
  }
})

router.delete('/trabajadores/:id', async (req, res) => {
  try {
    await Trabajador.destroy({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
})

/* ------------------------- Usuarios ------------------------- */

router.get('/usuarios', async (_req, res) => {
  try {
    const rows = await Usuario.findAll({
      include: [{ model: Trabajador }],
      order: [['usuario', 'ASC']]
    })
    res.json({ success: true, data: rows.map(sanitizeUsuario) })
  } catch (err) {
    handleError(res, err)
  }
})

router.post('/usuarios', async (req, res) => {
  const { usuario, password, trabajador_id, rol, estado } = req.body ?? {}

  if (!usuario || !password) {
    return res.status(400).json({ message: 'Usuario y contraseña son obligatorios.' })
  }

  try {
    const row = await Usuario.create({
      usuario,
      password_hash: await bcrypt.hash(password, 10),
      trabajador_id: trabajador_id ?? null,
      rol: rol || 'SUPERVISOR',
      estado: estado || 'ACTIVO'
    })
    const created = await Usuario.findByPk(row.id, { include: [{ model: Trabajador }] })
    res.status(201).json({ success: true, data: sanitizeUsuario(created) })
  } catch (err) {
    handleError(res, err)
  }
})

router.put('/usuarios/:id', async (req, res) => {
  const { usuario, password, trabajador_id, rol, estado } = req.body ?? {}

  try {
    const changes = { usuario, trabajador_id, rol, estado }
    if (password) changes.password_hash = await bcrypt.hash(password, 10)

    await Usuario.update(changes, { where: { id: req.params.id } })
    const row = await Usuario.findByPk(req.params.id, { include: [{ model: Trabajador }] })
    res.json({ success: true, data: sanitizeUsuario(row) })
  } catch (err) {
    handleError(res, err)
  }
})

router.delete('/usuarios/:id', async (req, res) => {
  try {
    await Usuario.destroy({ where: { id: req.params.id } })
    res.json({ success: true })
  } catch (err) {
    handleError(res, err)
  }
})

export default router