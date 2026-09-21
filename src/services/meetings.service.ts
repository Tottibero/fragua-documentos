import { api } from '@/services/api'
import {
  extractFileNameFromContentDisposition,
  sanitizeFileName,
  toReadableAxiosError,
  type DownloadFileResult,
} from '@/services/drive-documents.service'
import type {
  Meeting,
  MeetingAttendanceStatus,
  MeetingAttendee,
  MeetingAttendeeOption,
  DriveFileVersion,
  DriveFileVersionsPage,
  DriveItem,
  MeetingMinutes,
  MeetingPoint,
  MeetingsPage,
  MeetingStatus,
  MeetingTransitionAction,
  MeetingType,
} from '@/types'

/** Cuerpo de `POST /meetings`. `status`, `createdByUserId`, `createdAt` y
 * `updatedAt` nunca se envían — el backend los ignora/sobrescribe siempre
 * (ver `CreateMeetingDto` y `MeetingsService.create` en
 * `fragua-gestion/back`), así que el tipo del payload tampoco los admite. */
export interface CreateMeetingPayload {
  name: string
  /** ISO 8601 con zona explícita (p. ej. `...Z` o `+02:00`) — nunca hora
   * local sin zona, el backend la rechaza con 400. */
  scheduledAt: string
  type: MeetingType
}

/** Parámetros opcionales de `GET /meetings`. `type`/`status` filtran tanto
 * `current` como `past`; `pastPage`/`pastPageSize` paginan solo `past`. */
export interface ListMeetingsParams {
  pastPage?: number
  pastPageSize?: number
  type?: MeetingType
  status?: MeetingStatus
}

/** Cuerpo de `PATCH /meetings/:id` (fase 3.1b). Todos los campos son
 * opcionales — el backend rechaza con 400 un cuerpo sin ninguno de ellos —
 * pero, igual que `CreateMeetingPayload`, nunca admite `status`,
 * `createdByUserId`, `createdAt` ni `updatedAt`: el backend los ignora
 * siempre, así que el tipo tampoco los declara. */
export interface UpdateMeetingPayload {
  name?: string
  /** Mismo formato que `CreateMeetingPayload.scheduledAt`: ISO 8601 con
   * zona explícita, nunca hora local sin zona. */
  scheduledAt?: string
  type?: MeetingType
}

/** Cuerpo de `POST /meetings/:meetingId/points` (fase 3.2). `id`,
 * `meetingId`, `position`, `createdAt` y `updatedAt` nunca se envían — el
 * backend los ignora u obtiene por su cuenta (`CreateMeetingPointDto` en
 * `fragua-gestion/back`), así que el tipo del payload tampoco los admite.
 * Los campos opcionales aceptan `null` para reflejar la normalización del
 * backend (vacío/whitespace → `null`), pero un `undefined` también es
 * válido: significa "no se envía este campo". */
export interface CreateMeetingPointPayload {
  title: string
  description?: string | null
  notes?: string | null
  agreements?: string | null
  responsible?: string | null
}

/** Cuerpo de `PATCH /meetings/:meetingId/points/:pointId`. Todos los campos
 * son opcionales — el backend rechaza con 400 un cuerpo sin ninguno de
 * ellos — pero, a diferencia de la creación, `title` nunca acepta `null`
 * explícito (ver `UpdateMeetingPointDto` en `fragua-gestion/back`): solo
 * puede omitirse (sin cambios) o llevar un string. */
export type UpdateMeetingPointPayload = Partial<CreateMeetingPointPayload>

