import type { DriveErrorCode } from '@/types'

/** 409/503 son sobre la conexión con Google Drive en sí, no sobre la
 * operación concreta — el mensaje es el mismo se esté listando, subiendo,
 * descargando o exportando un acta. `null` si el error no es de conexión.
 * Compartida por el gestor documental y por el acta de reuniones (fase 3.4),
 * que también depende de Drive. */
export function describeDriveConnectionError(
  status: number | undefined,
  code: string | undefined,
): { message: string; code: DriveErrorCode } | null {
  if (status === 409 && code === 'DRIVE_NOT_CONNECTED') {
    return {
      message: 'Google Drive no está conectado. Pide a un superadmin que lo conecte desde Ajustes.',
      code: 'DRIVE_NOT_CONNECTED',
    }
  }
  if (status === 409 && code === 'DRIVE_RECONNECT_REQUIRED') {
    return {
      message:
        'La conexión con Google Drive necesita reconectarse. Pide a un superadmin que la restablezca desde Ajustes.',
      code: 'DRIVE_RECONNECT_REQUIRED',
    }
  }
  if (status === 503) {
    return {
      message:
        'Google Drive no está disponible en este momento. Es un problema temporal — inténtalo de nuevo en unos segundos.',
      code: 'DRIVE_UNAVAILABLE',
    }
  }
  return null
}
