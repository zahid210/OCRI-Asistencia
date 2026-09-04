<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AdminCrudTable from './admin/AdminCrudTable.vue'
import AdminFormModal from './admin/AdminFormModal.vue'
import AdminAsistFilters from './admin/AdminAsistFilters.vue'

const props = defineProps({
  currentUser: { type: Object, default: null }
})

const emit = defineEmits(['session-expired'])

const TOKEN_KEY = 'ocri_token'

const _cache = new Map()
const _CACHE_TTL = 30_000

const tabs = [
  { key: 'practicantes', label: 'Practicantes' },
  { key: 'asistencias', label: 'Asistencias' },
  { key: 'facultades', label: 'Facultades' },
  { key: 'trabajadores', label: 'Trabajadores' },
  { key: 'usuarios', label: 'Usuarios' }
]

const CRUD_TABS = ['practicantes', 'facultades', 'trabajadores', 'usuarios']

function formatFecha(value) {
  if (!value) return '—'
  const [y, m, d] = String(value).split('-')
  if (!y || !m || !d) return value
  return `${Number(d)}/${Number(m)}/${y}`
}

const ESTADO_TRANSICIONES = {
  AUSENTE: ['AUSENTE', 'JUSTIFICADA'],
  JUSTIFICADA: ['AUSENTE', 'JUSTIFICADA'],
  COMPLETA: ['COMPLETA'],
  PENDIENTE: []
}

function estadoOptions(estadoActual) {
  return ESTADO_TRANSICIONES[estadoActual] ?? [estadoActual]
}

const columns = {
  practicantes: [
    { key: 'dni', label: 'DNI' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'apellidos', label: 'Apellidos' },
    { key: 'codigo_alumno', label: 'Código' },
    { key: 'facultad', label: 'Facultad', render: (r) => r.Facultad?.nombre || '—' },
    { key: 'ciclo', label: 'Ciclo' },
    { key: 'estado', label: 'Estado' }
  ],
  asistencias: [
    { key: 'fecha', label: 'Fecha', render: (r) => formatFecha(r.fecha) },
    {
      key: 'practicante',
      label: 'Practicante',
      render: (r) =>
        r.Practicante
          ? `${r.Practicante.apellidos}, ${r.Practicante.nombre}`
          : '—'
    },
    { key: 'dni', label: 'DNI', render: (r) => r.Practicante?.dni ?? '—' },
    {
      key: 'facultad',
      label: 'Facultad',
      render: (r) => r.Practicante?.Facultad?.nombre ?? '—'
    },
    { key: 'ciclo', label: 'Ciclo', render: (r) => r.Practicante?.ciclo ?? '—' },
    { key: 'hora_entrada', label: 'Entrada' },
    { key: 'hora_salida', label: 'Salida' },
    { key: 'estado', label: 'Estado' }
  ],
  facultades: [
    { key: 'nombre', label: 'Nombre' },
    { key: 'abreviatura', label: 'Abreviatura' },
    { key: 'estado', label: 'Estado' }
  ],
  trabajadores: [
    { key: 'dni', label: 'DNI' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'apellidos', label: 'Apellidos' },
    { key: 'codigo_trabajador', label: 'Código' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'area', label: 'Área' },
    { key: 'estado', label: 'Estado' }
  ],
  usuarios: [
    { key: 'usuario', label: 'Usuario' },
    { key: 'rol', label: 'Rol' },
    {
      key: 'trabajador',
      label: 'Trabajador',
      render: (r) =>
        r.Trabajador ? `${r.Trabajador.nombre} ${r.Trabajador.apellidos}` : '—'
    },
    { key: 'estado', label: 'Estado' },
    {
      key: 'ultimo_acceso',
      label: 'Último acceso',
      render: (r) =>
        r.ultimo_acceso
          ? new Date(r.ultimo_acceso).toLocaleString('es-PE')
          : '—'
    }
  ]
}

