import { ref } from 'vue'
import { defineStore } from 'pinia'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  /** Duración del cierre automático en milisegundos; `null` en los errores
   * (fase 2.4 bis: sin cierre automático, exigen cierre manual). */
  duration: number | null
}

const MAX_VISIBLE_TOASTS = 4
const SUCCESS_DURATION_MS = 4000
const INFO_DURATION_MS = 6000

let toastCounter = 0

/** Id único por toast — nunca basado solo en `Date.now()` (dos
 * notificaciones publicadas en el mismo milisegundo compartirían id): un
 * contador de sesión, más un sufijo aleatorio para no depender únicamente
 * del orden de publicación. */
function createToastId(): string {
  toastCounter += 1
  return `toast-${toastCounter}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Fuente única de verdad de las notificaciones globales (fase 2.4 bis):
 * cualquier store o vista que necesite comunicar el éxito o el fallo de una
 * operación pasa por `useToastStore` — ninguna vista ni store crea su
 * propio estado de aviso independiente. Complementa, nunca sustituye, los
 * errores contextuales ya mostrados dentro de formularios y diálogos.
 */
export const useToastStore = defineStore('toast', () => {
  const toasts = ref<Toast[]>([])

  // Un temporizador de cierre automático por toast (éxito e información),
  // indexado por id — nunca hay uno para un error. Vive fuera de `toasts`
  // porque un `setTimeout` no es un valor serializable/reactivo: aquí solo
  // hace falta poder cancelarlo antes de que dispare.
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function clearTimer(id: string) {
    const timer = timers.get(id)
    if (timer !== undefined) {
      clearTimeout(timer)
      timers.delete(id)
    }
  }

  /** Retira el toast `id` y limpia siempre su temporizador, tanto si el
   * cierre lo dispara el propio temporizador como si lo pide el usuario
   * (botón de cierre) o lo fuerza el límite de notificaciones visibles. */
  function remove(id: string) {
    clearTimer(id)
    const index = toasts.value.findIndex((toast) => toast.id === id)
    if (index !== -1) {
      toasts.value = [...toasts.value.slice(0, index), ...toasts.value.slice(index + 1)]
    }
  }

  /** Limpia todas las notificaciones y cancela todos sus temporizadores —
   * pensada para un reinicio completo (p. ej. cierre de sesión), no para el
   * uso normal de una única notificación. */
  function clear() {
    for (const id of timers.keys()) clearTimeout(timers.get(id))
    timers.clear()
    toasts.value = []
  }

  function push(type: ToastType, message: string, duration: number | null): string {
    const id = createToastId()
    toasts.value = [...toasts.value, { id, type, message, duration }]

    // Máximo de notificaciones visibles: al superar el límite se retira
    // primero la más antigua (la primera del array), con la misma función
    // que usa cualquier otro cierre — así su temporizador también se limpia.
    while (toasts.value.length > MAX_VISIBLE_TOASTS) {
      remove(toasts.value[0].id)
    }

    if (duration !== null) {
      timers.set(
        id,
        setTimeout(() => remove(id), duration),
      )
    }

    return id
  }

  function success(message: string, duration: number = SUCCESS_DURATION_MS): string {
    return push('success', message, duration)
  }

  /** Sin cierre automático: un error permanece hasta que el usuario lo
   * cierra a mano, para que nunca desaparezca antes de haberse leído. */
  function error(message: string): string {
    return push('error', message, null)
  }

  function info(message: string, duration: number = INFO_DURATION_MS): string {
    return push('info', message, duration)
  }

  return { toasts, success, error, info, remove, clear }
})
