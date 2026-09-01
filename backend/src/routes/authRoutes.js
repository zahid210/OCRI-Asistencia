import { Router } from 'express'
import { login, me } from '../controllers/authController.js'
import { authRequired } from '../middleware/authMiddleware.js'
import { loginRateLimit } from '../middleware/rateLimit.js'

const router = Router()

router.post('/login', loginRateLimit, login)
router.get('/me', authRequired, me)

export default router
