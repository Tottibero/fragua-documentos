import { isAxiosError } from 'axios'
import { api } from '@/services/api'
import type {
  DriveConflictResolution,
  DriveFileVersion,
  DriveFileVersionsPage,
  DriveItem,
  DriveItemPage,
  DriveNameConflictResponse,
  DriveRestoreResult,
  DriveTrashPage,
  DriveTrashResponse,
  DriveUploadConfig,
} from '@/types'

export interface ListDriveItemsParams {
  /** Omitido = raíz de la conexión de Google Drive. */
  parentId?: string
  pageToken?: string
  pageSize?: number
}

export interface ListTrashParams {
  pageToken?: string
  pageSize?: number
}

export interface CreateFolderParams {
  name: string
  /** Omitido = crear en la raíz de la conexión de Google Drive. */
  parentId?: string
}

export interface UploadFileParams {
  file: File
  /** Omitido = subir a la raíz de la conexión de Google Drive. */
  parentId?: string
  /** Fase 2.6: omitido en la primera petición (o `'error'`, equivalente) —
   * el backend lo trata igual y responde `409 DRIVE_NAME_CONFLICT` si ya
   * existe un elemento con ese nombre. Solo se rellena al reenviar tras un
   * conflicto, con la decisión explícita del usuario. */
  conflictResolution?: DriveConflictResolution
  /** Solo junto a `conflictResolution: 'replace'`: el `id` (de
   * `conflicts` en el `409` anterior) del archivo existente cuyo contenido
   * se sobrescribe en vez de crear uno nuevo. */
  conflictItemId?: string
}

export interface DownloadFileResult {
  blob: Blob
  /** `null` si la cabecera falta o no se pudo interpretar — el llamador
   * decide entonces el nombre de repuesto (el del `DriveItem` conocido). */
  fileName: string | null
}

/** Caracteres que no deben acabar en un nombre de archivo local: separadores
 * de ruta y caracteres de control. Se reemplazan, nunca se rechaza el
 * nombre — el propio Drive puede tener nombres con caracteres que nuestros
 * validadores de creación/subida no permitirían, pero que aun así hay que
 * poder guardar localmente (p. ej. añadidos directamente desde Drive). */
// eslint-disable-next-line no-control-regex -- se excluyen deliberadamente los caracteres de control
const UNSAFE_LOCAL_FILENAME_PATTERN = /[/\\\x00-\x1F]/g

export function sanitizeFileName(name: string): string {
  const sanitized = name.replace(UNSAFE_LOCAL_FILENAME_PATTERN, '_').trim()
  return sanitized || 'archivo'
}

/** Decodifica un valor `ext-value` de RFC 5987 (usado por
 * `filename*=UTF-8''...`) — envoltorio de `decodeURIComponent` que nunca
 * lanza. */
function decodeRfc5987(value: string): string | null {
  try {
    return decodeURIComponent(value.trim())
  } catch {
    return null
  }
}

/**
 * Extrae el nombre de archivo de una cabecera `Content-Disposition`,
 * priorizando `filename*=UTF-8''...` (RFC 5987, admite no-ASCII) sobre
 * `filename="..."` (el fallback ASCII que el propio backend envía junto al
 * anterior). Devuelve `null` si la cabecera falta o no contiene ninguno de
 * los dos — nunca lanza.
 */
export function extractFileNameFromContentDisposition(
  contentDisposition: string | null | undefined,
): string | null {
  if (!contentDisposition) return null

  const extendedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (extendedMatch) {
    const decoded = decodeRfc5987(extendedMatch[1])
    if (decoded) return decoded
  }

  const quotedMatch = contentDisposition.match(/filename="([^"]*)"/i)
  if (quotedMatch) return quotedMatch[1]

  return null
}

/**
 * Con `responseType: 'blob'`, Axios entrega también el cuerpo de un error
 * como `Blob` — aunque el servidor haya respondido en JSON — así que sin
 * esto el store no podría leer `response.data.code`. Lee el `Blob` y, si
 * contiene JSON válido, sustituye `response.data` por el objeto ya
 * parseado antes de relanzar el mismo error; si no es JSON legible, se
 * relanza sin tocar (el store lo tratará como un fallo sin `code`
 * reconocido, igual que cualquier otro).
 */
export async function toReadableAxiosError(err: unknown): Promise<unknown> {
  if (isAxiosError(err) && err.response && err.response.data instanceof Blob) {
    try {
      const text = await err.response.data.text()
      err.response.data = JSON.parse(text)
    } catch {
      // Cuerpo no JSON, o Blob no legible — se relanza tal cual.
    }
  }
  return err
}

