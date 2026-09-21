import type { MeetingAttendanceStatus, MeetingStatus, MeetingType } from '@/types'

/**
 * Etiquetas en español de `MeetingType`/`MeetingStatus` (fase 3.1a) — fuente
 * única para el diálogo de creación, los filtros y ambos listados
 * (próximas e históricas), para que ninguno pueda mostrar un texto distinto
 * para el mismo valor.
 */
const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  event: 'Evento',
  association: 'Asociación',
  other: 'Otro',
}

const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  draft: 'Borrador',
  held: 'Celebrada',
  closed: 'Cerrada',
}

export const MEETING_TYPE_OPTIONS: Array<{ value: MeetingType; label: string }> = [
  { value: 'event', label: MEETING_TYPE_LABELS.event },
  { value: 'association', label: MEETING_TYPE_LABELS.association },
  { value: 'other', label: MEETING_TYPE_LABELS.other },
]

export const MEETING_STATUS_OPTIONS: Array<{ value: MeetingStatus; label: string }> = [
  { value: 'draft', label: MEETING_STATUS_LABELS.draft },
  { value: 'held', label: MEETING_STATUS_LABELS.held },
  { value: 'closed', label: MEETING_STATUS_LABELS.closed },
]

export function meetingTypeLabel(type: MeetingType): string {
  return MEETING_TYPE_LABELS[type]
}

export function meetingStatusLabel(status: MeetingStatus): string {
  return MEETING_STATUS_LABELS[status]
}

/** Fase 3.3a — etiquetas de `MeetingAttendanceStatus`, fuente única para el
 * listado de asistentes, el resumen y el aviso del diálogo de selección. */
const MEETING_ATTENDANCE_LABELS: Record<MeetingAttendanceStatus, string> = {
  planned: 'Previsto',
  attended: 'Asistió',
  absent: 'Ausente',
}

export const MEETING_ATTENDANCE_OPTIONS: Array<{
  value: MeetingAttendanceStatus
  label: string
}> = [
  { value: 'planned', label: MEETING_ATTENDANCE_LABELS.planned },
  { value: 'attended', label: MEETING_ATTENDANCE_LABELS.attended },
  { value: 'absent', label: MEETING_ATTENDANCE_LABELS.absent },
]

export function meetingAttendanceLabel(status: MeetingAttendanceStatus): string {
  return MEETING_ATTENDANCE_LABELS[status]
}

/** Fecha y hora de una reunión en el formato de la aplicación (es-ES). */
export function formatMeetingDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  )
}
