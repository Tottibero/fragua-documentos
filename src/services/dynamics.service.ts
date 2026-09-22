import { api } from '@/services/api'
import {
  extractFileNameFromContentDisposition,
  sanitizeFileName,
  toReadableAxiosError,
  type DownloadFileResult,
} from '@/services/drive-documents.service'
import type { Dynamic, DynamicDetail, DynamicEntry, DynamicPdf, MeetingCreatedBy } from '@/types'

export interface DynamicPayload {
  title: string
  date: string
}

export interface DynamicEntryPayload {
  title: string
  description: string
  authorUserId: string | null
}

export const dynamicsService = {
  /** Candidatos del selector de autor. */
  async listEntryAuthorOptions(): Promise<MeetingCreatedBy[]> {
    return (await api.get<MeetingCreatedBy[]>('/users', {
      params: { roles: 'admin,superadmin' },
    })).data
  },

  async list(): Promise<Dynamic[]> {
    return (await api.get<Dynamic[]>('/dynamics')).data
  },

  async get(id: string): Promise<DynamicDetail> {
    return (await api.get<DynamicDetail>(`/dynamics/${id}`)).data
  },

  async create(payload: DynamicPayload): Promise<Dynamic> {
    return (await api.post<Dynamic>('/dynamics', payload)).data
  },

  async update(id: string, payload: Partial<DynamicPayload>): Promise<Dynamic> {
    return (await api.patch<Dynamic>(`/dynamics/${id}`, payload)).data
  },

  async createEntry(id: string, payload: DynamicEntryPayload): Promise<DynamicEntry> {
    return (await api.post<DynamicEntry>(`/dynamics/${id}/entries`, payload)).data
  },

  async updateEntry(
    id: string,
    entryId: string,
    payload: Partial<DynamicEntryPayload>,
  ): Promise<DynamicEntry> {
    return (await api.patch<DynamicEntry>(`/dynamics/${id}/entries/${entryId}`, payload)).data
  },

  async deleteEntry(id: string, entryId: string): Promise<void> {
    await api.delete(`/dynamics/${id}/entries/${entryId}`)
  },

  async exportPdf(id: string): Promise<DynamicPdf> {
    return (await api.post<DynamicPdf>(`/dynamics/${id}/pdf`)).data
  },

  async downloadPdf(id: string): Promise<DownloadFileResult> {
    try {
      const response = await api.get<Blob>(`/dynamics/${id}/pdf/download`, { responseType: 'blob' })
      const rawName = extractFileNameFromContentDisposition(response.headers['content-disposition'])
      return { blob: response.data, fileName: rawName ? sanitizeFileName(rawName) : null }
    } catch (err) {
      throw await toReadableAxiosError(err)
    }
  },
}