const REPLACE_ALLOWED_VALUES = ['keep_both', 'replace'] as const

function isDriveItemShape(value: unknown): value is DriveItem {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.mimeType === 'string' &&
    typeof candidate.isFolder === 'boolean'
  )
}

/**
 * Reconoce un `409 DRIVE_NAME_CONFLICT` (subida, renombrado o movimiento) y
 * devuelve su cuerpo ya tipado, o `null` si `err` no es ese error — nunca
 * por el texto de `message`, siempre por `response.data.code`. Fuente única
 * para los tres flujos: ninguno debe repetir esta comprobación ni confiar en
 * `conflicts`/`allowedResolutions` sin validar antes su forma, porque este
 * cuerpo (a diferencia del resto de errores de Drive) no pasa por
 * `DriveHttpException` y por tanto no tiene la garantía de forma que sí dan
 * `describe*Error` para el resto de códigos.
 */
export function extractDriveNameConflict(err: unknown): DriveNameConflictResponse | null {
  if (!isAxiosError(err) || err.response?.status !== 409) return null

  const data = err.response.data as
    | { code?: unknown; message?: unknown; conflicts?: unknown; allowedResolutions?: unknown }
    | undefined
  if (!data || data.code !== 'DRIVE_NAME_CONFLICT') return null
  if (!Array.isArray(data.conflicts) || !data.conflicts.every(isDriveItemShape)) return null
  if (!Array.isArray(data.allowedResolutions)) return null

  const allowedResolutions = data.allowedResolutions.filter(
    (resolution): resolution is 'keep_both' | 'replace' =>
      (REPLACE_ALLOWED_VALUES as readonly string[]).includes(resolution as string),
  )
  // Sin ninguna resolución utilizable no hay nada que ofrecer al usuario —
  // se trata como si no se hubiera podido reconocer el conflicto, así el
  // llamador cae en su mensaje de error genérico en vez de mostrar un
  // diálogo de resolución sin acciones posibles.
  if (allowedResolutions.length === 0) return null

  return {
    statusCode: 409,
    code: 'DRIVE_NAME_CONFLICT',
    message:
      typeof data.message === 'string' && data.message
        ? data.message
        : 'Ya existe un elemento con ese nombre en el destino.',
    conflicts: data.conflicts,
    allowedResolutions,
  }
}