const fieldConfigs = {
  practicantes: [
    { key: 'dni', label: 'DNI', type: 'text', required: true, maxlength: 8, numeric: true },
    { key: 'nombre', label: 'Nombre', type: 'text', required: true, maxlength: 100 },
    { key: 'apellidos', label: 'Apellidos', type: 'text', required: true, maxlength: 150 },
    { key: 'codigo_alumno', label: 'Código de alumno', type: 'text', required: true, maxlength: 11 },
    { key: 'facultad_id', label: 'Facultad', type: 'select', options: 'facultades', required: true },
    { key: 'ciclo', label: 'Ciclo', type: 'number', min: 1, max: 10 },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: ['ACTIVO', 'INACTIVO', 'EGRESADO', 'RETIRADO']
    }
  ],
  asistencias: [
    { key: 'hora_entrada', label: 'Hora de entrada', type: 'time' },
    { key: 'hora_salida', label: 'Hora de salida', type: 'time' },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: ['PENDIENTE', 'COMPLETA', 'AUSENTE', 'JUSTIFICADA']
    },
    { key: 'observacion', label: 'Observación', type: 'textarea', maxlength: 500 }
  ],
  facultades: [
    { key: 'nombre', label: 'Nombre', type: 'text', required: true, maxlength: 150 },
    { key: 'abreviatura', label: 'Abreviatura', type: 'text', maxlength: 20 },
    { key: 'estado', label: 'Estado', type: 'select', options: ['ACTIVO', 'INACTIVO'] }
  ],
  trabajadores: [
    { key: 'dni', label: 'DNI', type: 'text', required: true, maxlength: 8, numeric: true },
    { key: 'nombre', label: 'Nombre', type: 'text', required: true, maxlength: 100 },
    { key: 'apellidos', label: 'Apellidos', type: 'text', required: true, maxlength: 150 },
    { key: 'codigo_trabajador', label: 'Código de trabajador', type: 'text', maxlength: 30 },
    { key: 'cargo', label: 'Cargo', type: 'text', maxlength: 100 },
    { key: 'area', label: 'Área', type: 'text', maxlength: 150 },
    { key: 'estado', label: 'Estado', type: 'select', options: ['ACTIVO', 'INACTIVO'] }
  ],
  usuarios: [
    { key: 'usuario', label: 'Usuario', type: 'text', required: true, maxlength: 50 },
    { key: 'password', label: 'Contraseña', type: 'password', required: true, editOptional: true, min: 6, maxlength: 72 },
    { key: 'trabajador_id', label: 'Trabajador', type: 'select', options: 'trabajadores', allowEmpty: true },
    { key: 'rol', label: 'Rol', type: 'select', options: ['ADMIN', 'COORDINADOR', 'SUPERVISOR'] },
    { key: 'estado', label: 'Estado', type: 'select', options: ['ACTIVO', 'INACTIVO'] }
  ]
}

const activeTab = ref('practicantes')
const loading = ref(false)
const error = ref('')

const lists = ref({
  practicantes: [],
  asistencias: [],
  facultades: [],
  trabajadores: [],
  usuarios: []
})

const asistFiltros = ref({
  fecha: '',
  facultad_id: '',
  estado: '',
  dni: ''
})
const asistPage = ref(1)
const asistTotal = ref(0)
const asistPages = ref(1)
const asistExporting = ref(false)

const practicanteBusqueda = ref('')
const historialOpen = ref(false)
const historialPracticante = ref(null)
const historialList = ref([])
const historialLoading = ref(false)

const formOpen = ref(false)
const editingId = ref(null)
const form = ref({})
const formError = ref('')
const saving = ref(false)

const confirmState = ref(null)

let errorTimer = null
let formErrorTimer = null

watch(error, (value) => {
  clearTimeout(errorTimer)
  if (value) errorTimer = setTimeout(() => { error.value = '' }, 4200)
})

watch(formError, (value) => {
  clearTimeout(formErrorTimer)
  if (value) formErrorTimer = setTimeout(() => { formError.value = '' }, 4200)
})

