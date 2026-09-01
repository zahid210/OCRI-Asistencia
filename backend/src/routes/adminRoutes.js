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
  listAsistencias
} from '../controllers/adminController.js'
import { authRequired, requireAdmin } from '../middleware/authMiddleware.js'

const router = Router()

router.use(authRequired)
router.use(requireAdmin)

router.get('/practicantes', listPracticantes)
router.post('/practicantes', createPracticante)
router.put('/practicantes/:id', updatePracticante)
router.delete('/practicantes/:id', deletePracticante)

router.get('/facultades', listFacultades)
router.post('/facultades', createFacultad)
router.put('/facultades/:id', updateFacultad)
router.delete('/facultades/:id', deleteFacultad)

router.get('/trabajadores', listTrabajadores)
router.post('/trabajadores', createTrabajador)
router.put('/trabajadores/:id', updateTrabajador)
router.delete('/trabajadores/:id', deleteTrabajador)

router.get('/usuarios', listUsuarios)
router.post('/usuarios', createUsuario)
router.put('/usuarios/:id', updateUsuario)
router.delete('/usuarios/:id', deleteUsuario)

router.get('/asistencias/export', exportAsistencias)
router.get('/asistencias', listAsistencias)

export default router
