import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'
import sequelize, { Facultad, Practicante } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = process.env.SEED_DIR || path.join(__dirname, '../data')
const facultadesFile = path.join(dataDir, 'facultades.json')
const practicantesFile = path.join(dataDir, 'practicantes.json')

for (const file of [facultadesFile, practicantesFile]) {
  if (!existsSync(file)) {
    console.error(`No se encontró el archivo de datos: ${file}`)
    process.exit(1)
  }
}

const facultades = JSON.parse(readFileSync(facultadesFile, 'utf8'))
const practicantes = JSON.parse(readFileSync(practicantesFile, 'utf8'))

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

for (const p of practicantes) {
  const facultadId = p.facultad
    ? facultadIdByName.get(p.facultad)
    : p.facultad_id

  if (!facultadId) {
    console.error(`No se encontró la facultad para el practicante ${p.dni} (${p.nombre}).`)
    continue
  }

  const [, isNew] = await Practicante.findOrCreate({
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

  if (isNew) created++
  else skipped++
}

console.log(
  `Seed completado: ${createdFacultades} facultades creadas, ` +
    `${created} practicantes creados, ${skipped} ya existentes.`
)

await sequelize.close()