import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { isAxiosError } from 'axios'
import { driveDocumentsService } from '@/services/drive-documents.service'
import type { DriveDestinationNode } from '@/types'

/** Nombre del nodo raíz — el usuario nunca ha estado navegando antes de
 * abrir MoveItemDialog, así que el nombre debe explicar qué carpeta es sin
 * contexto previo (a diferencia de "Raíz", que usa el listado principal). */
const ROOT_LABEL = 'Fragua Documentos'

function describeError(err: unknown): string {
  if (isAxiosError(err) && err.response?.status === 404) {
    return 'Esta carpeta ya no existe o no está disponible.'
  }
  return 'No se ha podido cargar el contenido de Google Drive.'
}

/** Representación interna de un nodo — mutable, indexada por id de Drive.
 * `children` guarda ids (no objetos) para poder actualizar un nodo sin
 * reconstruir los de sus hermanos, y `parentId` permite reconstruir la ruta
 * completa de un nodo seleccionado caminando hacia la raíz. Nota: si una
 * misma carpeta apareciera como hija de dos padres distintos (Drive permite
 * varios padres), aquí comparte un único nodo — su `parentId` queda fijado
 * al primero que la descubrió. Es una simplificación deliberada: el caso es
 * raro en este gestor y tratarlo como dos nodos independientes complicaría
 * el árbol sin aportar valor real. */
interface InternalNode {
  id: string
  name: string
  parentId: string | null
  children: string[]
  childrenLoaded: boolean
  nextPageToken: string | null
  expanded: boolean
  loading: boolean
  error: string
}

function createNode(id: string, name: string, parentId: string | null): InternalNode {
  return {
    id,
    name,
    parentId,
    children: [],
    childrenLoaded: false,
    nextPageToken: null,
    expanded: false,
    loading: false,
    error: '',
  }
}

/**
 * Árbol de carpetas para el selector de destino de MoveItemDialog,
 * deliberadamente separado de `useDriveDocumentsStore`: no comparte ningún
 * estado con el listado principal — abrir el selector nunca debe alterar lo
 * que el usuario está viendo detrás del diálogo, y viceversa. Solo lista
 * carpetas (los archivos nunca son un destino válido) y arranca siempre en
 * la raíz conectada, sin permitir subir por encima de ella. Es el único
 * dueño de este estado y de las llamadas a `GET /drive/items` que lo
 * alimentan — los componentes del árbol son presentacionales y reciben todo
 * por props.
 */
