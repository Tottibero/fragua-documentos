# Hoja de ruta del gestor documental

Este documento divide el desarrollo en entregas pequeñas y verificables. Google Drive
seguirá siendo el almacenamiento, mientras que Fragua gestionará la interfaz, los usuarios,
los permisos internos y la trazabilidad. Los usuarios de Fragua no necesitarán iniciar
sesión en Google.

## Forma de trabajo

Para cada capacidad nueva se seguirá siempre este orden:

1. Implementar el contrato y la lógica en `fragua-gestion/back`.
2. Revisar y corregir el backend.
3. Implementar la interfaz en `fragua-documentos`.
4. Revisar y probar el recorrido completo en local.
5. Cerrar la fase antes de empezar la siguiente.

No se desplegará a producción hasta completar y revisar todas las fases elegidas para la
primera versión. Cada fase debe conservar la contención dentro de `rootFolderId`, no exponer
errores ni credenciales de Google y respetar los roles de Fragua.

## Estado actual

- [x] Frontend independiente con Vue, autenticación, sesión y layout.
- [x] Conexión OAuth de una única cuenta de Google Drive.
- [x] Pantalla de conexión, reconexión, estado y desconexión para `superadmin`.
- [x] Conexión comprobada en local contra Google Drive.
- [x] Backend para listar, crear carpetas, subir y descargar: revisado y aprobado.
- [x] Ampliación OAuth para mostrar también archivos añadidos directamente en Drive, validada en local.
- [x] Navegación por carpetas: fase 1.2 completada y validada en local.
- [x] Creación de carpetas: completada y validada en local.
- [x] Subida de archivos: completada y validada en local.
- [x] Descarga de archivos: completada y validada en local.
- [x] Validación local integral del bloque básico completada.
- [x] Bloque 1 completado y validado en local.
- [~] Bloque 2 en curso: fase 2.1 completada; fase 2.2 aprobada técnicamente, pendiente validación manual.

## Bloque 1 — Gestor documental básico

### 1.1 Cerrar el backend actual — completada

- Corregir la cancelación de descargas para que no deje peticiones pendientes.
- Validar el `fileId` de descarga antes de consultar Google.
- Diferenciar un recurso ajeno de una revocación real de la conexión.
- Validar los nombres después de normalizarlos.
- Completar la codificación segura de `Content-Disposition`.
- Repetir la revisión del módulo y aprobar sus contratos.

Resultado: API estable para listar, crear carpetas, subir y descargar.

### 1.1 bis — Archivos añadidos directamente en Drive — completada

- Sustituir el scope limitado `drive.file` por `drive` para que la cuenta conectada pueda
  listar y gestionar también archivos creados fuera de Fragua.
- Mantener todas las operaciones confinadas en el backend a `rootFolderId`.
- Preservar el `rootFolderId` anterior durante una reconexión directa y abortar sin cambiarlo
  si Google no permite comprobarlo por un fallo temporal o ambiguo.
- Reconectar la cuenta de Google para emitir un refresh token con el nuevo permiso.
- Confirmar en local que aparece un archivo añadido directamente a la carpeta raíz desde
  Google Drive.
- Tener en cuenta que el scope completo es restringido y puede requerir verificación de
  Google antes de producción.

Resultado: reconexión completada conservando la raíz existente y navegación local verificada
sobre una carpeta, una subcarpeta y un PDF añadidos directamente desde Google Drive.

### 1.2 Navegar por carpetas — completada

- Añadir al frontend los tipos, servicio y store de elementos de Drive.
- Mostrar el contenido de la carpeta raíz.
- Permitir entrar en subcarpetas y volver a la carpeta anterior.
- Mostrar nombre, tipo, tamaño y fecha de modificación.
- Incluir carga, carpeta vacía, error y reintento.
- Mantener la carpeta actual al paginar.
- Evitar navegaciones duplicadas y conservar un foco lógico al entrar en carpetas o volver
  mediante breadcrumbs.

Resultado: cualquier usuario autenticado puede recorrer los documentos desde Fragua.

### 1.3 Crear carpetas — completada

- Añadir la acción “Nueva carpeta”.
- Pedir y validar el nombre en un diálogo accesible.
- Crear dentro de la carpeta que se está viendo.
- Actualizar el listado y mostrar errores sin perder la navegación actual.

Resultado: se pueden organizar documentos sin abrir Google Drive.

Validación completada en local: creación dentro de la carpeta actual, actualización del
listado, tratamiento de nombres inválidos y retorno de foco comprobados.

### 1.4 Subir archivos — completada

- Añadir selector de archivo y zona de arrastre.
- Mostrar el límite configurado antes de subir.
- Mostrar progreso o, como mínimo, estado de subida bloqueando envíos duplicados.
- Subir a la carpeta actual y actualizar el listado.
- Tratar de forma específica archivo vacío, nombre inválido, exceso de tamaño y fallo de
  conexión.

