/**
 * Reglas y conversiones compartidas por `CreateMeetingDialog` y
 * `EditMeetingDialog` (fases 3.1a/3.1b) — una sola fuente, así ninguno de
 * los dos diálogos puede validar o convertir `name`/`scheduledAt` de forma
 * distinta al otro.
 */

const MAX_NAME_LENGTH = 160
// eslint-disable-next-line no-control-regex -- se excluyen deliberadamente los caracteres de control
const CONTROL_CHAR_PATTERN = /[\x00-\x1F\x7F]/

/** Igual validación que aplica el backend sobre `name` (recorte,
 * obligatorio, máximo 160, sin caracteres de control) — la validación local
 * solo evita un viaje de red, nunca sustituye la del servidor. */
export function validateMeetingName(rawName: string): string {
  const trimmed = rawName.trim()
  if (!trimmed) return 'El nombre es obligatorio.'
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `El nombre no puede superar los ${MAX_NAME_LENGTH} caracteres.`
  }
  if (CONTROL_CHAR_PATTERN.test(trimmed)) {
    return 'El nombre no puede contener caracteres de control.'
  }
  return ''
}

/** `datetime-local` entrega la hora ya en horario local, sin zona (p. ej.
 * "2026-09-20T18:30") — `Date` la interpreta como hora local del navegador,
 * así que `toISOString()` produce directamente el instante UTC con zona
 * explícita ("...Z") que exige `scheduledAt` en el backend. `null` si el
 * campo está vacío o el navegador entrega un valor no parseable. */
export function toIsoDateTime(rawValue: string): string | null {
  if (!rawValue) return null
  const date = new Date(rawValue)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

/**
 * Convierte un `scheduledAt` ISO (el que devuelve el backend) al formato
 * local que espera un `<input type="datetime-local">`
 * (`YYYY-MM-DDTHH:mm`), usando los componentes locales de `Date`
 * (`getFullYear`/`getMonth`/... ) — nunca `toISOString().slice(...)`, que
 * expresa la hora en UTC y desplazaría lo mostrado respecto a la hora local
 * real de la reunión. Cadena vacía si `iso` no es una fecha válida.
 */
export function toLocalDateTimeInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
