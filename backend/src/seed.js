import 'dotenv/config'
import sequelize from './db.js'
import { ensureDatabase, runSeed } from './bootstrap.js'
import { createMigrator } from './migrate.js'

try {
  await ensureDatabase()
  await createMigrator().up()
  const r = await runSeed()
  console.log(
    `Seed completado: ${r.facultades} facultades, ` +
      `${r.practicantes.created} practicantes (${r.practicantes.skipped} ya existentes), ` +
      `${r.asistencias.created} asistencias (${r.asistencias.skipped} ya existentes), ` +
      `${r.trabajadores} trabajadores, ` +
      `${r.usuarios.created} usuarios (${r.usuarios.skipped} ya existentes).`
  )
} catch (err) {
  console.error('Error en el seed:', err.message)
  process.exitCode = 1
} finally {
  await sequelize.close()
}