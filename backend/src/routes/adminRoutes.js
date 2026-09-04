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
  updateAsistencia
} from '../controllers/adminController.js'
import { authRequired, requireAdmin } from '../middleware/authMiddleware.js'
import { cacheMiddleware, cacheInvalidate } from '../services/cacheService.js'

const router = Router()

router.use(authRequired)
router.use(requireAdmin)

const invalPro = (_req, _res, next) => { cacheInvalidate('admin/practicantes'); next() }
const invalFac = (_req, _res, next) => { cacheInvalidate('admin/facultades'); next() }
const invalTra = (_req, _res, next) => { cacheInvalidate('admin/trabajadores'); next() }
const invalUsu = (_req, _res, next) => { cacheInvalidate('admin/usuarios'); next() }
const invalAsis = (_req, _res, next) => { cacheInvalidate('admin/asistencias'); next() }

router.get('/practicantes', cacheMiddleware(), listPracticantes)
router.get('/practicantes/:id/historial', cacheMiddleware(), historialPracticante)
router.get('/practicantes/:id/reporte', reportePracticante)
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
router.post('/usuarios', invalUsu, createUsuario)
router.put('/usuarios/:id', invalUsu, updateUsuario)
router.delete('/usuarios/:id', invalUsu, deleteUsuario)

router.get('/asistencias/export', exportAsistencias)
router.get('/asistencias', cacheMiddleware(), listAsistencias)
router.put('/asistencias/:id', invalAsis, updateAsistencia)

export default router
