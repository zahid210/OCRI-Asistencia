<script setup>
defineProps({
  columns: { type: Array, required: true },
  rows: { type: Array, default: () => [] },
  showActions: { type: Boolean, default: true },
  isSelf: { type: Function, default: () => false },
  page: { type: Number, default: 1 },
  pages: { type: Number, default: 1 }
})

const emit = defineEmits(['edit', 'toggle-estado', 'delete', 'page-change'])
</script>

<template>
  <div>
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th v-for="c in columns" :key="c.key">{{ c.label }}</th>
            <th v-if="showActions" class="admin-actions-col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td v-for="c in columns" :key="c.key">
              <span v-if="c.key === 'estado'" class="admin-badge" :class="row.estado">
                {{ row.estado }}
              </span>
              <span v-else>{{ c.render ? c.render(row) : row[c.key] ?? '—' }}</span>
            </td>
            <td v-if="showActions" class="admin-actions">
              <button class="admin-btn" @click="emit('edit', row)">Editar</button>
              <button
                v-if="!isSelf(row)"
                class="admin-btn"
                :title="row.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'"
                @click="emit('toggle-estado', row)"
              >
                {{ row.estado === 'ACTIVO' ? 'Desactivar' : 'Activar' }}
              </button>
              <button
                v-if="!isSelf(row)"
                class="admin-btn admin-btn-danger"
                @click="emit('delete', row)"
              >
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pages > 1" class="admin-pagination">
      <button
        type="button"
        class="admin-btn"
        :disabled="page <= 1"
        @click="emit('page-change', page - 1)"
      >
        ‹ Anterior
      </button>
      <span class="admin-page-info">Página {{ page }} de {{ pages }}</span>
      <button
        type="button"
        class="admin-btn"
        :disabled="page >= pages"
        @click="emit('page-change', page + 1)"
      >
        Siguiente ›
      </button>
    </div>
  </div>
</template>

<style scoped>
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

.admin-badge.ACTIVO,
.admin-badge.COMPLETA {
  color: #9fe8b1;
  border-color: rgba(159, 232, 177, .4);
  background: rgba(159, 232, 177, .08);
}

.admin-badge.JUSTIFICADA {
  color: #a3c4ff;
  border-color: rgba(163, 196, 255, .4);
  background: rgba(163, 196, 255, .08);
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

.admin-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, .08);
}

.admin-page-info {
  font-size: 12px;
  font-weight: 200;
  letter-spacing: .04em;
  color: rgba(255, 255, 255, .5);
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

.admin-btn-danger {
  border-color: rgba(255, 141, 141, .45);
  color: #ffb3b3;
}

.admin-btn-danger:hover:not(:disabled) {
  background: rgba(255, 141, 141, .12);
  border-color: rgba(255, 141, 141, .8);
}
</style>
