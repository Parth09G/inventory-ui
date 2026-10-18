/** Saves a fetched file (for endpoints that return the file itself, not a signed link). */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Opens a short-lived signed Storage link straight away; never stored (D-22). */
export function openSignedUrl(url: string) {
  window.open(url, '_blank', 'noopener')
}
