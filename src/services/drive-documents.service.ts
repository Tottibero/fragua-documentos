import { isAxiosError } from 'axios'
import { api } from '@/services/api'
import type { DriveItem, DriveItemPage, DriveUploadConfig } from '@/types'

export interface ListDriveItemsParams {
  /** Omitido = raíz de la conexión de Google Drive. */
  parentId?: string
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
async function toReadableAxiosError(err: unknown): Promise<unknown> {
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
    // No se fija `Content-Type` a mano: al recibir un `FormData`, Axios
    // genera por sí mismo la cabecera `multipart/form-data` con el
    // boundary correcto.
    const response = await api.post<DriveItem>('/drive/files', formData)
    return response.data
  },

  /** `PATCH /drive/items/:id` — renombra un archivo, carpeta o documento
   * nativo de Google conservando su `id`. `name` se envía tal cual; el
   * recorte y la validación ya los aplica el diálogo antes de llamar al
   * store, y el backend los vuelve a aplicar de forma independiente. */
  async renameItem(id: string, name: string): Promise<DriveItem> {
    const response = await api.patch<DriveItem>(`/drive/items/${id}`, { name })
    return response.data
  },

  /** `PATCH /drive/items/:id/move` — mueve un archivo, carpeta o documento
   * nativo de Google a otra carpeta contenida en la raíz, conservando su
   * `id`. `parentId` es siempre un id de Drive concreto — nunca el sentinel
   * `null` de raíz que usa la navegación local — porque el backend no
   * admite "mover a la raíz" de forma implícita. */
  async moveItem(id: string, parentId: string): Promise<DriveItem> {
    const response = await api.patch<DriveItem>(`/drive/items/${id}/move`, { parentId })
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
}
