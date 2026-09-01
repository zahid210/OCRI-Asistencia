<script setup>
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  editing: { type: Boolean, default: false },
  fields: { type: Array, default: () => [] },
  form: { type: Object, required: true },
  error: { type: String, default: '' },
  saving: { type: Boolean, default: false },
  isSelfEditing: { type: Boolean, default: false },
  lists: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['close', 'save'])

function onFieldInput(field, event) {
  let value = event.target.value
  if (field.numeric) value = value.replace(/\D+/g, '').slice(0, 8)
  props.form[field.key] = value
}

function onNumericKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key.length === 1 && !/\d/.test(event.key)) event.preventDefault()
}

function numericSanitize(value) {
  return String(value ?? '').replace(/\D+/g, '').slice(0, 8)
}

function onFieldKeydown(field, event) {
  if (field.numeric) onNumericKeydown(event)
}

function onFieldPaste(field, event) {
  if (!field.numeric) return
  event.preventDefault()
  const text = (event.clipboardData?.getData('text') ?? '').replace(/\D+/g, '')
  props.form[field.key] = numericSanitize((props.form[field.key] ?? '') + text)
}
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-card">
      <h3 class="modal-title">{{ editing ? 'Editar' : 'Nuevo' }} — {{ title }}</h3>
      <form @submit.prevent="emit('save')">
        <div class="modal-grid">
          <label v-for="f in fields" :key="f.key" class="modal-field">
            <span class="modal-label">
              {{ f.label }}
              <span v-if="f.required && !f.editOptional" class="req">*</span>
              <span v-else-if="f.key === 'password' && editing" class="req-opt">
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
              :value="form[f.key]"
              :type="f.type"
              :inputmode="f.numeric ? 'numeric' : undefined"
              :maxlength="f.maxlength"
              :minlength="f.type === 'password' ? f.min : undefined"
              :min="f.min"
              :max="f.max"
              :step="f.type === 'number' ? 1 : undefined"
              @input="onFieldInput(f, $event)"
              @keydown="onFieldKeydown(f, $event)"
              @paste="onFieldPaste(f, $event)"
            />
          </label>
        </div>

        <Transition name="err">
          <p v-if="error" class="modal-error">{{ error }}</p>
        </Transition>

        <div class="modal-actions">
          <button type="button" class="admin-btn" @click="emit('close')">Cancelar</button>
          <button type="submit" class="admin-btn admin-btn-primary" :disabled="saving">
            {{ saving ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
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
  background-color: rgba(255, 255, 255, .09);
}

.modal-field select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: rgba(255, 255, 255, .06);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 11px 7px;
  padding-right: 32px;
  cursor: pointer;
}

.modal-field select:disabled {
  cursor: default;
  opacity: .6;
}

.modal-error {
  margin: 14px 0 0;
  font-size: 12px;
  font-weight: 300;
  color: #ff9d9d;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
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

@media (max-width: 860px) {
  .modal-grid {
    grid-template-columns: 1fr;
  }
}
</style>
