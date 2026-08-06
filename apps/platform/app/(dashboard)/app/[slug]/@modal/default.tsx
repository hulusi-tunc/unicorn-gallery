/**
 * Fallback for the `@modal` parallel slot when no intercepting route matches
 * (the app landing, flow grids, and hard-nav / refresh of a `[frameId]` URL —
 * which renders the full page in `children` instead). Renders nothing.
 */
export default function ModalDefault(): null {
  return null;
}
