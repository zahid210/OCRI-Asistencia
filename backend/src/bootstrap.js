import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import sequelize, { Asistencia, Facultad, Practicante, Trabajador, Usuario } from './db.js'
import { createMigrator } from './migrate.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = process.env.SEED_DIR || path.join(__dirname, '../data')

export async function ensureDatabase() {
  try {
    await sequelize.authenticate()
    return { created: false }
  } catch (err) {
    if (err.parent?.code !== 'ER_BAD_DB_ERROR') throw err
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || ''
    })
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${sequelize.config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )
    await conn.end()
    await sequelize.authenticate()
    return { created: true }
  }
}

export async function runSeed() {
  const files = [
    'facultades.json',
    'practicantes.json',
    'asistencias.json',
    'trabajadores.json',
    'usuarios.json'
  ]

  const data = {}
  for (const file of files) {
    const filePath = path.join(dataDir, file)
    if (!existsSync(filePath)) throw new Error(`No se encontró el archivo de datos: ${filePath}`)
    data[file] = JSON.parse(readFileSync(filePath, 'utf8'))
  }

  const facultades = data['facultades.json']
  const practicantes = data['practicantes.json']
  const asistencias = data['asistencias.json']
  const trabajadores = data['trabajadores.json']
  const usuarios = data['usuarios.json']

  let createdFacultades = 0
  const facultadIdByName = new Map()

  for (const f of facultades) {
    const [row, isNew] = await Facultad.findOrCreate({
      where: { nombre: f.nombre },
      defaults: {
        nombre: f.nombre,
        abreviatura: f.abreviatura ?? null,
        estado: f.estado || 'ACTIVO'
      }
    })

    facultadIdByName.set(row.nombre, row.id)
    if (isNew) createdFacultades++
  }

  let created = 0
  let skipped = 0
  const practicanteByDni = new Map()

  for (const p of practicantes) {
    const facultadId = p.facultad
      ? facultadIdByName.get(p.facultad)
      : p.facultad_id

    if (!facultadId) {
      console.error(`No se encontró la facultad para el practicante ${p.dni} (${p.nombre}).`)
      continue
    }

    const [row, isNew] = await Practicante.findOrCreate({
      where: { dni: String(p.dni) },
      defaults: {
        dni: String(p.dni),
        nombre: p.nombre,
        apellidos: p.apellidos,
        codigo_alumno: String(p.codigo_alumno),
        facultad_id: facultadId,
        ciclo: p.ciclo ?? null,
        estado: p.estado || 'ACTIVO'
      }
    })

    practicanteByDni.set(String(row.dni), row.id)
    if (isNew) created++
    else skipped++
  }

  let createdAsistencias = 0
  let skippedAsistencias = 0

  for (const a of asistencias) {
    const practicanteId = practicanteByDni.get(String(a.dni))

    if (!practicanteId) {
      console.error(`No se encontró el practicante para la asistencia (${a.dni}).`)
      continue
    }

    const [, isNew] = await Asistencia.findOrCreate({
      where: { practicante_id: practicanteId, fecha: a.fecha },
      defaults: {
        practicante_id: practicanteId,
        fecha: a.fecha,
        hora_entrada: a.hora_entrada ?? null,
        hora_salida: a.hora_salida ?? null,
        estado: a.estado || 'PENDIENTE',
        observacion: a.observacion ?? null
      }
    })

    if (isNew) createdAsistencias++
    else skippedAsistencias++
  }

  let createdTrabajadores = 0
  const trabajadorByDni = new Map()

  for (const t of trabajadores) {
    const [row, isNew] = await Trabajador.findOrCreate({
      where: { dni: String(t.dni) },
      defaults: {
        dni: String(t.dni),
        nombre: t.nombre,
        apellidos: t.apellidos,
        codigo_trabajador: t.codigo_trabajador ?? null,
        cargo: t.cargo ?? null,
        area: t.area ?? null,
        estado: t.estado || 'ACTIVO'
      }
    })

    trabajadorByDni.set(row.dni, row.id)
    if (isNew) createdTrabajadores++
  }

  let createdUsuarios = 0
  let skippedUsuarios = 0

  for (const u of usuarios) {
    const trabajadorId = u.trabajador_dni
      ? trabajadorByDni.get(String(u.trabajador_dni))
      : null

    const password =
      u.usuario === 'admin' && process.env.ADMIN_PASSWORD
        ? process.env.ADMIN_PASSWORD
        : u.password

    const [, isNew] = await Usuario.findOrCreate({
      where: { usuario: u.usuario },
      defaults: {
        trabajador_id: trabajadorId,
        usuario: u.usuario,
        password_hash: await bcrypt.hash(password, 10),
        rol: u.rol || 'SUPERVISOR',
        estado: u.estado || 'ACTIVO'
      }
    })

    if (isNew) createdUsuarios++
    else skippedUsuarios++
  }

  return {
    facultades: createdFacultades,
    practicantes: { created, skipped },
    asistencias: { created: createdAsistencias, skipped: skippedAsistencias },
    trabajadores: createdTrabajadores,
    usuarios: { created: createdUsuarios, skipped: skippedUsuarios }
  }
}

export async function runBootstrap() {
  const db = await ensureDatabase()

  await createMigrator().up()

  const hasData = (await Facultad.count()) > 0 || (await Practicante.count()) > 0
  if (hasData) {
    return { dbCreated: db.created, seeded: false }
  }

  const seed = await runSeed()
  return { dbCreated: db.created, seeded: true, ...seed }
}