export const driveDocumentsService = {
  async listItems(params: ListDriveItemsParams = {}): Promise<DriveItemPage> {
    const response = await api.get<DriveItemPage>('/drive/items', { params })
    return response.data
  },

  async createFolder(params: CreateFolderParams): Promise<DriveItem> {
    const response = await api.post<DriveItem>('/drive/folders', params)
    return response.data
  },

  async getUploadConfig(): Promise<DriveUploadConfig> {
    const response = await api.get<DriveUploadConfig>('/drive/upload-config')
    return response.data
  },

  async uploadFile(params: UploadFileParams): Promise<DriveItem> {
    const formData = new FormData()
    formData.append('file', params.file)
    if (params.parentId) {
      formData.append('parentId', params.parentId)
    }
    // Fase 2.6: solo se añaden los campos que llegan definidos — nunca el
    // literal "undefined" como valor de un campo multipart.
    if (params.conflictResolution) {
      formData.append('conflictResolution', params.conflictResolution)
    }
    if (params.conflictItemId) {
      formData.append('conflictItemId', params.conflictItemId)
    }
    // No se fija `Content-Type` a mano: al recibir un `FormData`, Axios
    // genera por sí mismo la cabecera `multipart/form-data` con el
    // boundary correcto.
    const response = await api.post<DriveItem>('/drive/files', formData)
    return response.data
  },

  /** `PATCH /drive/items/:id` — renombra un archivo, carpeta o documento
   * nativo de Google conservando su `id`. `name` se envía tal cual; el
   * recorte y la validación ya los aplica el diálogo antes de llamar al
   * store, y el backend los vuelve a aplicar de forma independiente.
   * `conflictResolution` (fase 2.6) es solo `'keep_both'` o se omite — el
   * backend rechaza `'replace'` en un renombrado con un 400 llano, porque no
   * lleva contenido nuevo que escribir. */
  async renameItem(
    id: string,
    name: string,
    conflictResolution?: DriveConflictResolution,
  ): Promise<DriveItem> {
    const response = await api.patch<DriveItem>(`/drive/items/${id}`, {
      name,
      conflictResolution,
    })
    return response.data
  },

  /** `PATCH /drive/items/:id/move` — mueve un archivo, carpeta o documento
   * nativo de Google a otra carpeta contenida en la raíz, conservando su
   * `id`. `parentId` es siempre un id de Drive concreto — nunca el sentinel
   * `null` de raíz que usa la navegación local — porque el backend no
   * admite "mover a la raíz" de forma implícita. `conflictResolution` (fase
   * 2.6): mismo criterio que en `renameItem`, solo `'keep_both'` o se omite. */
  async moveItem(
    id: string,
    parentId: string,
    conflictResolution?: DriveConflictResolution,
  ): Promise<DriveItem> {
    const response = await api.patch<DriveItem>(`/drive/items/${id}/move`, {
      parentId,
      conflictResolution,
    })
    return response.data
  },

  /** `POST /drive/files/:id/versions` — sube un nuevo contenido para un
   * archivo binario existente, conservando su `id`, nombre y ubicación en
   * Drive; el backend genera una nueva revisión. */
  async replaceFileContent(id: string, file: File): Promise<DriveItem> {
    const formData = new FormData()
    formData.append('file', file)
    // No se fija `Content-Type` a mano: mismo motivo que en `uploadFile`.
    const response = await api.post<DriveItem>(`/drive/files/${id}/versions`, formData)
    return response.data
  },

  async downloadFile(id: string): Promise<DownloadFileResult> {
    try {
      const response = await api.get<Blob>(`/drive/files/${id}/download`, {
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

  /** `GET /drive/files/:id/versions` — historial de revisiones binarias de
   * un archivo, más recientes y antiguas incluidas; `isCurrent` ya viene
   * resuelto por el backend. */
  async listFileVersions(id: string): Promise<DriveFileVersionsPage> {
    const response = await api.get<DriveFileVersionsPage>(`/drive/files/${id}/versions`)
    return response.data
  },

  /** `GET /drive/files/:id/versions/:versionId/download` — descarga una
   * revisión concreta (no necesariamente la vigente). Mismo tratamiento de
   * `Content-Disposition` y de errores en `Blob` que `downloadFile`. */
  async downloadFileVersion(id: string, versionId: string): Promise<DownloadFileResult> {
    try {
      const response = await api.get<Blob>(`/drive/files/${id}/versions/${versionId}/download`, {
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

  /** `POST /drive/files/:id/versions/:versionId/restore` — guarda el
   * contenido de una revisión anterior como la nueva revisión vigente del
   * mismo `fileId`; el backend no reescribe ni elimina ninguna revisión
   * existente. Devuelve el `DriveItem` actualizado (mismo nombre y
   * ubicación, tamaño y fecha de modificación nuevos). */
  async restoreFileVersion(id: string, versionId: string): Promise<DriveItem> {
    const response = await api.post<DriveItem>(`/drive/files/${id}/versions/${versionId}/restore`)
    return response.data
  },

  /** `PATCH /drive/files/:id/versions/:versionId` — marca o desmarca
   * `keepForever` en una revisión concreta, sin tocar ninguna otra. */
  async updateFileVersion(
    id: string,
    versionId: string,
    keepForever: boolean,
  ): Promise<DriveFileVersion> {
    const response = await api.patch<DriveFileVersion>(
      `/drive/files/${id}/versions/${versionId}`,
      { keepForever },
    )
    return response.data
  },

  /** `POST /drive/items/:id/trash` — envía un archivo, carpeta o documento
   * nativo de Google a la papelera de Drive (`trashed: true`), sin borrado
   * definitivo. */
  async trashItem(id: string): Promise<DriveTrashResponse> {
    const response = await api.post<DriveTrashResponse>(`/drive/items/${id}/trash`)
    return response.data
  },

  /** `GET /drive/trash` — lista únicamente los elementos eliminados dentro
   * del espacio gestionado (`rootFolderId`), paginada igual que
   * `listItems`. */
  async listTrash(params: ListTrashParams = {}): Promise<DriveTrashPage> {
    const response = await api.get<DriveTrashPage>('/drive/trash', { params })
    return response.data
  },

  /** `POST /drive/items/:id/restore` — restaura un elemento de la papelera.
   * El backend intenta devolverlo a la carpeta en la que estaba antes de
   * eliminarse; si esa carpeta ya no existe o no está disponible, lo
   * recupera en la raíz gestionada e informa de ello con
   * `restoredToRoot: true`. */
  async restoreItem(id: string): Promise<DriveRestoreResult> {
    const response = await api.post<DriveRestoreResult>(`/drive/items/${id}/restore`)
    return response.data
  },
}