Resultado: se pueden incorporar documentos desde la aplicación.

Validación completada en local: selección y arrastre, límite de tamaño, errores, subida a la
carpeta actual, actualización del listado y retorno de foco comprobados.

### 1.5 Descargar archivos — completada

- Descargar mediante la API autenticada, no mediante enlaces públicos de Google.
- Conservar el nombre indicado por `Content-Disposition`.
- Evitar acciones duplicadas mientras comienza la descarga.
- Mostrar correctamente los errores de archivo inexistente o conexión no disponible.

Resultado: los usuarios pueden recuperar los archivos sin acceder a Drive.

Validación completada en local: descarga autenticada, conservación del nombre, bloqueo de
acciones duplicadas y tratamiento contextual de errores comprobados.

### 1.6 Validación local del bloque básico — completada

- Recorrer varias carpetas y páginas.
- Crear una carpeta y subir archivos de distintos tipos.
- Descargar y comparar el archivo resultante con el original.
- Comprobar archivos vacíos, grandes, nombres inválidos y cancelación de descarga.
- Comprobar los tres roles y una sesión caducada.

Resultado: primera versión utilizable en local.

Validación integral completada en local tras aprobar técnicamente backend y frontend y
confirmar el recorrido manual del gestor documental básico.

## Bloque 2 — Operaciones cotidianas

### 2.1 Renombrar — completada

- Backend: añadir una operación para renombrar por `fileId`, validando contención y nombre.
- Frontend: diálogo “Renombrar” desde las acciones del elemento.
- Actualizar el listado sin cambiar de carpeta.

Resultado: archivos, carpetas y documentos nativos pueden renombrarse desde Fragua sin
cambiar su `fileId` ni abandonar la carpeta actual. Backend y frontend revisados y recorrido
manual validado en local.

### 2.2 Mover — pendiente de validación manual en local

- Backend: mover un elemento entre carpetas contenidas en la raíz.
- Validar origen, destino, que el destino sea una carpeta y que no se cree un ciclo.
- Frontend: selector de carpeta de destino y confirmación.

### 2.3 Reemplazar el contenido de un archivo

- Backend: actualizar el contenido con `files.update` manteniendo el mismo `fileId`.
- No permitir reemplazar carpetas ni archivos nativos de Google.
- Aplicar el mismo límite y validaciones que en una subida.
- Frontend: acción “Subir nueva versión”, mostrando claramente el archivo que se reemplaza.

Resultado: Drive conserva la identidad del archivo y genera una nueva revisión; la consulta
y recuperación del historial se implementan por separado en la fase 2.3 bis.

### 2.3 bis Historial de versiones

- Backend: listar las revisiones de un archivo binario contenido en `rootFolderId`, con
  fecha, autor y tamaño cuando Google proporcione esos datos.
- Permitir descargar una revisión anterior mediante la API autenticada, sin enlaces
  públicos ni carga completa en memoria.
- Permitir restaurar una revisión anterior descargando su contenido desde Google y
  guardándolo como una nueva revisión vigente del mismo `fileId`; no reescribir ni eliminar
  el historial existente.
- Permitir marcar o desmarcar revisiones binarias con `keepForever`, respetando los límites
  de Google y mostrando con claridad cuándo una versión está protegida.
- Frontend: diálogo o vista de historial con revisión actual, revisiones anteriores y
  acciones accesibles de descarga, restauración y conservación.
- Excluir inicialmente carpetas y documentos nativos de Google Docs, Sheets y Slides, cuyo
  historial funciona de forma distinta.
- Aplicar contención, permisos, streaming, errores seguros y auditoría futura con los mismos
  criterios que al resto del gestor.

Resultado: los usuarios pueden consultar y recuperar versiones anteriores sin salir de
Fragua, manteniendo el mismo archivo y un historial no destructivo.

### 2.4 Enviar a la papelera

- Backend: marcar el elemento como `trashed`, sin borrado definitivo.
- Impedir operar fuera de la raíz.
- Frontend: confirmación con nombre y tipo del elemento.
- Retirar el elemento del listado después de completar la operación.

### 2.5 Recuperar desde la papelera

- Backend: listar únicamente elementos eliminados del espacio gestionado y restaurarlos.
- Frontend: vista “Papelera” con acciones de restauración.
- No incorporar borrado definitivo en esta fase.

### 2.6 Conflictos de nombre

- Detectar si ya existe un elemento con el mismo nombre en la carpeta de destino.
- En una subida, ofrecer cancelar, conservar ambos o reemplazar el existente.
- En renombrados y movimientos, pedir una decisión explícita antes de continuar.

## Bloque 3 — Consulta y comodidad

### 3.1 Previsualización de imágenes

