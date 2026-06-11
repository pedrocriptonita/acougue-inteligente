/**
 * Resolve com `fallback` se a `promise` não completar dentro de `ms`.
 *
 * Usado para não pendurar requisições quando o Supabase/rede está lento ou
 * inacessível: em vez de esperar os retries internos do SDK (10s+ cada), a
 * gente segue rápido com um valor seguro e o app se recupera no próximo request.
 */
export async function comTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
