const MAX_SIDE = 1080
const MAX_BYTES = 2 * 1024 * 1024

/** Resizes a photo to at most 1080px and re-encodes it as WebP (falls back to JPEG). */
export async function prepareProfilePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const [type, quality] of [['image/webp', 0.85], ['image/jpeg', 0.85], ['image/jpeg', 0.7]] as const) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
    if (blob && blob.size <= MAX_BYTES) return blob
  }
  throw new Error('That photo is too large, even after resizing. Try a smaller one.')
}
