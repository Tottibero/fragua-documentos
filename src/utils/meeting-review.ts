import type { MeetingAttendee, MeetingPoint } from '@/types'

/** Códigos estables de los avisos de la revisión previa al cierre (fase
 * 3.3b). Ninguno bloquea el cierre: son información para quien cierra. */
export type MeetingReviewWarningCode =
  | 'NO_POINTS'
  | 'NO_ATTENDEES'
  | 'ATTENDANCE_PENDING'
  | 'POINTS_WITHOUT_AGREEMENTS'

export interface MeetingReviewWarning {
  code: MeetingReviewWarningCode
  message: string
  /** Nombres o títulos afectados, cuando el aviso apunta a elementos
   * concretos. */
  details: string[]
}

export interface MeetingReview {
  points: {
    total: number
    withoutAgreements: MeetingPoint[]
  }
  attendees: {
    total: number
    planned: MeetingAttendee[]
    attended: MeetingAttendee[]
    absent: MeetingAttendee[]
  }
  warnings: MeetingReviewWarning[]
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

/** Un punto cuenta como «sin acuerdos» si `agreements` es `null` o solo
 * espacios (el backend ya normaliza vacío a `null`, esto es defensivo). */
function hasNoAgreements(point: MeetingPoint): boolean {
  return point.agreements === null || point.agreements.trim() === ''
}

/**
 * Compone la revisión previa al cierre de una reunión a partir de los puntos
 * y asistentes ya cargados — no hay endpoint propio: el backend solo
 * garantiza (bloqueando la fila de la reunión) que cerrar no se cruza con
 * una edición en curso. Función pura y sin dependencias de Vue, para que la
 * lógica de los avisos no viva dentro del componente del diálogo.
 */
export function buildMeetingReview(
  points: MeetingPoint[],
  attendees: MeetingAttendee[],
): MeetingReview {
  const withoutAgreements = points.filter(hasNoAgreements)
  const planned = attendees.filter((attendee) => attendee.status === 'planned')
  const attended = attendees.filter((attendee) => attendee.status === 'attended')
  const absent = attendees.filter((attendee) => attendee.status === 'absent')

  const warnings: MeetingReviewWarning[] = []

  if (points.length === 0) {
    warnings.push({ code: 'NO_POINTS', message: 'La reunión no tiene puntos.', details: [] })
  }

  if (attendees.length === 0) {
    warnings.push({
      code: 'NO_ATTENDEES',
      message: 'La reunión no tiene asistentes.',
      details: [],
    })
  } else if (planned.length > 0) {
    warnings.push({
      code: 'ATTENDANCE_PENDING',
      message: `${planned.length} ${plural(planned.length, 'asistente sigue', 'asistentes siguen')} como «Previsto», sin asistencia registrada.`,
      details: planned.map((attendee) => attendee.user.nickname),
    })
  }

  if (points.length > 0 && withoutAgreements.length > 0) {
    warnings.push({
      code: 'POINTS_WITHOUT_AGREEMENTS',
      message: `${withoutAgreements.length} ${plural(withoutAgreements.length, 'punto no tiene', 'puntos no tienen')} acuerdos registrados.`,
      details: withoutAgreements.map((point) => point.title),
    })
  }

  return {
    points: { total: points.length, withoutAgreements },
    attendees: { total: attendees.length, planned, attended, absent },
    warnings,
  }
}
