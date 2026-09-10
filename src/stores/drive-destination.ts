import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { driveDocumentsService } from '@/services/drive-documents.service'
import type { DriveBreadcrumb, DriveItem } from '@/types'

/** Etiqueta del tramo raíz de este selector — deliberadamente distinta de
 * "Raíz" (la que usa el listado principal): aquí el usuario nunca ha estado
 * navegando antes de abrir MoveItemDialog, así que el nombre debe explicar
 * qué carpeta es sin contexto previo. */
const ROOT_LABEL = 'Fragua Documentos'

function describeError(err: unknown): string {
  if (isAxiosError(err) && err.response?.status === 404) {
    return 'Esta carpeta ya no existe o no está disponible.'
  }
  return 'No se ha podido cargar el contenido de Google Drive.'
}

/**
 * Navegación de carpetas para el selector de destino de MoveItemDialog,
 * deliberadamente separada de `useDriveDocumentsStore`: no comparte
 * `items`, `breadcrumbs` ni paginación con el listado principal — abrir el
 * selector nunca debe alterar lo que el usuario está viendo detrás del
 * diálogo, y viceversa. Solo lista carpetas (los archivos nunca son un
 * destino válido) y arranca siempre en la raíz conectada, sin permitir subir
 * por encima de ella.
 */
