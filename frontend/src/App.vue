<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AdminPanel from './components/AdminPanel.vue'

const TOKEN_KEY = 'ocri_token'

const dni = ref('')
const currentTime = ref('--:--')
const currentSeconds = ref('--')
const meridiem = ref('')
const notifications = ref([])
const submitting = ref(false)

const user = ref(null)
const view = ref('attendance')
const authLoading = ref(true)
const loginUsuario = ref('')
const loginPassword = ref('')
const loginError = ref('')
const loginSubmitting = ref(false)

const dniInput = ref(null)
const usuarioInput = ref(null)
const usuarioField = ref(null)
const passwordField = ref(null)

let clockTimer
let shakeTimer
let notificationId = 0

function shakeField(el) {
  if (!el) return
  el.classList.remove('shake')
  void el.offsetWidth
  el.classList.add('shake')
  setTimeout(() => el.classList.remove('shake'), 550)
}

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
  if (loginSubmitting.value) return

  loginError.value = ''

  const usuarioFilled = Boolean(loginUsuario.value.trim())
  const passwordFilled = Boolean(loginPassword.value)

  if (!usuarioFilled) shakeField(usuarioField.value)
  if (!passwordFilled) shakeField(passwordField.value)
  if (!usuarioFilled || !passwordFilled) return

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
      shakeField(usuarioField.value)
      shakeField(passwordField.value)
      loginError.value = data.message || 'Credenciales inválidas.'
      return
    }

    if (!response.ok) throw new Error(data.message || 'No se pudo iniciar sesión')

    localStorage.setItem(TOKEN_KEY, data.token)
    user.value = data.user
    loginUsuario.value = ''
    loginPassword.value = ''
  } catch (error) {
    loginError.value = error.message || 'No se pudo iniciar sesión.'
  } finally {
    loginSubmitting.value = false
  }
}

function logout() {
  localStorage.removeItem(TOKEN_KEY)
  user.value = null
  view.value = 'attendance'
  dni.value = ''
  loginError.value = ''
  loginPassword.value = ''
}

watch(user, async (value) => {
  await nextTick()
  if (value) {
    dniInput.value?.focus()
  } else {
    usuarioInput.value?.focus()
  }
})

function pushNotification({ title, name, dni: dniText, detail = '', error = false }) {
  const id = ++notificationId
  const item = { id, title, name, dni: dniText, detail, error }
  notifications.value.push(item)
  setTimeout(() => {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }, 3600)
}

const dots = computed(() =>
  Array.from({ length: 8 }, (_, index) => index < dni.value.length)
)

const hourAngle = ref(0)
const minuteAngle = ref(0)
const secondAngle = ref(0)
const clockReady = ref(false)

let prevRawTime = null
let runningSeconds = 0
let syncDelay = 1000
let syncCount = 0

function updateClockHands() {
  const [h = 0, m = 0] = currentTime.value.split(':').map((n) => Number(n) || 0)
  const s = Number(currentSeconds.value) || 0

  let raw = h * 3600 + m * 60 + s
  if (prevRawTime === null) {
    runningSeconds = raw
  } else {
    if (raw < prevRawTime) raw += 86400
    runningSeconds += raw - prevRawTime
  }
  prevRawTime = raw

  secondAngle.value = runningSeconds * 6
  minuteAngle.value = runningSeconds * 0.1
  hourAngle.value = runningSeconds / 120

  syncCount += 1
  if (syncCount >= 2) clockReady.value = true
}

async function syncTime() {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000)
    const response = await fetch('/api/time', {
      cache: 'no-store',
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error()
    const data = await response.json()
    currentTime.value = data.time
    currentSeconds.value = data.seconds ?? '--'
    meridiem.value = data.meridiem
    syncDelay = 1000
  } catch {
    const parts = new Intl.DateTimeFormat('es-PE', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(new Date())

    const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
    let hour = get('hour')
    if (hour === '24') hour = '00'
    currentTime.value = `${hour}:${get('minute')}`
    currentSeconds.value = get('second')
    syncDelay = Math.min(syncDelay * 2, 10000)
  }

  updateClockHands()
  clockTimer = setTimeout(syncTime, syncDelay)
}

async function registerAttendance() {
  if (submitting.value || dni.value.length !== 8) return

  submitting.value = true

  try {
    const response = await fetch('/api/attendance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders()
      },
      body: JSON.stringify({ dni: dni.value })
    })

    const data = await response.json()

    if (response.status === 401) {
      logout()
      pushNotification({
        title: 'Sesión expirada',
        name: 'Vuelva a iniciar sesión.',
        dni: '',
        error: true
      })
      return
    }

    if (!response.ok) throw new Error(data.message || 'No se pudo registrar')

    const isExit = data.code === 'ATTENDANCE_COMPLETED'
    pushNotification({
      title: isExit ? 'Salida registrada' : 'Asistencia',
      name: `${data.practitioner.nombre} ${data.practitioner.apellidos}`.trim(),
      dni: data.practitioner.dni
    })

    dni.value = ''
    await syncTime()
  } catch (error) {
    pushNotification({
      title: 'Aviso',
      name: error.message || 'No se pudo registrar la asistencia.',
      dni: '',
      error: true
    })

    dni.value = ''
  } finally {
    submitting.value = false
  }
}

