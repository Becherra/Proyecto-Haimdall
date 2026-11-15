/** Caché en memoria de promesas con vencimiento y tamaño máximo. */
export type PromiseCache<T> = {
  /** La promesa guardada si existe y no venció; al consultarla pasa a ser la más reciente. */
  get(key: string): Promise<T> | undefined;
  /** Guarda `value` con `ttlMs` de vida; si se supera `maxEntries` descarta la menos usada. */
  set(key: string, value: Promise<T>, ttlMs: number): void;
  /** Cambia el vencimiento de la entrada solo si todavía guarda esa misma promesa (no una más nueva). */
  expireIn(key: string, value: Promise<T>, ttlMs: number): void;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
};

type Entry<T> = { value: Promise<T>; expiresAt: number };

/**
 * Se guardan promesas y no valores para que dos consultas simultáneas a la misma llave compartan una sola petición.
 * Sin límite ni vencimiento una caché así crece mientras el servidor viva; por eso ambos son obligatorios.
 * `now` se inyecta para poder probar el vencimiento.
 */
export function createPromiseCache<T>({ maxEntries, now = () => Date.now() }: { maxEntries: number; now?: () => number }): PromiseCache<T> {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError("maxEntries debe ser un entero positivo");
  const entries = new Map<string, Entry<T>>();
  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) { entries.delete(key); return undefined; }
      // Reinsertar la lleva al final del Map, que es el orden de "más reciente".
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value, ttlMs) {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next();
        if (oldest.done) break;
        entries.delete(oldest.value);
      }
    },
    expireIn(key, value, ttlMs) {
      const entry = entries.get(key);
      if (entry?.value === value) entry.expiresAt = now() + ttlMs;
    },
    delete: (key) => { entries.delete(key); },
    clear: () => entries.clear(),
    get size() { return entries.size; },
  };
}
