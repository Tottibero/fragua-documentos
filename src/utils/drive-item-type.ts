import type { DriveItem } from '@/types'

/**
 * Etiqueta legible por `mimeType` — misma tabla que usaba `DriveItemsList`
 * antes de extraerse aquí. Fuente única para cualquier lugar que necesite
 * mostrar el tipo de un `DriveItem` (el listado principal y, desde la fase
 * 2.6, `NameConflictResolver`).
 */
const MIME_TYPE_LABELS: Record<string, string> = {
  'application/vnd.google-apps.document': 'Documento de Google',
  'application/vnd.google-apps.spreadsheet': 'Hoja de cálculo de Google',
  'application/vnd.google-apps.presentation': 'Presentación de Google',
  'application/vnd.google-apps.form': 'Formulario de Google',
  'application/vnd.google-apps.drawing': 'Dibujo de Google',
  'application/pdf': 'PDF',
  'application/msword': 'Documento de Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento de Word',
  'application/vnd.ms-excel': 'Hoja de cálculo de Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Hoja de cálculo de Excel',
  'application/vnd.ms-powerpoint': 'Presentación de PowerPoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'Presentación de PowerPoint',
  'text/plain': 'Texto',
  'text/csv': 'CSV',
  'application/zip': 'Archivo comprimido',
  'application/json': 'JSON',
}

const GOOGLE_NATIVE_MIME_PREFIX = 'application/vnd.google-apps.'

/** Documentos/hojas/presentaciones... nativos de Google no tienen contenido
 * binario propio: `GET /drive/files/:id/download` los rechaza con 400 y
 * `POST /drive/files/:id/versions` (reemplazo) con
 * `DRIVE_FILE_REPLACE_NOT_SUPPORTED`. Ni el listado ofrece descarga/nueva
 * versión sobre ellos, ni `NameConflictResolver` puede ofrecerlos como
 * destino de "Reemplazar existente". */
export function isGoogleNative(mimeType: string): boolean {
  return mimeType.startsWith(GOOGLE_NATIVE_MIME_PREFIX)
}

export function readableDriveItemType(item: DriveItem): string {
  if (item.isFolder) return 'Carpeta'
  const known = MIME_TYPE_LABELS[item.mimeType]
  if (known) return known
  if (item.mimeType.startsWith('image/')) return 'Imagen'
  if (item.mimeType.startsWith('video/')) return 'Vídeo'
  if (item.mimeType.startsWith('audio/')) return 'Audio'
  const subtype = item.mimeType.split('/')[1]
  return subtype ? subtype.toUpperCase() : 'Archivo'
}

/** Un conflicto solo puede elegirse como destino de "Reemplazar existente"
 * (subida, fase 2.6) si es un archivo binario normal: ni carpeta ni
 * documento nativo de Google, exactamente lo que ambos backend y frontend ya
 * excluyen de "nueva versión" en `ReplaceFileDialog`. */
export function isReplaceableDriveItem(item: DriveItem): boolean {
  return !item.isFolder && !isGoogleNative(item.mimeType)
}