const activeTabLabel = computed(
  () => tabs.find((t) => t.key === activeTab.value)?.label ?? ''
)

const editModalTitle = computed(() => {
  if (activeTab.value !== 'asistencias' || !editingId.value) return activeTabLabel.value
  const r = lists.value.asistencias.find((a) => a.id === editingId.value)
  if (!r) return activeTabLabel.value
  const practicante = r.Practicante
    ? `${r.Practicante.apellidos}, ${r.Practicante.nombre}`
    : ''
  return `Asistencia · ${formatFecha(r.fecha)}${practicante ? ' · ' + practicante : ''}`
})

const modalFields = computed(() => {
  const fields = fieldConfigs[activeTab.value] ?? []
  if (activeTab.value !== 'asistencias') return fields
  const r = lists.value.asistencias.find((a) => a.id === editingId.value)
  const actual = r?.estado ?? 'PENDIENTE'
  return fields.map((f) =>
    f.key === 'estado'
      ? { ...f, options: estadoOptions(actual) }
      : f
  )
})

const isSelfEditing = computed(
  () =>
    activeTab.value === 'usuarios' &&
    editingId.value &&
    props.currentUser &&
    Number(editingId.value) === Number(props.currentUser.id)
)

const currentCount = computed(() =>
  activeTab.value === 'asistencias'
    ? asistTotal.value
    : (activeTab.value === 'practicantes'
        ? filteredPracticantes.value.length
        : lists.value[activeTab.value]?.length ?? 0)
)