- Añadir un endpoint autenticado para servir contenido visualizable de forma segura.
- Mostrar imágenes en un visor sin hacer público el archivo.
- Mantener disponible la descarga original.

### 3.2 Previsualización de PDF

- Reutilizar el acceso autenticado y mostrar el PDF dentro de la aplicación.
- Incluir carga, error, descarga y cierre accesible del visor.
- No añadir edición de PDF.

### 3.3 Búsqueda

- Buscar por nombre dentro de toda la carpeta raíz gestionada.
- Añadir filtros sencillos por tipo y fecha de modificación.
- Paginar resultados y permitir abrir su carpeta contenedora.

### 3.4 Recientes y favoritos

- Guardar en PostgreSQL las aperturas recientes y favoritos por usuario.
- Drive conserva el archivo; la base de datos solo guarda referencias y preferencias.
- Eliminar referencias internas cuando Drive confirme que un elemento ya no existe.

### 3.5 Subida múltiple

- Seleccionar o arrastrar varios archivos.
- Mostrar estado individual: pendiente, subiendo, completado o fallido.
- Permitir reintentar únicamente los fallidos.

## Bloque 4 — Control interno de Fragua

### 4.1 Auditoría documental

- Registrar usuario, acción, `fileId`, nombre conocido y fecha.
- Cubrir creación, subida, descarga, reemplazo, renombrado, movimiento, papelera y
  restauración.
- No guardar tokens, contenido ni errores crudos de Google.
- Añadir una vista filtrable para administradores.

### 4.2 Permisos internos

- Definir capacidades separadas: ver, descargar, subir, organizar y administrar.
- Asignarlas inicialmente por rol de Fragua.
- Aplicarlas en backend; ocultar o deshabilitar en frontend es solo una ayuda visual.
- Mantener conexión, reconexión y desconexión exclusivamente para `superadmin`.

### 4.3 Etiquetas y clasificación

- Guardar etiquetas internas en PostgreSQL asociadas al `fileId`.
- Permitir añadir, retirar y filtrar etiquetas.
- No alterar la estructura real de Drive para representar etiquetas.

## Bloque 5 — Integración con la gestión de Fragua

### 5.1 Vincular documentos con eventos

- Asociar uno o varios `fileId` a un evento sin duplicar archivos.
- Mostrar los documentos vinculados desde el evento y desde el gestor documental.
- Definir qué ocurre con la referencia si el archivo va a la papelera.

### 5.2 Vincular documentos con facturas

- Asociar justificantes, facturas o albaranes con registros de facturación existentes.
- Permitir subir directamente desde el contexto de una factura.
- Mantener la contención y los permisos documentales habituales.

### 5.3 Carpetas automáticas

- Crear estructuras predecibles por año y evento desde el backend.
- Hacer la operación idempotente para no duplicar carpetas al repetirla.
- Permitir cambiar los nombres base mediante configuración.

### 5.4 Documentos generados por Fragua

- Generar primero un único tipo de documento útil, como un cierre o listado de evento.
- Guardarlo directamente en la carpeta correspondiente de Drive.
- Registrar quién lo generó y desde qué entidad.

## Bloque 6 — Funciones avanzadas opcionales

Estas fases solo se harán si aportan valor real después de usar los bloques anteriores:

### 6.1 Descarga de carpeta como ZIP

- Construir el ZIP mediante streaming y con límites de tamaño y número de archivos.
- Rechazar o tratar expresamente archivos nativos de Google.
- Cancelar la lectura de Drive si el cliente abandona la descarga.

### 6.2 Caducidades y avisos

- Guardar fecha de caducidad y responsables en PostgreSQL.
- Mostrar documentos próximos a caducar.
- Añadir notificaciones únicamente cuando se haya decidido el canal de entrega.

### 6.3 Uso de almacenamiento

- Mostrar número de archivos, tamaño conocido y archivos más grandes o antiguos.
- Presentar las cifras como información del espacio gestionado, no de todo el Drive.

## Bloque 7 — Preparación y despliegue a producción

- Cerrar el alcance exacto de la primera versión; las fases opcionales no bloquean producción.
- Revisar permisos, límites, CORS, URLs OAuth, secretos y política de copias de seguridad.
- Crear credenciales OAuth y URLs de redirección específicas de producción.
- Separar secretos y claves de cifrado de los archivos versionados.
- Aplicar migraciones y desplegar primero el backend.
- Desplegar el frontend con su URL de API definitiva.
- Recorrer en producción conexión, navegación, subida, descarga y operaciones habilitadas.
- Documentar recuperación de la clave de cifrado, reconexión de Drive y rollback.

## Fuera de alcance por ahora

- Editar dentro de Fragua el contenido de Word, PDF o archivos de Google Workspace.
- Exponer enlaces públicos de Drive.
- Permitir que cada usuario conecte su propia cuenta de Google.
- Borrado definitivo sin una fase específica de seguridad y recuperación.
