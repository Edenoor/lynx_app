// src/Presentation/ui/pictureSize.ts
// Resolución de foto para CameraCaptureView cuando se pide una foto liviana:
// entre las que ofrece la cámara («1600x1200»), la más grande cuyo lado mayor
// no pasa de maxSide; si ninguna entra, la más chica. Sin datos, null (la
// cámara usa la suya). Módulo puro para poder probarlo solo.

export function pickPictureSize(sizes: string[] | null | undefined, maxSide: number): string | null {
  const parsed = (sizes ?? [])
    .map((s) => {
      const m = /^(\d+)x(\d+)$/.exec(String(s).trim());
      return m ? { s: String(s).trim(), long: Math.max(+m[1], +m[2]), area: +m[1] * +m[2] } : null;
    })
    .filter((x): x is { s: string; long: number; area: number } => !!x);
  if (!parsed.length) return null;
  const fitting = parsed.filter((p) => p.long <= maxSide).sort((a, b) => b.area - a.area);
  if (fitting.length) return fitting[0].s;
  return parsed.sort((a, b) => a.area - b.area)[0].s;
}