export const useDriveDestinationStore = defineStore('drive-destination', () => {
  // Mapa plano id→nodo: acceso O(1) al expandir/paginar/reintentar
  // cualquier rama sin tener que recorrer el árbol. `reactive` (no `ref`)
  // porque Vue 3 rastrea `Map` en profundidad — mutar un campo de un nodo
  // ya obtenido con `.get()` dispara la reactividad igual que si fuera un
  // objeto propio.
  const nodesInternal = reactive(new Map<string, InternalNode>())

  // Id real de la carpeta raíz conectada — es también la clave del nodo
  // raíz en `nodesInternal`. `null` hasta que se resuelve la primera vez
  // que se abre el selector.
  const rootId = ref<string | null>(null)
  const isLoadingRoot = ref(false)
  const rootError = ref('')

  const selectedDestinationId = ref<string | null>(null)

  // Carpeta en la que se encontraba el elemento al abrir el diálogo — un
  // nodo con este id nunca es seleccionable (moverlo ahí sería un no-op).
  const sourceParentId = ref<string | null>(null)
  // Id del elemento que se está moviendo. Si es una carpeta, su nodo no es
  // seleccionable ni expandible — así, al no poder navegarse hasta ellos,
  // sus descendientes tampoco llegan nunca a formar parte del árbol.
  const excludedItemId = ref<string | null>(null)

  // Se incrementa en cada `open()` (apertura o reapertura del diálogo).
  // Toda petición en vuelo captura el valor vigente al empezar y, al
  // resolver, descarta su resultado si ya no coincide — así ni una
  // respuesta obsoleta de una rama abandonada ni una que llegue después de
  // cerrar y reabrir el diálogo (para el mismo elemento o para otro
  // distinto) pueden mutar el árbol de una sesión que ya no es la vigente.
  let sessionId = 0

  /**
   * Vista anidada del árbol para los componentes presentacionales: ya
   * resuelve `children` como nodos completos (no ids), así
   * `DriveDestinationTree`/`DriveDestinationTreeNode` no necesitan conocer
   * `nodesInternal` ni importar este store. Recalcula solo lo que cambió
   * gracias a la reactividad profunda de `nodesInternal`.
   */
  function buildView(id: string): DriveDestinationNode {
    const node = nodesInternal.get(id)!
    return {
      id: node.id,
      name: node.name,
      children: node.children.map(buildView),
      childrenLoaded: node.childrenLoaded,
      nextPageToken: node.nextPageToken,
      expanded: node.expanded,
      loading: node.loading,
      error: node.error,
    }
  }

  const tree = computed<DriveDestinationNode | null>(() =>
    rootId.value ? buildView(rootId.value) : null,
  )

  /** Ruta completa (raíz → seleccionado) del destino elegido, para
   * mostrarla en MoveItemDialog. Vacía si no hay selección. */
  const selectedPath = computed<{ id: string; name: string }[]>(() => {
    if (!selectedDestinationId.value) return []
    const path: { id: string; name: string }[] = []
    let current = nodesInternal.get(selectedDestinationId.value)
    while (current) {
      path.unshift({ id: current.id, name: current.name })
      current = current.parentId ? nodesInternal.get(current.parentId) : undefined
    }
    return path
  })

  /**
   * Carga (o pagina) los hijos de `nodeId`: sin `pageToken` si es la
   * primera vez (`!childrenLoaded`), o con el `nextPageToken` guardado si
   * ya se había cargado una página antes — así sirve tanto para "expandir
   * por primera vez" como para "cargar más" y para reintentar cualquiera de
   * los dos sin duplicar carpetas ni perder las ya mostradas. Solo se
   * quedan los elementos que son carpeta; el resto de la página (archivos)
   * se descarta aquí, nunca llega a mostrarse como destino.
   */
  async function loadChildren(nodeId: string) {
    const node = nodesInternal.get(nodeId)
    if (!node || node.loading) return

    const session = sessionId
    const pageToken = node.childrenLoaded ? (node.nextPageToken ?? undefined) : undefined
    node.loading = true
    node.error = ''

    try {
      const page = await driveDocumentsService.listItems({ parentId: nodeId, pageToken })
      if (session !== sessionId) return
      const folderItems = page.items.filter((item) => item.isFolder)
      for (const item of folderItems) {
        if (!nodesInternal.has(item.id)) {
          nodesInternal.set(item.id, createNode(item.id, item.name, nodeId))
        }
      }
      const newChildIds = folderItems.map((item) => item.id)
      node.children = node.childrenLoaded ? [...node.children, ...newChildIds] : newChildIds
      node.nextPageToken = page.nextPageToken
      node.childrenLoaded = true
    } catch (err) {
      if (session !== sessionId) return
      node.error = describeError(err)
    } finally {
      if (session === sessionId) node.loading = false
    }
  }

  /** Resuelve la raíz: id real, nombre fijo "Fragua Documentos" y su
   * primera página de subcarpetas, todo en la misma llamada a
   * `GET /drive/items` (sin `parentId`) que ya usaba el listado principal
   * para conocer `rootFolderId`. Paso previo obligatorio — hasta que
   * termina, no existe ningún nodo en el árbol. */
  async function loadRoot() {
    const session = sessionId
    isLoadingRoot.value = true
    rootError.value = ''

    try {
      const page = await driveDocumentsService.listItems({})
      if (session !== sessionId) return
      const folderItems = page.items.filter((item) => item.isFolder)
      const root: InternalNode = {
        id: page.rootFolderId,
        name: ROOT_LABEL,
        parentId: null,
        children: folderItems.map((item) => item.id),
        childrenLoaded: true,
        nextPageToken: page.nextPageToken,
        expanded: true,
        loading: false,
        error: '',
      }
      nodesInternal.set(root.id, root)
      for (const item of folderItems) {
        nodesInternal.set(item.id, createNode(item.id, item.name, root.id))
      }
      rootId.value = root.id
    } catch (err) {
      if (session !== sessionId) return
      rootError.value = describeError(err)
    } finally {
      if (session === sessionId) isLoadingRoot.value = false
    }
  }

  /**
   * Cierre real del selector — cancelar, Escape, backdrop o un movimiento
   * completado con éxito; nunca una ida y vuelta interna del árbol
   * (expandir/contraer/paginar/reintentar no pasan por aquí). Incrementa
   * `sessionId` primero, antes de tocar cualquier otro estado: así toda
   * carga en curso (`loadRoot`/`loadChildren`, ya en vuelo) queda invalidada
   * de inmediato — cuando resuelva, su comprobación de sesión la descartará
   * y no podrá repoblar un árbol que ya no se muestra — y solo entonces se
   * limpian los nodos, la selección y el contexto del elemento, para no
   * arrastrarlos a una apertura posterior que tarde en llegar. `open()`
   * reutiliza este mismo cierre como primer paso de cada sesión nueva.
   */
  function close() {
    sessionId++
    nodesInternal.clear()
    rootId.value = null
    isLoadingRoot.value = false
    rootError.value = ''
    selectedDestinationId.value = null
    excludedItemId.value = null
    sourceParentId.value = null
  }

  /**
   * Abre el selector desde cero para mover `itemId` (cuyo padre actual es
   * `parentId`): limpia cualquier estado de una apertura anterior (otro
   * elemento, ramas expandidas, una selección previa, cualquier carga que
   * siguiera en vuelo) y carga la raíz. Se llama cada vez que se abre
   * MoveItemDialog — incluida una reapertura para un elemento distinto —
   * así nunca arrastra la navegación de un intento anterior.
   */
  async function open(itemId: string, parentId: string) {
    close()
    excludedItemId.value = itemId
    sourceParentId.value = parentId
    await loadRoot()
  }

  async function retryRoot() {
    if (isLoadingRoot.value) return
    await loadRoot()
  }

  /** Expande o contrae `nodeId`; si se expande y sus hijos nunca se
   * cargaron con éxito, los pide. Contraer nunca descarta `children` — así
   * volver a expandir después no repite la petición ("no volver a solicitar
   * hijos ya cargados"). El nodo del elemento que se está moviendo no puede
   * expandirse en ningún caso: sus descendientes deben quedar inaccesibles. */
  function toggleNode(nodeId: string) {
    if (nodeId === excludedItemId.value) return
    const node = nodesInternal.get(nodeId)
    if (!node) return
    node.expanded = !node.expanded
    if (node.expanded && !node.childrenLoaded && !node.loading) {
      loadChildren(nodeId)
    }
  }

  function loadMoreNode(nodeId: string) {
    const node = nodesInternal.get(nodeId)
    if (!node || node.loading || !node.nextPageToken) return
    loadChildren(nodeId)
  }

  /** Sirve tanto para reintentar una primera carga fallida como una página
   * adicional fallida: `loadChildren` ya decide cuál de las dos según
   * `childrenLoaded`, así que no hace falta distinguirlas aquí. */
  function retryNode(nodeId: string) {
    loadChildren(nodeId)
  }

  /**
   * Selecciona `nodeId` como destino. Defensa además de lo que ya impide
   * pulsar esa fila en el árbol (el `:disabled` de
   * `DriveDestinationTreeNode`): un nodo desconocido, el padre actual del
   * elemento o el propio elemento que se está moviendo nunca se aceptan
   * como selección, aunque algo llegara a emitir el evento igualmente.
   */
  function selectDestination(nodeId: string) {
    if (!nodesInternal.has(nodeId)) return
    if (nodeId === sourceParentId.value) return
    if (nodeId === excludedItemId.value) return
    selectedDestinationId.value = nodeId
  }

  return {
    tree,
    isLoadingRoot,
    rootError,
    selectedDestinationId,
    selectedPath,
    sourceParentId,
    excludedItemId,
    open,
    close,
    retryRoot,
    toggleNode,
    loadMoreNode,
    retryNode,
    selectDestination,
  }
})
