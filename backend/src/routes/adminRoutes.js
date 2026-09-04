import { Router } from 'express'
import {
  listPracticantes,
  createPracticante,
  updatePracticante,
  deletePracticante,
  listFacultades,
  createFacultad,
  updateFacultad,
  deleteFacultad,
  listTrabajadores,
  createTrabajador,
  updateTrabajador,
  deleteTrabajador,
  listUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  exportAsistencias,
  listAsistencias,
  historialPracticante,
  reportePracticante,
  updateAsistencia,
  listAuditorias,
  exportAuditorias,
  listAlertas
} from '../controllers/adminController.js'
import { authRequired, requireAdmin } from '../middleware/authMiddleware.js'
import { apiRateLimit } from '../middleware/rateLimit.js'
import { cacheMiddleware, cacheInvalidate } from '../services/cacheService.js'

const router = Router()

router.use(authRequired)
router.use(requireAdmin)

const invalPro = (_req, _res, next) => { cacheInvalidate('admin/practicantes'); next() }
const invalFac = (_req, _res, next) => { cacheInvalidate('admin/facultades'); next() }
const invalTra = (_req, _res, next) => { cacheInvalidate('admin/trabajadores'); next() }
const invalUsu = (_req, _res, next) => { cacheInvalidate('admin/usuarios'); next() }
const invalAsis = (_req, _res, next) => { cacheInvalidate('admin/asistencias'); next() }

const limitWrites = apiRateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: 'admin-w' })
const limitExports = apiRateLimit({ windowMs: 60 * 1000, max: 15, keyPrefix: 'admin-x' })

router.get('/practicantes', cacheMiddleware(), listPracticantes)
router.get('/practicantes/:id/historial', cacheMiddleware(), historialPracticante)
router.get('/practicantes/:id/reporte', limitExports, reportePracticante)
router.post('/practicantes', invalPro, createPracticante)
router.put('/practicantes/:id', invalPro, updatePracticante)
router.delete('/practicantes/:id', invalPro, deletePracticante)

router.get('/facultades', cacheMiddleware(), listFacultades)
router.post('/facultades', invalFac, createFacultad)
router.put('/facultades/:id', invalFac, updateFacultad)
router.delete('/facultades/:id', invalFac, deleteFacultad)

router.get('/trabajadores', cacheMiddleware(), listTrabajadores)
router.post('/trabajadores', invalTra, createTrabajador)
router.put('/trabajadores/:id', invalTra, updateTrabajador)
router.delete('/trabajadores/:id', invalTra, deleteTrabajador)

router.get('/usuarios', cacheMiddleware(), listUsuarios)
router.post('/usuarios', limitWrites, invalUsu, createUsuario)
router.put('/usuarios/:id', limitWrites, invalUsu, updateUsuario)
router.delete('/usuarios/:id', limitWrites, invalUsu, deleteUsuario)

router.get('/asistencias/export', limitExports, exportAsistencias)
router.get('/asistencias', cacheMiddleware(), listAsistencias)
router.put('/asistencias/:id', invalAsis, updateAsistencia)

router.get('/auditorias', listAuditorias)
router.get('/auditorias/export', limitExports, exportAuditorias)
router.get('/seguridad/alertas', limitExports, listAlertas)

export default router
