/**
 * Utilitários compartilhados pelos clientes de APIs externas (OpenAI, Evolution,
 * PrintNode, N8N). Centraliza timeout, tratamento de erro e parsing de JSON.
 */

/** Erro normalizado de qualquer integração externa. */
export class ExternalApiError extends Error {
  constructor(
    /** Nome do serviço (ex.: "OpenAI", "Evolution"). */
    public readonly service: string,
    /** Status HTTP, ou `null` para falhas de rede/timeout. */
    public readonly status: number | null,
    message: string,
    /** Corpo de resposta de erro (quando houver), para diagnóstico. */
    public readonly details?: unknown
  ) {
    super(`[${service}] ${message}`);
    this.name = "ExternalApiError";
  }
}

type FetchJsonOptions = RequestInit & {
  /** Nome do serviço, usado nas mensagens de erro. */
  service: string;
  /** Tempo limite da requisição em ms (padrão 15s). */
  timeoutMs?: number;
};

/**
 * `fetch` com timeout, que sempre devolve JSON tipado e lança `ExternalApiError`
 * em qualquer falha (rede, timeout ou status HTTP >= 400).
 */
export async function fetchJson<T = unknown>(
  url: string,
  { service, timeoutMs = 15_000, ...init }: FetchJsonOptions
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new ExternalApiError(
        service,
        null,
        `Tempo limite excedido (${timeoutMs}ms).`
      );
    }
    throw new ExternalApiError(
      service,
      null,
      `Falha de rede: ${e instanceof Error ? e.message : String(e)}`
    );
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let data: unknown = undefined;
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw; // resposta não-JSON (ex.: texto de erro do proxy)
    }
  }

  if (!response.ok) {
    throw new ExternalApiError(
      service,
      response.status,
      `Resposta HTTP ${response.status}.`,
      data
    );
  }

  return data as T;
}