function onInput(event) {
  dni.value = event.target.value.replace(/\D/g, '').slice(0, 8)
}

function onKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault()
    if (dni.value.length !== 8) {
      startShake()
      dni.value = ''
      return
    }
    registerAttendance()
    return
  }

  if (event.ctrlKey || event.metaKey || event.altKey) return

  if (event.key.length === 1 && !/\d/.test(event.key)) {
    event.preventDefault()
  }
}

function onPaste(event) {
  event.preventDefault()
  const text = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '')
  dni.value = (dni.value + text).slice(0, 8)
}

function startShake() {
  const shell = document.querySelector('.dni-input-shell')
  if (!shell) return
  clearTimeout(shakeTimer)
  shell.classList.remove('shake')
  void shell.offsetWidth
  shell.classList.add('shake')
  shakeTimer = setTimeout(() => shell.classList.remove('shake'), 550)
}

onMounted(() => {
  restoreSession()
  syncTime()
})

onBeforeUnmount(() => {
  clearTimeout(clockTimer)
  clearTimeout(shakeTimer)
})
</script>

<template>
  <main class="attendance-screen">
    <div class="background" aria-hidden="true"></div>
    <div class="shade" aria-hidden="true"></div>

    <section
      v-if="user && view === 'attendance'"
      class="top-left-clock"
      aria-label="Hora actual de Lima"
    >
      <div
        class="clock-face"
        :class="{ 'is-ready': clockReady }"
        :style="{
          '--hour-angle': hourAngle + 'deg',
          '--minute-angle': minuteAngle + 'deg',
          '--second-angle': secondAngle + 'deg'
        }"
      >
        <span class="clock-hand clock-hand-hour"></span>
        <span class="clock-hand clock-hand-minute"></span>
        <span class="clock-hand clock-hand-second"></span>
        <span class="clock-center"></span>
      </div>

      <div class="digital-time">
        <span class="time-main">{{ currentTime }}</span>
        <span class="time-seconds">:{{ currentSeconds }}</span>
        <small>{{ meridiem }}</small>
      </div>
    </section>

    <img
      v-if="user && view === 'attendance'"
      class="ocri-logo"
      src="/ocri-logo.png"
      alt="OCRI"
    />

    <template v-if="!authLoading">
      <section v-if="user && view === 'attendance'" class="login-panel">
        <label class="dni-input-shell">
          <input
            ref="dniInput"
            :value="dni"
            inputmode="numeric"
            autocomplete="off"
            maxlength="8"
            autofocus
            @input="onInput"
            @keydown="onKeydown"
            @paste="onPaste"
          />
        </label>

        <div class="dots" aria-hidden="true">
          <span
            v-for="(active, index) in dots"
            :key="index"
            class="dot"
            :class="{ active }"
          />
        </div>
      </section>

      <form v-else-if="!user" class="login-form" @submit.prevent="login">
        <h1 class="login-title">Iniciar sesión</h1>

        <label ref="usuarioField" class="login-field">
          <span class="login-field-label">Usuario</span>
          <input
            ref="usuarioInput"
            v-model="loginUsuario"
            type="text"
            autocomplete="username"
            spellcheck="false"
          />
        </label>

        <label ref="passwordField" class="login-field">
          <span class="login-field-label">Contraseña</span>
          <input
            v-model="loginPassword"
            type="password"
            autocomplete="current-password"
          />
        </label>

        <p v-if="loginError" class="login-error">{{ loginError }}</p>

        <button class="login-button" type="submit" :disabled="loginSubmitting">
          {{ loginSubmitting ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
    </template>

    <AdminPanel v-if="user && view === 'admin'" />

    <div v-if="user" class="session-bar">
      <div class="session-group">
        <div v-if="user.rol === 'ADMIN'" class="view-switcher">
          <button
            type="button"
            class="view-switch-btn"
            :class="{ active: view === 'attendance' }"
            @click="view = 'attendance'"
          >
            Asistencia
          </button>
          <button
            type="button"
            class="view-switch-btn"
            :class="{ active: view === 'admin' }"
            @click="view = 'admin'"
          >
            Panel
          </button>
        </div>
        <span class="session-user">
          {{ user.trabajador?.nombre }} {{ user.trabajador?.apellidos }}
        </span>
      </div>
      <button class="logout-button" type="button" @click="logout">
        Cerrar sesión
      </button>
    </div>

    <TransitionGroup name="toast" tag="div" class="toast-stack">
      <aside v-for="n in notifications" :key="n.id" class="glass-notification">
        <div class="notification-header">
          <span>{{ n.title }}</span>
          <span class="check">{{ n.error ? '✕' : '✓' }}</span>
        </div>
        <div class="notification-body">
          <div class="notification-name">{{ n.name }}</div>
          <div class="notification-dni">{{ n.dni }}</div>
          <div v-if="n.detail" class="notification-detail">
            {{ n.detail }}
          </div>
        </div>
      </aside>
    </TransitionGroup>
  </main>
</template>