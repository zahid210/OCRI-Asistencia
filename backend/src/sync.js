import 'dotenv/config'
import sequelize from './db.js'

const mode = process.argv[2] === 'force' ? { force: true } : {}

try {
  await sequelize.sync(mode)
  console.log('Esquema sincronizado correctamente.')
} catch (err) {
  console.error('Error sincronizando el esquema:', err)
  process.exitCode = 1
} finally {
  await sequelize.close()
}