<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  currentUser: { type: Object, default: null }
})

const emit = defineEmits(['session-expired'])

const TOKEN_KEY = 'ocri_token'

const tabs = [
  { key: 'practicantes', label: 'Practicantes' },
  { key: 'facultades', label: 'Facultades' },
  { key: 'trabajadores', label: 'Trabajadores' },
  { key: 'usuarios', label: 'Usuarios' }
]

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
    { key: 'dni', label: 'DNI', type: 'text', required: true, maxlength: 8 },
    { key: 'nombre', label: 'Nombre', type: 'text', required: true, maxlength: 100 },
    { key: 'apellidos', label: 'Apellidos', type: 'text', required: true, maxlength: 150 },
    { key: 'codigo_alumno', label: 'Código de alumno', type: 'text', required: true, maxlength: 30 },
    { key: 'facultad_id', label: 'Facultad', type: 'select', options: 'facultades', required: true },
    { key: 'ciclo', label: 'Ciclo', type: 'number', min: 1, max: 10 },
    {
      key: 'estado',
      label: 'Estado',
      type: 'select',
      options: ['ACTIVO', 'INACTIVO', 'EGRESADO', 'RETIRADO']
    }
  ],
  facultades: [
    { key: 'nombre', label: 'Nombre', type: 'text', required: true, maxlength: 150 },
    { key: 'abreviatura', label: 'Abreviatura', type: 'text', maxlength: 20 },
    { key: 'estado', label: 'Estado', type: 'select', options: ['ACTIVO', 'INACTIVO'] }
  ],
  trabajadores: [
    { key: 'dni', label: 'DNI', type: 'text', required: true, maxlength: 8 },
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
  facultades: [],
  trabajadores: [],
  usuarios: []
})

const formOpen = ref(false)
const editingId = ref(null)
const form = ref({})
const formError = ref('')
const saving = ref(false)

const confirmState = ref(null)

const activeTabLabel = computed(
  () => tabs.find((t) => t.key === activeTab.value)?.label ?? ''
)

const isSelfEditing = computed(
  () =>
    activeTab.value === 'usuarios' &&
    editingId.value &&
    props.currentUser &&
    Number(editingId.value) === Number(props.currentUser.id)
)

function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function api(path, options = {}) {
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
  return data
}

async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const entries = await Promise.all(
      tabs.map(async (t) => {
        const { data } = await api(`/api/admin/${t.key}`)
        return [t.key, data]
      })
    )
    lists.value = Object.fromEntries(entries)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

function selectTab(tab) {
  activeTab.value = tab
}

function openCreate() {
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
    await loadAll()
  } catch (e) {
    formError.value = e.message
  } finally {
    saving.value = false
  }
}