const filteredPracticantes = computed(() => {
  const rows = lists.value.practicantes ?? []
  const q = practicanteBusqueda.value.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (p) =>
      String(p.dni ?? '').includes(q) ||
      String(p.nombre ?? '').toLowerCase().includes(q) ||
      String(p.apellidos ?? '').toLowerCase().includes(q) ||
      String(p.codigo_alumno ?? '').toLowerCase().includes(q)
  )
})

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const isGet = method === 'GET'

  if (isGet) {
    const hit = _cache.get(path)
    if (hit && Date.now() - hit.at < _CACHE_TTL) return hit.data
  }

  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {})
    }
  })
  if (response.status === 401) {
    emit('session-expired')
    throw new Error('Sesión expirada. Inicie sesión nuevamente.')
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Error del servidor.')

  if (isGet) {
    _cache.set(path, { data, at: Date.now() })
  } else {
    for (const key of _cache.keys()) {
      if (key.startsWith('/api/admin/')) _cache.delete(key)
    }
  }

  return data
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const entries = await Promise.all(
      CRUD_TABS.map(async (t) => {
        const { data } = await api(`/api/admin/${t}`)
        return [t, data]
      })
    )
    lists.value = Object.fromEntries(entries)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadAsistencias() {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams()
    params.set('page', asistPage.value)
    if (asistFiltros.value.fecha) params.set('fecha', asistFiltros.value.fecha)
    if (asistFiltros.value.facultad_id) params.set('facultad_id', asistFiltros.value.facultad_id)
    if (asistFiltros.value.estado) params.set('estado', asistFiltros.value.estado)
    if (asistFiltros.value.dni) params.set('dni', asistFiltros.value.dni)

    const { data, total, pages } = await api(`/api/admin/asistencias?${params}`)
    lists.value.asistencias = data
    asistTotal.value = total
    asistPages.value = pages
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function applyAsistFiltros() {
  asistPage.value = 1
  loadAsistencias()
}

function clearAsistFiltros() {
  asistFiltros.value = { fecha: '', facultad_id: '', estado: '', dni: '' }
  asistPage.value = 1
  loadAsistencias()
}

async function exportCsv() {
  if (asistExporting.value) return
  asistExporting.value = true
  try {
    const params = new URLSearchParams()
    if (asistFiltros.value.fecha) params.set('fecha', asistFiltros.value.fecha)
    if (asistFiltros.value.facultad_id) params.set('facultad_id', asistFiltros.value.facultad_id)
    if (asistFiltros.value.estado) params.set('estado', asistFiltros.value.estado)
    if (asistFiltros.value.dni) params.set('dni', asistFiltros.value.dni)

    const response = await fetch(`/api/admin/asistencias/export?${params}`, {
      headers: authHeaders()
    })
    if (response.status === 401) {
      emit('session-expired')
      throw new Error('Sesión expirada. Inicie sesión nuevamente.')
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || 'No se pudo exportar.')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asistencias-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = e.message
  } finally {
    asistExporting.value = false
  }
}

onMounted(loadAll)

function selectTab(tab) {
  activeTab.value = tab
  if (tab === 'asistencias') {
    asistPage.value = 1
    loadAsistencias()
  }
}

function openCreate() {
  if (activeTab.value === 'asistencias') return
  editingId.value = null
  form.value = {}
  if (fieldConfigs[activeTab.value].some((f) => f.key === 'estado')) {
    form.value.estado = 'ACTIVO'
  }
  if (activeTab.value === 'usuarios') {
    form.value.rol = 'SUPERVISOR'
    form.value.trabajador_id = ''
  }
  formError.value = ''
  formOpen.value = true
}

function openEdit(row) {
  editingId.value = row.id
  form.value = { ...row }
  if (activeTab.value === 'asistencias') {
    for (const key of ['hora_entrada', 'hora_salida']) {
      if (typeof form.value[key] === 'string') {
        form.value[key] = form.value[key].slice(0, 5)
      }
    }
  }
  formError.value = ''
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
}

function buildPayload() {
  const payload = {}
  for (const f of fieldConfigs[activeTab.value]) {
    if (f.key === 'password' && editingId.value && !form.value.password) continue
    let value = form.value[f.key]
    if (f.type === 'number' && value !== '' && value != null) value = Number(value)
    payload[f.key] = value === '' || value == null ? null : value
  }
  return payload
}

async function saveForm() {
  saving.value = true
  formError.value = ''
  try {
    const tab = activeTab.value
    const payload = buildPayload()
    if (tab === 'usuarios' && !editingId.value && !payload.password) {
      throw new Error('La contraseña es obligatoria.')
    }
    if (
      tab === 'usuarios' &&
      editingId.value &&
      props.currentUser &&
      Number(editingId.value) === Number(props.currentUser.id)
    ) {
      if (payload.estado === 'INACTIVO') {
        throw new Error('No puedes desactivar tu propia cuenta.')
      }
      if (payload.rol && payload.rol !== 'ADMIN') {
        throw new Error('No puedes quitarte el rol de administrador.')
      }
    }

    await api(
      editingId.value ? `/api/admin/${tab}/${editingId.value}` : `/api/admin/${tab}`,
      {
        method: editingId.value ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      }
    )
    formOpen.value = false
    if (tab === 'asistencias') {
      await loadAsistencias()
    } else {
      await loadAll()
    }
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function canDeleteRow(row) {
  if (activeTab.value === 'practicantes' && row.estado === 'ACTIVO') {
    return false
  }
  return true
}

function requestDelete(row) {
  let message = '¿Eliminar este registro? Esta acción no se puede deshacer.'
  if (activeTab.value === 'practicantes') {
    const count = Number(row.asistencias_count ?? 0)
    message =
      count > 0
        ? `Este practicante tiene ${count} registro(s) de asistencia. Al confirmar, se eliminará PERMANENTEMENTE y no podrá recuperarse el historial, por lo que se perderá todo rastro de que esta persona trabajó en OCRI. ` +
          '¿Desea eliminarlo definitivamente?'
        : 'Este practicante no tiene asistencias registradas. Al confirmar, se eliminará PERMANENTEMENTE y no podrá recuperarse su registro. ¿Desea eliminarlo definitivamente?'
  }
  confirmState.value = {
    message,
    action: async () => {
      try {
        await api(`/api/admin/${activeTab.value}/${row.id}`, { method: 'DELETE' })
        await loadAll()
      } catch (e) {
        error.value = e.message
      } finally {
        confirmState.value = null
      }
    }
  }
}

function cancelConfirm() {
  confirmState.value = null
}

async function toggleEstado(row) {
  const nuevo = row.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
  try {
    await api(`/api/admin/${activeTab.value}/${row.id}`, {
      method: 'PUT',
      body: JSON.stringify({ estado: nuevo })
    })
    await loadAll()
  } catch (e) {
    error.value = e.message
  }
}

function isSelf(row) {
  return (
    activeTab.value === 'usuarios' &&
    props.currentUser &&
    Number(row.id) === Number(props.currentUser.id)
  )
}

function changeAsistPage(page) {
  asistPage.value = page
  loadAsistencias()
}

async function openHistorial(row) {
  historialOpen.value = true
  historialPracticante.value = row
  historialList.value = []
  historialLoading.value = true
  try {
    const { data } = await api(`/api/admin/practicantes/${row.id}/historial`)
    historialList.value = data
  } catch (e) {
    error.value = e.message
  } finally {
    historialLoading.value = false
  }
}

function closeHistorial() {
  historialOpen.value = false
  historialPracticante.value = null
  historialList.value = []
}

async function downloadReporte(row) {
  if (!row) return
  try {
    const response = await fetch(`/api/admin/practicantes/${row.id}/reporte`, {
      headers: authHeaders()
    })
    if (response.status === 401) {
      emit('session-expired')
      throw new Error('Sesión expirada. Inicie sesión nuevamente.')
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || 'No se pudo generar el reporte.')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  } catch (e) {
    error.value = e.message
  }
}
</script>

<template>
  <div class="admin-panel">
    <div class="admin-inner">
      <h2 class="admin-title">Panel de administración</h2>

      <div class="admin-tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          type="button"
          class="admin-tab"
          :class="{ active: activeTab === t.key }"
          @click="selectTab(t.key)"
        >
          {{ t.label }}
        </button>
      </div>

      <Transition name="err">
        <p v-if="error" class="admin-error">{{ error }}</p>
      </Transition>

      <div class="admin-card">
        <div class="admin-card-head">
          <span class="admin-count">{{ currentCount }} registro(s)</span>

          <AdminAsistFilters
            v-if="activeTab === 'asistencias'"
            :filtros="asistFiltros"
            :facultades="lists.facultades"
            :exporting="asistExporting"
            @buscar="applyAsistFiltros"
            @limpiar="clearAsistFiltros"
            @exportar="exportCsv"
          />

          <div v-else class="admin-head-right">
            <input
              v-if="activeTab === 'practicantes'"
              v-model="practicanteBusqueda"
              type="text"
              class="admin-search"
              placeholder="Buscar por DNI, nombre o código…"
            />
            <button
              type="button"
              class="admin-btn admin-btn-primary"
              @click="openCreate"
            >
              Nuevo
            </button>
          </div>
        </div>

        <AdminCrudTable
          :columns="columns[activeTab]"
          :rows="activeTab === 'practicantes' ? filteredPracticantes : lists[activeTab]"
          :show-actions="true"
          :is-self="isSelf"
          :show-history="activeTab === 'practicantes'"
          :edit-only="activeTab === 'asistencias'"
          :can-delete="canDeleteRow"
          :page="asistPage"
          :pages="asistPages"
          @edit="openEdit"
          @toggle-estado="toggleEstado"
          @delete="requestDelete"
          @history="openHistorial"
          @page-change="changeAsistPage"
        />

        <p v-if="loading" class="admin-note">Cargando…</p>
        <p v-else-if="!currentCount" class="admin-note">Sin registros.</p>
      </div>
    </div>

    <AdminFormModal
      :open="formOpen"
      :title="editModalTitle"
      :editing="!!editingId"
      :fields="modalFields"
      :form="form"
      :error="formError"
      :saving="saving"
      :is-self-editing="isSelfEditing"
      :lists="lists"
      @close="closeForm"
      @save="saveForm"
    />

    <div v-if="confirmState" class="modal-overlay" @click.self="cancelConfirm">
      <div class="modal-card modal-card-small modal-card-warning">
        <div class="modal-warning-head">
          <span class="modal-warning-icon">⚠</span>
        </div>
        <p class="modal-text modal-text-justify">{{ confirmState.message }}</p>
        <div class="modal-actions">
          <button type="button" class="admin-btn" @click="cancelConfirm">Cancelar</button>
          <button type="button" class="admin-btn admin-btn-danger" @click="confirmState.action">
            Eliminar
          </button>
        </div>
      </div>
    </div>

    <div v-if="historialOpen" class="modal-overlay" @click.self="closeHistorial">
      <div class="modal-card modal-card-historial">
        <div class="modal-card-head">
          <h3 class="modal-title">
            Historial de {{ historialPracticante?.nombre }} {{ historialPracticante?.apellidos }}
          </h3>
          <button type="button" class="admin-btn" @click="downloadReporte(historialPracticante)">Descargar reporte</button>
          <button type="button" class="admin-btn" @click="closeHistorial">Cerrar</button>
        </div>

        <p v-if="historialLoading" class="admin-note">Cargando historial…</p>
        <p v-else-if="!historialList.length" class="admin-note">Sin asistencias registradas.</p>
        <table v-else class="admin-table historial-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Estado</th>
              <th>Observación</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in historialList" :key="a.id">
              <td>{{ formatFecha(a.fecha) }}</td>
              <td>{{ a.hora_entrada ?? '—' }}</td>
              <td>{{ a.hora_salida ?? '—' }}</td>
              <td>
                <span class="historial-badge" :class="a.estado">{{ a.estado }}</span>
              </td>
              <td>{{ a.observacion || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-panel {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: 90px clamp(22px, 4vw, 64px) 44px;
  z-index: 5;
}

.admin-inner {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.admin-title {
  margin: 0 0 18px;
  font-size: 24px;
  font-weight: 200;
  letter-spacing: .05em;
}

.admin-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.admin-tab {
  padding: 9px 20px;
  border: 1px solid rgba(255, 255, 255, .25);
  border-radius: 24px;
  background: transparent;
  color: rgba(255, 255, 255, .7);
  font-family: 'Inter', Arial, sans-serif;
  font-size: 13px;
  font-weight: 300;
  letter-spacing: .03em;
  cursor: pointer;
  transition: background .18s ease, color .18s ease, border-color .18s ease;
}

.admin-tab:hover {
  border-color: rgba(255, 255, 255, .5);
  color: #fff;
}

.admin-tab.active {
  background: rgba(255, 255, 255, .16);
  border-color: rgba(255, 255, 255, .8);
  color: #fff;
}

.admin-error {
  margin: 0 0 16px;
  padding: 10px 16px;
  border: 1px solid rgba(255, 141, 141, .4);
  border-radius: 10px;
  background: rgba(255, 141, 141, .1);
  color: #ffb3b3;
  font-size: 13px;
  font-weight: 300;
}

.admin-card {
  border: 1px solid rgba(255, 255, 255, .16);
  border-radius: 18px;
  background: rgba(20, 20, 20, .48);
  backdrop-filter: blur(18px) saturate(115%);
  -webkit-backdrop-filter: blur(18px) saturate(115%);
  overflow: hidden;
}

.admin-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, .1);
}

.admin-count {
  font-size: 13px;
  font-weight: 200;
  letter-spacing: .04em;
  color: rgba(255, 255, 255, .6);
}

.admin-note {
  margin: 0;
  padding: 16px;
  text-align: center;
  font-size: 13px;
  font-weight: 200;
  color: rgba(255, 255, 255, .45);
}

.admin-btn {
  padding: 6px 14px;
  border: 1px solid rgba(255, 255, 255, .35);
  border-radius: 16px;
  background: transparent;
  color: rgba(255, 255, 255, .85);
  font-family: 'Inter', Arial, sans-serif;
  font-size: 12px;
  font-weight: 300;
  letter-spacing: .03em;
  cursor: pointer;
  transition: background .18s ease, border-color .18s ease, color .18s ease;
  white-space: nowrap;
}

.admin-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, .12);
  border-color: rgba(255, 255, 255, .7);
}

.admin-btn:disabled {
  opacity: .5;
  cursor: default;
}

.admin-btn-primary {
  border-color: rgba(255, 255, 255, .7);
  background: rgba(255, 255, 255, .1);
}

.admin-btn-danger {
  border-color: rgba(255, 141, 141, .45);
  color: #ffb3b3;
}

.admin-btn-danger:hover:not(:disabled) {
  background: rgba(255, 141, 141, .12);
  border-color: rgba(255, 141, 141, .8);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, .55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.modal-card {
  width: min(560px, 94vw);
  max-height: 88vh;
  overflow-y: auto;
  padding: 28px 30px;
  border: 1px solid rgba(255, 255, 255, .2);
  border-radius: 20px;
  background: rgba(22, 22, 22, .94);
  box-shadow: 0 30px 80px rgba(0, 0, 0, .55);
}

.modal-card-small {
  width: min(420px, 92vw);
}

.modal-card-warning {
  border: 2px solid #e53935;
}

.modal-warning-head {
  display: flex;
  justify-content: center;
  margin-bottom: 14px;
}

.modal-warning-icon {
  font-size: 34px;
  line-height: 1;
  color: #e53935;
}

.modal-text {
  margin: 0 0 20px;
  font-size: 14px;
  font-weight: 300;
  line-height: 1.5;
}

.modal-text-justify {
  text-align: justify;
  line-height: 1.8;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

.admin-head-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.admin-search {
  padding: 7px 14px;
  border: 1px solid rgba(255, 255, 255, .3);
  border-radius: 16px;
  background: rgba(255, 255, 255, .06);
  color: #fff;
  font-family: 'Inter', Arial, sans-serif;
  font-size: 13px;
  font-weight: 300;
  outline: none;
  transition: border-color .18s ease, background .18s ease;
}

.admin-search::placeholder {
  color: rgba(255, 255, 255, .4);
}

.admin-search:focus {
  border-color: rgba(255, 255, 255, .7);
  background: rgba(255, 255, 255, .1);
}

.modal-card-historial {
  width: min(720px, 94vw);
}

.modal-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 18px;
  margin-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, .12);
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 300;
  letter-spacing: .03em;
}

.historial-table {
  font-size: 13px;
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-weight: 300;
}

.historial-table th {
  text-align: left;
  padding: 10px 12px;
  font-size: 11px;
  font-weight: 300;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .5);
  background: #181818;
  border-bottom: 1px solid rgba(255, 255, 255, .12);
  white-space: nowrap;
}

.historial-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, .07);
  white-space: nowrap;
}

.historial-table tbody tr:hover {
  background: rgba(255, 255, 255, .05);
}

.historial-badge {
  display: inline-block;
  padding: 3px 10px;
  border: 1px solid rgba(255, 255, 255, .3);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: .05em;
  color: #ffd9a3;
  border-color: rgba(255, 217, 163, .4);
  background: rgba(255, 217, 163, .08);
}

.historial-badge.COMPLETA {
  color: #9fe8b1;
  border-color: rgba(159, 232, 177, .4);
  background: rgba(159, 232, 177, .08);
}

.historial-badge.JUSTIFICADA {
  color: #a3c4ff;
  border-color: rgba(163, 196, 255, .4);
  background: rgba(163, 196, 255, .08);
}

.historial-badge.AUSENTE {
  color: #ffb3b3;
  border-color: rgba(255, 141, 141, .4);
  background: rgba(255, 141, 141, .08);
}

@media (max-width: 860px) {
  .admin-panel {
    padding-top: 110px;
  }
}
</style>