export const meetingsService = {
  async createMeeting(payload: CreateMeetingPayload): Promise<Meeting> {
    const response = await api.post<Meeting>('/meetings', payload)
    return response.data
  },

  async listMeetings(params: ListMeetingsParams = {}): Promise<MeetingsPage> {
    const response = await api.get<MeetingsPage>('/meetings', { params })
    return response.data
  },

  async getMeeting(id: string): Promise<Meeting> {
    const response = await api.get<Meeting>(`/meetings/${id}`)
    return response.data
  },

  async updateMeeting(id: string, payload: UpdateMeetingPayload): Promise<Meeting> {
    const response = await api.patch<Meeting>(`/meetings/${id}`, payload)
    return response.data
  },

  // --- Fase 3.3b — cambio de estado ----------------------------------

  /** `POST /meetings/:id/hold|close|reopen`: sin cuerpo (el estado destino lo
   * fija el endpoint) y con `200`, no `201`. Devuelve la reunión actualizada. */
  async transitionMeeting(id: string, action: MeetingTransitionAction): Promise<Meeting> {
    const response = await api.post<Meeting>(`/meetings/${id}/${action}`)
    return response.data
  },

  // --- Fase 3.4 — acta exportada a Drive -----------------------------

  /** `GET /meetings/:id/minutes` — metadatos del acta. `404` si la reunión
   * aún no tiene acta exportada (el llamador lo interpreta, no es un fallo). */
  async getMinutes(meetingId: string): Promise<MeetingMinutes> {
    const response = await api.get<MeetingMinutes>(`/meetings/${meetingId}/minutes`)
    return response.data
  },

  /** `POST /meetings/:id/minutes` — genera el PDF y lo guarda en Drive. Sin
   * cuerpo: todo el contenido sale de la base de datos. Tarda unos segundos
   * (renderiza y sube). */
  async exportMinutes(meetingId: string): Promise<MeetingMinutes> {
    const response = await api.post<MeetingMinutes>(`/meetings/${meetingId}/minutes`)
    return response.data
  },

  async regenerateMinutes(meetingId: string): Promise<MeetingMinutes> {
    const response = await api.post<MeetingMinutes>(
      `/meetings/${meetingId}/minutes/regenerate`,
    )
    return response.data
  },

  /** `GET /meetings/:id/minutes/download` — el PDF por la API autenticada,
   * nunca un enlace público de Drive. Mismo tratamiento de
   * `Content-Disposition` y de errores en `Blob` que las descargas del gestor
   * documental. */
  async downloadMinutes(meetingId: string): Promise<DownloadFileResult> {
    try {
      const response = await api.get<Blob>(`/meetings/${meetingId}/minutes/download`, {
        responseType: 'blob',
      })
      const rawName = extractFileNameFromContentDisposition(response.headers['content-disposition'])
      return {
        blob: response.data,
        fileName: rawName ? sanitizeFileName(rawName) : null,
      }
    } catch (err) {
      throw await toReadableAxiosError(err)
    }
  },

  async listMinutesVersions(meetingId: string): Promise<DriveFileVersionsPage> {
    const response = await api.get<DriveFileVersionsPage>(
      `/meetings/${meetingId}/minutes/versions`,
    )
    return response.data
  },

  async downloadMinutesVersion(
    meetingId: string,
    versionId: string,
  ): Promise<DownloadFileResult> {
    try {
      const response = await api.get<Blob>(
        `/meetings/${meetingId}/minutes/versions/${versionId}/download`,
        { responseType: 'blob' },
      )
      const rawName = extractFileNameFromContentDisposition(
        response.headers['content-disposition'],
      )
      return {
        blob: response.data,
        fileName: rawName ? sanitizeFileName(rawName) : null,
      }
    } catch (err) {
      throw await toReadableAxiosError(err)
    }
  },

  async restoreMinutesVersion(meetingId: string, versionId: string): Promise<DriveItem> {
    const response = await api.post<DriveItem>(
      `/meetings/${meetingId}/minutes/versions/${versionId}/restore`,
    )
    return response.data
  },

  async updateMinutesVersion(
    meetingId: string,
    versionId: string,
    keepForever: boolean,
  ): Promise<DriveFileVersion> {
    const response = await api.patch<DriveFileVersion>(
      `/meetings/${meetingId}/minutes/versions/${versionId}`,
      { keepForever },
    )
    return response.data
  },

  // --- Fase 3.2 — puntos de la reunión -------------------------------

  async listMeetingPoints(meetingId: string): Promise<MeetingPoint[]> {
    const response = await api.get<MeetingPoint[]>(`/meetings/${meetingId}/points`)
    return response.data
  },

  async createMeetingPoint(
    meetingId: string,
    payload: CreateMeetingPointPayload,
  ): Promise<MeetingPoint> {
    const response = await api.post<MeetingPoint>(`/meetings/${meetingId}/points`, payload)
    return response.data
  },

  async updateMeetingPoint(
    meetingId: string,
    pointId: string,
    payload: UpdateMeetingPointPayload,
  ): Promise<MeetingPoint> {
    const response = await api.patch<MeetingPoint>(
      `/meetings/${meetingId}/points/${pointId}`,
      payload,
    )
    return response.data
  },

  /** El backend devuelve `{ message, pointId }`, no la lista compactada —
   * quien llama (el store) es responsable de recargar los puntos después de
   * un borrado con éxito si quiere reflejar la compactación de posiciones. */
  async deleteMeetingPoint(
    meetingId: string,
    pointId: string,
  ): Promise<{ message: string; pointId: string }> {
    const response = await api.delete<{ message: string; pointId: string }>(
      `/meetings/${meetingId}/points/${pointId}`,
    )
    return response.data
  },

  /** `pointIds` debe representar el conjunto completo y final de puntos de
   * la reunión, sin ids repetidos, ausentes ni ajenos (el backend rechaza
   * con 400 cualquier otro caso) — nunca un subconjunto. */
  async reorderMeetingPoints(meetingId: string, pointIds: string[]): Promise<MeetingPoint[]> {
    const response = await api.patch<MeetingPoint[]>(`/meetings/${meetingId}/points/reorder`, {
      pointIds,
    })
    return response.data
  },

  // --- Fase 3.3a — asistentes de la reunión ---------------------------

  async listAttendeeOptions(meetingId: string): Promise<MeetingAttendeeOption[]> {
    const response = await api.get<MeetingAttendeeOption[]>(
      `/meetings/${meetingId}/attendee-options`,
    )
    return response.data
  },

  async listAttendees(meetingId: string): Promise<MeetingAttendee[]> {
    const response = await api.get<MeetingAttendee[]>(`/meetings/${meetingId}/attendees`)
    return response.data
  },

  /** `userIds` es la selección completa y final (`[]` la vacía). El backend
   * valida que cada id exista y sea elegible antes de escribir nada, y
   * devuelve la lista resultante ya ordenada. */
  async replaceAttendees(meetingId: string, userIds: string[]): Promise<MeetingAttendee[]> {
    const response = await api.put<MeetingAttendee[]>(`/meetings/${meetingId}/attendees`, {
      userIds,
    })
    return response.data
  },

  async updateAttendeeStatus(
    meetingId: string,
    userId: string,
    status: MeetingAttendanceStatus,
  ): Promise<MeetingAttendee> {
    const response = await api.patch<MeetingAttendee>(
      `/meetings/${meetingId}/attendees/${userId}`,
      { status },
    )
    return response.data
  },
}
