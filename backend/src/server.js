import 'dotenv/config'
import express from 'express'
import helmet from 'helmet'
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
const IS_PROD = process.env.NODE_ENV === 'production'

app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false)

function isOriginAllowed(origin, host) {
  if (!origin) return true

  let originUrl
  try {
    originUrl = new URL(origin)
  } catch {
    return false
  }

  const hostName = String(host || '').split(':')[0].toLowerCase()
  if (originUrl.hostname.toLowerCase() === hostName) return true

  if (
    (hostName === 'localhost' || hostName === '127.0.0.1') &&
    (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')
  ) {
    return true
  }

  const configured = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return configured.includes(origin)
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: IS_PROD ? [] : null
    }
  },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  hsts: IS_PROD ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
}))

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && isOriginAllowed(origin, req.get('host'))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204)
    }
  }
  next()
})

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
