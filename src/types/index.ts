/**
 * Tipos compartidos de la aplicación.
 * Fuente única de verdad para las formas de datos de autenticación.
 */

export type UserRole = 'superadmin' | 'admin' | 'user'

export interface User {
  id: string
  nickname: string
  role: UserRole
}

export interface LoginPayload {
  identifier: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
}

export type DriveConnectionState =
  | 'not_connected'
  | 'connected'
  | 'revoked'
  | 'unreadable_token'
  | 'google_unavailable'

export interface DriveStatus {
  connected: boolean
  state: DriveConnectionState
  rootFolderId: string | null
  connectedAt: string | null
}

export interface DriveConnectUrlResponse {
  url: string
}

export interface DriveDisconnectResponse {
  message: string
}

export interface DriveItem {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  size: number | null
  createdTime: string | null
  modifiedTime: string | null
}

export interface DriveItemPage {
  items: DriveItem[]
  nextPageToken: string | null
  rootFolderId: string
}

/** Códigos estables que el backend devuelve en `code` junto al cuerpo de
 * error de los endpoints documentales (listar, crear carpeta, subir
 * archivo) — nunca se debe distinguir por texto. */
export type DriveErrorCode =
  | 'DRIVE_NOT_CONNECTED'
  | 'DRIVE_RECONNECT_REQUIRED'
  | 'DRIVE_UNAVAILABLE'
  | 'DRIVE_FILE_REQUIRED'
  | 'DRIVE_FILE_EMPTY'
  | 'DRIVE_FILE_NAME_INVALID'
  | 'DRIVE_FILE_TOO_LARGE'
  | 'DRIVE_UPLOAD_ERROR'
  | 'DRIVE_MOVE_INVALID'

/** Un nivel de la ruta de navegación documental. `id: null` representa la
 * raíz (la petición a `/drive/items` correspondiente no lleva `parentId`). */
export interface DriveBreadcrumb {
  id: string | null
  name: string
}

export interface DriveUploadConfig {
  maxUploadBytes: number
}
