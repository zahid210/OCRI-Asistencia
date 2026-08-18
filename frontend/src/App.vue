<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const dni = ref('')
const currentTime = ref('--:--')
const currentSeconds = ref('--')
const meridiem = ref('')
const notifications = ref([])
const submitting = ref(false)

let clockTimer
let shakeTimer
let notificationId = 0

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni: dni.value })
    })

    const data = await response.json()
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

    <section class="top-left-clock" aria-label="Hora actual de Lima">
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

    <img class="ocri-logo" src="/ocri-logo.png" alt="OCRI" />

    <section class="login-panel">
      <label class="dni-input-shell">
        <input
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