export const useDriveDestinationStore = defineStore('drive-destination', () => {
  const breadcrumbs = ref<DriveBreadcrumb[]>([])
  const items = ref<DriveItem[]>([])
  const nextPageToken = ref<string | null>(null)
  // Id real de la carpeta raíz conectada, resuelto en el primer listado —
  // necesario porque el sentinel `null` de `currentFolderId` (raíz) no es un
  // id utilizable como destino: el backend siempre espera un id concreto.
  const rootFolderId = ref<string | null>(null)

  const isLoading = ref(false)
  const error = ref('')
  const isLoadingMore = ref(false)
  const loadMoreError = ref('')

  // Id del elemento que se está moviendo. Una carpeta con este id aparece en
  // el listado (no se oculta: el usuario debe ver que sigue ahí) pero
  // deshabilitada y sin poder entrar en ella — así, al no poder navegarse
  // hasta ellos, sus descendientes tampoco llegan nunca a listarse como
  // destino posible.
  const excludedItemId = ref<string | null>(null)

  // Igual que en el store documental principal: identifica la petición de
  // listado vigente para que una respuesta obsoleta (de una carga o de una
  // paginación anterior) nunca pueda sobrescribir un estado más reciente ni
  // dejar `isLoading`/`isLoadingMore` bloqueados para siempre.
  let requestSeq = 0

  const currentFolderId = computed(
    () => breadcrumbs.value[breadcrumbs.value.length - 1]?.id ?? null,
  )

  /** Destino real que se enviaría al backend si se confirma "Mover aquí":
   * el id de la carpeta que se está viendo, resuelto a `rootFolderId`
   * cuando esa carpeta es la raíz (sentinel `null`). `null` solo antes de
   * que la primera carga resuelva `rootFolderId` — mientras tanto no hay
   * destino válido todavía. */
  const destinationId = computed(() => currentFolderId.value ?? rootFolderId.value)

  /** Solo las carpetas son destinos válidos — se filtra aquí, no en el
   * backend, así que `nextPageToken` sigue reflejando la paginación real de
   * `GET /drive/items` aunque una página entera no contenga ninguna. */
  const folders = computed(() => items.value.filter((item) => item.isFolder))

  /**
   * `true` solo cuando `destinationId` es un id de Drive verificado y
   * estable — la única condición segura para activar "Mover aquí" en
   * cuanto al *estado del selector* (el diálogo añade encima sus propias
   * comprobaciones sobre `item`/`sourceParentId`). `false` mientras:
   * - `destinationId` no se ha resuelto todavía (`rootFolderId`
   *   desconocido nada más abrir el selector);
   * - hay una carga en curso, sea la inicial, una navegación a otra
   *   carpeta o una página adicional (`isLoading`/`isLoadingMore`);
   * - la última carga de la carpeta que se está mostrando terminó en
   *   error. Esto es crítico: `openFolder`/`goToBreadcrumb` actualizan
   *   `breadcrumbs` (y por tanto `currentFolderId`/`destinationId`) *antes*
   *   de que la petición confirme que esa carpeta existe y es accesible —
   *   si esa petición falla, `destinationId` sigue apuntando a un destino
   *   nunca verificado (ambiguo) en vez de volver al anterior, así que un
   *   error debe bloquear el envío exactamente igual que una carga en
   *   curso, no solo ocultar el listado de carpetas.
   */
  const isDestinationReady = computed(
    () => destinationId.value !== null && !isLoading.value && !isLoadingMore.value && !error.value,
  )

  async function loadFolder(parentId: string | null) {
    const requestId = ++requestSeq
    isLoading.value = true
    error.value = ''
    items.value = []
    nextPageToken.value = null
    isLoadingMore.value = false
    loadMoreError.value = ''

    try {
      const page = await driveDocumentsService.listItems({ parentId: parentId ?? undefined })
      if (requestId !== requestSeq) return
      items.value = page.items
      nextPageToken.value = page.nextPageToken
      rootFolderId.value = page.rootFolderId
      if (breadcrumbs.value.length === 0) {
        breadcrumbs.value = [{ id: null, name: ROOT_LABEL }]
      }
    } catch (err) {
      if (requestId !== requestSeq) return
      error.value = describeError(err)
    } finally {
      if (requestId === requestSeq) isLoading.value = false
    }
  }

  /**
   * Abre el selector desde cero para mover `itemId`: limpia cualquier
   * estado de una apertura anterior (otro elemento, otra carpeta explorada,
   * un error previo) y carga la raíz. Se llama cada vez que se abre
   * MoveItemDialog — incluida una reapertura para un elemento distinto —
   * así nunca arrastra la navegación de un intento anterior.
   */
  async function open(itemId: string) {
    excludedItemId.value = itemId
    breadcrumbs.value = []
    await loadFolder(null)
  }

  /** `true` solo si esta llamada llegó a iniciar la navegación (no
   * bloqueada por reentrada) — mismo criterio que el store documental
   * principal. Una carpeta igual a `excludedItemId` (el elemento que se
   * está moviendo) nunca se abre: así ni ella ni sus descendientes pueden
   * acabar propuestos como destino. */
  async function openFolder(item: DriveItem): Promise<boolean> {
    if (!item.isFolder) return false
    if (item.id === excludedItemId.value) return false
    if (isLoading.value) return false
    breadcrumbs.value = [...breadcrumbs.value, { id: item.id, name: item.name }]
    await loadFolder(item.id)
    return true
  }

  async function goToBreadcrumb(index: number): Promise<boolean> {
    if (index < 0 || index >= breadcrumbs.value.length - 1) return false
    if (isLoading.value) return false
    breadcrumbs.value = breadcrumbs.value.slice(0, index + 1)
    await loadFolder(currentFolderId.value)
    return true
  }

  async function retry() {
    await loadFolder(currentFolderId.value)
  }

  async function loadMore() {
    if (isLoading.value || isLoadingMore.value || !nextPageToken.value) return

    const requestId = ++requestSeq
    const parentId = currentFolderId.value
    const pageToken = nextPageToken.value
    isLoadingMore.value = true
    loadMoreError.value = ''

    try {
      const page = await driveDocumentsService.listItems({
        parentId: parentId ?? undefined,
        pageToken,
      })
      if (requestId !== requestSeq) return
      items.value = [...items.value, ...page.items]
      nextPageToken.value = page.nextPageToken
      rootFolderId.value = page.rootFolderId
    } catch (err) {
      if (requestId !== requestSeq) return
      loadMoreError.value = describeError(err)
    } finally {
      if (requestId === requestSeq) isLoadingMore.value = false
    }
  }

  return {
    breadcrumbs,
    items,
    folders,
    nextPageToken,
    rootFolderId,
    currentFolderId,
    destinationId,
    isDestinationReady,
    excludedItemId,
    isLoading,
    error,
    isLoadingMore,
    loadMoreError,
    open,
    openFolder,
    goToBreadcrumb,
    retry,
    loadMore,
  }
})
