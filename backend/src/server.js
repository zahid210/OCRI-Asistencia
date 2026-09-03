import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import sequelize from './db.js'
import authRoutes from './routes/authRoutes.js'
import attendanceRoutes from './routes/attendanceRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import { LIMA_TZ } from './services/timeService.js'
import { runBootstrap } from './bootstrap.js'
import { scheduleAbsentJob } from './services/ausentesService.js'

const app = express()
const PORT = process.env.PORT || 3000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? undefined : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '10kb' }))

app.get('/api/health', async (_req, res) => {
  try {
    await sequelize.authenticate()
    res.json({ ok: true, timezone: LIMA_TZ })
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Database connection failed' })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api', attendanceRoutes)
app.use('/api/admin', adminRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada.' })
})

app.use(express.static(path.join(__dirname, '../../frontend/dist'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache')
    } else if (/[\\/]assets[\\/]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else if (/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|otf)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400')
    }
  }
}))

app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store')
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'))
})

try {
  const bootstrap = await runBootstrap()
  if (bootstrap.seeded) {
    console.log(
      `[bootstrap] Base de datos inicializada automáticamente: ` +
        `${bootstrap.facultades} facultades, ` +
        `${bootstrap.practicantes.created} practicantes, ` +
        `${bootstrap.asistencias.created} asistencias, ` +
        `${bootstrap.trabajadores} trabajadores, ` +
        `${bootstrap.usuarios.created} usuarios.`
    )
  } else {
    console.log(
      `[bootstrap] Base de datos lista (esquema existente${bootstrap.dbCreated ? ', BD creada' : ''}).`
    )
  }
} catch (err) {
  console.error('[bootstrap] No se pudo inicializar la base de datos:', err.message)
  process.exit(1)
}

app.listen(PORT, () => {
  console.log(`OCRI API ejecutándose en http://localhost:${PORT}`)
})

scheduleAbsentJob()
