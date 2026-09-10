import { api } from '@/services/api'
import type { DriveConnectUrlResponse, DriveDisconnectResponse, DriveStatus } from '@/types'

export const driveService = {
  async getStatus(): Promise<DriveStatus> {
    const response = await api.get<DriveStatus>('/drive/status')
    return response.data
  },

  async createConnectUrl(): Promise<DriveConnectUrlResponse> {
    const response = await api.post<DriveConnectUrlResponse>('/drive/connect-url')
    return response.data
  },

  async disconnect(): Promise<DriveDisconnectResponse> {
    const response = await api.post<DriveDisconnectResponse>('/drive/disconnect')
    return response.data
  },
}
