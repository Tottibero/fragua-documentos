/**
 * Guarda un `Blob` como archivo local: crea una URL de objeto, la asocia a
 * un enlace `<a download>` temporal e invisible, lo activa y limpia
 * siempre después de iniciar la descarga — quita el enlace del DOM y
 * revoca la URL, tanto si todo fue bien como si no.
 *
 * Único efecto DOM de la fase de descarga: la llamada a la API y el estado
 * viven en el store; la presentación (botón, "Descargando…") en
 * `DriveItemsList`. Esta función no sabe nada de ninguno de los dos.
 */
export function saveBlobAsFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}
