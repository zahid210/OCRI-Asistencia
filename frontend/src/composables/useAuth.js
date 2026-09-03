import { ref } from 'vue'

const TOKEN_KEY = 'ocri_token'
const user = ref(null)
const authLoading = ref(true)
const loginUsuario = ref('')
const loginPassword = ref('')
const loginError = ref('')
const loginSubmitting = ref(false)

export function useAuth() {
  function authHeaders() {
    const token = localStorage.getItem(TOKEN_KEY)
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function restoreSession() {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      authLoading.value = false
      return
    }
    try {
      const response = await fetch('/api/auth/me', { headers: authHeaders() })
      const data = await response.json()
      if (!response.ok || !data.success) {
        localStorage.removeItem(TOKEN_KEY)
      } else {
        user.value = data.user
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY)
    } finally {
      authLoading.value = false
    }
  }

  async function login() {
    if (loginSubmitting.value) return false

    loginError.value = ''

    loginSubmitting.value = true

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: loginUsuario.value.trim(),
          password: loginPassword.value
        })
      })

      const data = await response.json()

      if (response.status === 401) {
        loginError.value = data.message || 'Credenciales inválidas.'
        return false
      }

      if (!response.ok) throw new Error(data.message || 'No se pudo iniciar sesión')

      localStorage.setItem(TOKEN_KEY, data.token)
      user.value = data.user
      loginUsuario.value = ''
      loginPassword.value = ''
      return true
    } catch (error) {
      loginError.value = error.message || 'No se pudo iniciar sesión.'
      return false
    } finally {
      loginSubmitting.value = false
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    user.value = null
    loginError.value = ''
    loginPassword.value = ''
  }

  return {
    user,
    authLoading,
    loginUsuario,
    loginPassword,
    loginError,
    loginSubmitting,
    authHeaders,
    restoreSession,
    login,
    logout
  }
}
