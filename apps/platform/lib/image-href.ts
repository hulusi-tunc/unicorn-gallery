/**
 * Resolves a manifest's image field to a usable URL.
 * In the platform, manifest images are full HTTPS URLs (Supabase Storage public URLs),
 * so this is effectively a passthrough.
 */
export function imageHref(image: string): string {
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return image;
}
