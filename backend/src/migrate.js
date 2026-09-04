import 'dotenv/config'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Umzug, SequelizeStorage } from 'umzug'
import { Sequelize } from 'sequelize'
import sequelize from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const migrationsPath = path.join(__dirname, 'migrations')

export function createMigrator() {
  const require = createRequire(import.meta.url)
  return new Umzug({
    migrations: {
      glob: path.posix.join(migrationsPath, '*.cjs'),
      resolve: ({ name, path: filePath, context }) => {
        const migration = require(filePath)
        return {
          name,
          up: () => migration.up(context, Sequelize, sequelize),
          down: () => migration.down(context, Sequelize, sequelize)
        }
      }
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console
  })
}

export const migrator = createMigrator()

const isEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntrypoint) {
  const mode = process.argv[2] || 'up'
  try {
    if (mode === 'up') {
      const result = await migrator.up()
      console.log(`Migraciones aplicadas: ${result.length} pendiente(s).`)
    } else if (mode === 'down') {
      const result = await migrator.down()
      console.log(`Migraciones revertidas: ${result.length}.`)
    } else if (mode === 'force') {
      const undone = await migrator.down({ to: 0 })
      const applied = await migrator.up()
      console.log(
        `Esquema reseteado: ${undone.length} revertida(s), ${applied.length} aplicada(s).`
      )
    } else if (mode === 'pending') {
      const pending = await migrator.pending()
      console.log(
        pending.length
          ? `Migraciones pendientes: ${pending.map((m) => m.name).join(', ')}`
          : 'No hay migraciones pendientes.'
      )
    } else {
      console.error('Uso: node src/migrate.js [up|down|force|pending]')
      process.exitCode = 1
    }
  } catch (err) {
    console.error('Error ejecutando migraciones:', err)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}