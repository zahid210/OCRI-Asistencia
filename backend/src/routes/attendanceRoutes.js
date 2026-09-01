import { Router } from 'express'
import { time, attendance } from '../controllers/attendanceController.js'
import { authRequired } from '../middleware/authMiddleware.js'

const router = Router()

router.get('/time', time)
router.post('/attendance', authRequired, attendance)

export default router
