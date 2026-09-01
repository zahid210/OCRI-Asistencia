<script setup>
const props = defineProps({
  filtros: { type: Object, required: true },
  facultades: { type: Array, default: () => [] },
  exporting: { type: Boolean, default: false }
})

const emit = defineEmits(['buscar', 'limpiar', 'exportar'])

const ESTADOS = ['PENDIENTE', 'COMPLETA', 'AUSENTE', 'JUSTIFICADA']

function onDniInput(event) {
  props.filtros.dni = event.target.value.replace(/\D+/g, '').slice(0, 8)
}

function onNumericKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key.length === 1 && !/\d/.test(event.key)) event.preventDefault()
}

function numericSanitize(value) {
  return String(value ?? '').replace(/\D+/g, '').slice(0, 8)
}

function onDniPaste(event) {
  event.preventDefault()
  const text = (event.clipboardData?.getData('text') ?? '').replace(/\D+/g, '')
  props.filtros.dni = numericSanitize((props.filtros.dni ?? '') + text)
}
</script>

<template>
  <div class="asist-filters">
    <input v-model="filtros.fecha" type="date" class="asist-input" title="Fecha" />
    <select v-model="filtros.facultad_id" class="asist-input asist-select">
      <option value="">Todas las facultades</option>
      <option v-for="f in facultades" :key="f.id" :value="f.id">
        {{ f.nombre }}
      </option>
    </select>
    <select v-model="filtros.estado" class="asist-input asist-select">
      <option value="">Todos los estados</option>
      <option v-for="e in ESTADOS" :key="e">
        {{ e }}
      </option>
    </select>
    <input
      :value="filtros.dni"
      type="text"
      class="asist-input"
      size="8"
      inputmode="numeric"
      maxlength="8"
      placeholder="DNI"
      @input="onDniInput"
      @keydown="onNumericKeydown"
      @paste="onDniPaste"
    />
    <button type="button" class="admin-btn" @click="emit('buscar')">Buscar</button>
    <button type="button" class="admin-btn" @click="emit('limpiar')">Limpiar</button>
    <button
      type="button"
      class="admin-btn admin-btn-primary"
      :disabled="exporting"
      @click="emit('exportar')"
    >
      {{ exporting ? 'Exportando…' : 'Exportar CSV' }}
    </button>
  </div>
</template>

<style scoped>
.asist-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.asist-input {
  color-scheme: dark;
  padding: 7px 12px;
  border: 1px solid rgba(255, 255, 255, .25);
  border-radius: 8px;
  background-color: #1b1b1b;
  color: rgba(255, 255, 255, .85);
  font-size: 13px;
  font-weight: 300;
  outline: none;
  transition: border-color .15s ease;
}

.asist-input.asist-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23ffffff' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 11px 7px;
  padding-right: 32px;
  cursor: pointer;
}

.asist-input option {
  background: #181818;
  color: #fff;
}

.asist-input:focus {
  border-color: rgba(255, 255, 255, .55);
}

.asist-input::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: .6;
  filter: invert(1);
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
</style>
