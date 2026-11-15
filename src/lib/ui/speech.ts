/** Voz que el navegador ofrece; solo importa el idioma y el nombre. */
export type VoiceLike = { lang: string; name: string };

const PREFERRED_LANGS = ["es-CO", "es-419", "es-MX", "es-US", "es-ES"] as const;

/** Elige la voz en español más cercana a Colombia; null si el celular no tiene ninguna en español. */
export function pickSpanishVoice<T extends VoiceLike>(voices: readonly T[]): T | null {
  const normalized = (voice: T) => voice.lang.replace("_", "-");
  for (const lang of PREFERRED_LANGS) {
    const found = voices.find((voice) => normalized(voice).toLowerCase() === lang.toLowerCase());
    if (found) return found;
  }
  return voices.find((voice) => normalized(voice).toLowerCase().startsWith("es")) ?? null;
}

/**
 * Parte un texto largo en frases de máximo `maxLength` caracteres: algunos navegadores cortan
 * en seco las lecturas largas, así que se leen de a pedazos.
 */
export function splitForSpeech(text: string, maxLength = 180): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?¡¿]+[.!?]?/g) ?? [];
  const chunks: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (current && `${current} ${sentence}`.length > maxLength) { chunks.push(current); current = sentence; }
    else current = current ? `${current} ${sentence}` : sentence;
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => chunk.length <= maxLength ? [chunk] : splitLongChunk(chunk, maxLength));
}

function splitLongChunk(chunk: string, maxLength: number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const word of chunk.split(" ")) {
    if (current && `${current} ${word}`.length > maxLength) { parts.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
  }
  if (current) parts.push(current);
  return parts;
}