function requestDelete(row) {
  confirmState.value = {
    message: '¿Eliminar este registro? Esta acción no se puede deshacer.',
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

      <p v-if="error" class="admin-error">{{ error }}</p>

      <div class="admin-card">
        <div class="admin-card-head">
          <span class="admin-count">{{ lists[activeTab].length }} registro(s)</span>
          <button type="button" class="admin-btn admin-btn-primary" @click="openCreate">
            Nuevo
          </button>
        </div>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th v-for="c in columns[activeTab]" :key="c.key">{{ c.label }}</th>
                <th class="admin-actions-col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in lists[activeTab]" :key="row.id">
                <td v-for="c in columns[activeTab]" :key="c.key">
                  <span v-if="c.key === 'estado'" class="admin-badge" :class="row.estado">
                    {{ row.estado }}
                  </span>
                  <span v-else>{{ c.render ? c.render(row) : row[c.key] ?? '—' }}</span>
                </td>
                <td class="admin-actions">
                  <button class="admin-btn" @click="openEdit(row)">Editar</button>
                  <button
                    v-if="!isSelf(row)"
                    class="admin-btn"
                    :title="row.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'"
                    @click="toggleEstado(row)"
                  >
                    {{ row.estado === 'ACTIVO' ? 'Desactivar' : 'Activar' }}
                  </button>
                  <button
                    v-if="!isSelf(row)"
                    class="admin-btn admin-btn-danger"
                    @click="requestDelete(row)"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="loading" class="admin-note">Cargando…</p>
        <p v-else-if="!lists[activeTab].length" class="admin-note">Sin registros.</p>
      </div>
    </div>

    <div v-if="formOpen" class="modal-overlay" @click.self="closeForm">
      <div class="modal-card">
        <h3 class="modal-title">{{ editingId ? 'Editar' : 'Nuevo' }} — {{ activeTabLabel }}</h3>
        <form @submit.prevent="saveForm">
          <div class="modal-grid">
            <label
              v-for="f in fieldConfigs[activeTab]"
              :key="f.key"
              class="modal-field"
            >
              <span class="modal-label">
                {{ f.label }}
                <span v-if="f.required && !f.editOptional" class="req">*</span>
                <span v-else-if="f.key === 'password' && editingId" class="req-opt">
                  (opcional)
                </span>
              </span>

              <select
                v-if="f.type === 'select'"
                v-model="form[f.key]"
                :disabled="isSelfEditing && (f.key === 'estado' || f.key === 'rol')"
              >
                <option v-if="f.allowEmpty" value="">— Sin asignar —</option>
                <template v-if="f.options === 'facultades'">
                  <option v-for="o in lists.facultades" :key="o.id" :value="o.id">
                    {{ o.nombre }}
                  </option>
                </template>
                <template v-else-if="f.options === 'trabajadores'">
                  <option v-for="o in lists.trabajadores" :key="o.id" :value="o.id">
                    {{ o.nombre }} {{ o.apellidos }}
                  </option>
                </template>
                <option v-for="o in f.options" v-else :key="o" :value="o">
                  {{ o }}
                </option>
              </select>

              <input
                v-else
                v-model="form[f.key]"
                :type="f.type"
                :maxlength="f.maxlength"
                :minlength="f.type === 'password' ? f.min : undefined"
                :min="f.min"
                :max="f.max"
                :step="f.type === 'number' ? 1 : undefined"
              />
            </label>
          </div>

          <p v-if="formError" class="modal-error">{{ formError }}</p>

          <div class="modal-actions">
            <button type="button" class="admin-btn" @click="closeForm">Cancelar</button>
            <button type="submit" class="admin-btn admin-btn-primary" :disabled="saving">
              {{ saving ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="confirmState" class="modal-overlay" @click.self="cancelConfirm">
      <div class="modal-card modal-card-small">
        <p class="modal-text">{{ confirmState.message }}</p>
        <div class="modal-actions">
          <button type="button" class="admin-btn" @click="cancelConfirm">Cancelar</button>
          <button type="button" class="admin-btn admin-btn-danger" @click="confirmState.action">
            Eliminar
          </button>
        </div>
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
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, .1);
}

.admin-count {
  font-size: 13px;
  font-weight: 200;
  letter-spacing: .04em;
  color: rgba(255, 255, 255, .6);
}

.admin-table-wrap {
  overflow-x: auto;
  max-height: 60vh;
}

.admin-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
  font-weight: 300;
}

.admin-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 300;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .5);
  background: #181818;
  border-bottom: 1px solid rgba(255, 255, 255, .12);
  white-space: nowrap;
  vertical-align: middle;
}

.admin-table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, .07);
  white-space: nowrap;
  vertical-align: middle;
}

.admin-table tbody tr {
  transition: background .15s ease;
}

.admin-table tbody tr:hover {
  background: rgba(255, 255, 255, .05);
}

.admin-actions-col {
  text-align: left;
}

.admin-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-start;
}

.admin-badge {
  display: inline-block;
  padding: 3px 10px;
  border: 1px solid rgba(255, 255, 255, .3);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: .05em;
}

.admin-badge.ACTIVO {
  color: #9fe8b1;
  border-color: rgba(159, 232, 177, .4);
  background: rgba(159, 232, 177, .08);
}

.admin-badge.INACTIVO,
.admin-badge.RETIRADO,
.admin-badge.AUSENTE {
  color: #ffb3b3;
  border-color: rgba(255, 141, 141, .4);
  background: rgba(255, 141, 141, .08);
}

.admin-badge.PENDIENTE,
.admin-badge.EGRESADO {
  color: #ffd9a3;
  border-color: rgba(255, 217, 163, .4);
  background: rgba(255, 217, 163, .08);
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

.modal-title {
  margin: 0 0 20px;
  font-size: 19px;
  font-weight: 200;
  letter-spacing: .04em;
}

.modal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.modal-label {
  font-size: 11px;
  font-weight: 300;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, .62);
}

.req {
  color: #ff9d9d;
}

.req-opt {
  text-transform: none;
  letter-spacing: 0;
  color: rgba(255, 255, 255, .4);
  font-size: 10px;
}

.modal-field input,
.modal-field select {
  width: 100%;
  height: 42px;
  padding: 0 13px;
  border: 1px solid rgba(255, 255, 255, .28);
  border-radius: 10px;
  background: rgba(255, 255, 255, .06);
  color: #fff;
  outline: none;
  font-family: 'Inter', Arial, sans-serif;
  font-size: 14px;
  font-weight: 300;
  transition: border-color .18s ease, background .18s ease;
}

.modal-field select option {
  background: #181818;
  color: #fff;
}

.modal-field input:focus,
.modal-field select:focus {
  border-color: rgba(255, 255, 255, .75);
  background: rgba(255, 255, 255, .09);
}

.modal-error {
  margin: 14px 0 0;
  font-size: 12px;
  font-weight: 300;
  color: #ff9d9d;
}

.modal-text {
  margin: 0 0 20px;
  font-size: 14px;
  font-weight: 300;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}

@media (max-width: 860px) {
  .admin-panel {
    padding-top: 110px;
  }

  .modal-grid {
    grid-template-columns: 1fr;
  }
}
</style>