import { ref } from 'vue'

const notifications = ref([])
let notificationId = 0

export function useNotifications(durationMs = 3600) {
  function pushNotification({ title, name, dni: dniText, detail = '', error = false }) {
    const id = ++notificationId
    const item = { id, title, name, dni: dniText, detail, error }
    notifications.value.push(item)
    setTimeout(() => {
      notifications.value = notifications.value.filter((n) => n.id !== id)
    }, durationMs)
  }

  function removeNotification(id) {
    notifications.value = notifications.value.filter((n) => n.id !== id)
  }

  return {
    notifications,
    pushNotification,
    removeNotification
  }
}
