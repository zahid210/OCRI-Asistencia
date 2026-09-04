import 'dotenv/config'
import sequelize from './db.js'
import { createMigrator } from './migrate.js'

const force = process.argv[2] === 'force'

try {
  if (force) {
    const undone = await createMigrator().down({ to: 0 })
    console.log(`Esquema restablecido: ${undone.length} migración(es) revertida(s).`)
  }
  const applied = await createMigrator().up()
  console.log(`Esquema sincronizado: ${applied.length} migración(es) aplicada(s).`)
} catch (err) {
  console.error('Error sincronizando el esquema:', err)
  process.exitCode = 1
} finally {
  await sequelize.close()
}