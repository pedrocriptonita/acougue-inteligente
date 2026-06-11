import { type Prisma, StatusConversa } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { imprimirComanda } from "./printnode";
import { criarPedido, marcarImpresso } from "./pedido";
import { listarProdutosAtivos } from "./produto";
import {
  interpretarPedido,
  pedidoInterpretadoSchema,
  type PedidoInterpretado,
} from "./openai";

/** Produto do catálogo no formato usado para casar preço. */
type ProdutoCatalogo = {
  nome: string;
  preco: number;
  sinonimos: string[];
};

/** Preço unitário do catálogo para um item (por nome ou sinônimo), ou undefined. */
function precoDoCatalogo(
  nomeItem: string,
  catalogo: ProdutoCatalogo[]
): number | undefined {
  const alvo = nomeItem.trim().toLowerCase();
  const achado = catalogo.find(
    (p) =>
      p.nome.toLowerCase() === alvo ||
      p.sinonimos.some((s) => s.toLowerCase() === alvo)
  );
  return achado?.preco;
}

/**
 * Orquestrador da conversa (o "cérebro" da automação).
 *
 * Recebe uma mensagem do cliente e conduz a sessão de coleta via IA até a
 * confirmação, quando então cria o Pedido e dispara a impressão da comanda.
 * Toda a lógica e o estado vivem aqui (em TypeScript), não no N8N.
 *
 * Estados (StatusConversa):
 *   COLETANDO → AGUARDANDO_CONFIRMACAO → CONCLUIDA
 *   qualquer → HUMANO (fallback)        |  inatividade → EXPIRADA (job futuro)
 */

/** Após este nº de mensagens sem progresso, encaminha para humano. */
const MAX_TENTATIVAS = 3;

export type Loja = { id: string; nome: string };

export type EntradaMensagem = {
  loja: Loja;
  telefone: string;
  texto: string;
  /** ID da mensagem do WhatsApp (idempotência — evita processar 2x). */
  mensagemId: string;
  /** Nome do cliente (ex.: pushName do WhatsApp), se disponível. */
  nomeCliente?: string;
};

export type ResultadoProcessamento = {
  /** Mensagem a enviar ao cliente (vazia quando não há resposta automática). */
  resposta: string;
  status: StatusConversa;
  encaminhadoHumano: boolean;
  /** Preenchido quando um pedido foi criado nesta mensagem. */
  pedidoCriado?: { id: string; numero: number; impresso: boolean };
  /** True se a mensagem já havia sido processada antes (ignorada). */
  duplicada: boolean;
};

/** Lê o rascunho salvo (JSON) validando contra o schema atual. */
function lerRascunho(valor: Prisma.JsonValue | null): PedidoInterpretado | null {
  if (!valor) return null;
  const parsed = pedidoInterpretadoSchema.safeParse(valor);
  return parsed.success ? parsed.data : null;
}

/** Estados em que mantemos o rascunho como contexto da IA. */
function estadoEmColeta(status: StatusConversa) {
  return (
    status === StatusConversa.COLETANDO ||
    status === StatusConversa.AGUARDANDO_CONFIRMACAO
  );
}

export async function processarMensagem(
  entrada: EntradaMensagem
): Promise<ResultadoProcessamento> {
  const { loja, telefone, texto, mensagemId } = entrada;
  const nomeCliente = entrada.nomeCliente?.trim() || `Cliente ${telefone}`;

  const conversa = await prisma.conversa.findUnique({
    where: { lojaId_telefone: { lojaId: loja.id, telefone } },
  });

  // 1. Idempotência: mesma mensagem reentregue pelo WhatsApp/N8N.
  if (conversa?.ultimaMensagemId === mensagemId) {
    return {
      resposta: "",
      status: conversa.statusConversa,
      encaminhadoHumano: conversa.statusConversa === StatusConversa.HUMANO,
      duplicada: true,
    };
  }

  // 2. Conversa já em atendimento humano: não respondemos automaticamente,
  //    apenas registramos a última mensagem.
  if (conversa?.statusConversa === StatusConversa.HUMANO) {
    await salvarConversa(loja.id, telefone, {
      // rascunho omitido de propósito: mantém o que já estava salvo.
      statusConversa: StatusConversa.HUMANO,
      tentativas: conversa.tentativas,
      ultimaMensagemId: mensagemId,
    });
    return {
      resposta: "",
      status: StatusConversa.HUMANO,
      encaminhadoHumano: true,
      duplicada: false,
    };
  }

  // 3. Define o contexto da IA. Conversas concluídas/expiradas recomeçam do zero.
  const emColeta = conversa ? estadoEmColeta(conversa.statusConversa) : false;
  const rascunhoAtual = emColeta ? lerRascunho(conversa!.rascunho) : null;
  const aguardandoConfirmacao =
    conversa?.statusConversa === StatusConversa.AGUARDANDO_CONFIRMACAO;
  const tentativasAnteriores = emColeta ? (conversa?.tentativas ?? 0) : 0;

  // Catálogo da loja: normaliza nomes na IA e preenche o preço estimado.
  const catalogo: ProdutoCatalogo[] = (
    await listarProdutosAtivos(loja.id)
  ).map((p) => ({
    nome: p.nome,
    preco: Number(p.preco),
    sinonimos: p.sinonimos,
  }));

  const r = await interpretarPedido(texto, {
    rascunhoAtual,
    aguardandoConfirmacao,
    catalogo: catalogo.map((p) => ({ nome: p.nome, sinonimos: p.sinonimos })),
  });

  // 4. Fallback explícito pedido pela IA.
  if (r.precisaAtendimentoHumano) {
    await salvarConversa(loja.id, telefone, {
      statusConversa: StatusConversa.HUMANO,
      rascunho: r as unknown as Prisma.InputJsonValue,
      tentativas: tentativasAnteriores,
      ultimaMensagemId: mensagemId,
    });
    return {
      resposta: r.mensagemAoCliente,
      status: StatusConversa.HUMANO,
      encaminhadoHumano: true,
      duplicada: false,
    };
  }

  // 5. Cliente confirmou um pedido que estava resumido → cria o pedido.
  if (aguardandoConfirmacao && r.confirmouPedido && r.itens.length > 0) {
    const pedido = await criarPedido({
      lojaId: loja.id,
      nomeCliente,
      telefoneCliente: telefone,
      retirada: r.retirada ?? "ao ficar pronto",
      // Casa cada item com o catálogo para preencher o preço estimado.
      itens: r.itens.map((item) => ({
        ...item,
        precoUnitario: precoDoCatalogo(item.produto, catalogo),
      })),
    });

    // Impressão é "best effort": o pedido já existe (painel é a fonte da
    // verdade). Se a impressora falhar, fica `impresso=false` para reimpressão.
    let impresso = false;
    try {
      await imprimirComanda({
        numero: pedido.numero,
        nomeLoja: loja.nome,
        nomeCliente,
        telefoneCliente: telefone,
        retirada: pedido.retirada,
        itens: r.itens,
        criadoEm: pedido.createdAt,
      });
      await marcarImpresso(pedido.id);
      impresso = true;
    } catch (e) {
      console.error(`[conversa] falha ao imprimir comanda #${pedido.numero}:`, e);
    }

    await salvarConversa(loja.id, telefone, {
      statusConversa: StatusConversa.CONCLUIDA,
      rascunho: r as unknown as Prisma.InputJsonValue,
      tentativas: 0,
      ultimaMensagemId: mensagemId,
    });

    return {
      resposta: `Pedido #${pedido.numero} confirmado! Avisaremos quando estiver pronto. 🥩`,
      status: StatusConversa.CONCLUIDA,
      encaminhadoHumano: false,
      pedidoCriado: { id: pedido.id, numero: pedido.numero, impresso },
      duplicada: false,
    };
  }

  // 6. Pedido montado, mas ainda sem confirmação → pede confirmação.
  if (r.pedidoCompleto && r.itens.length > 0) {
    await salvarConversa(loja.id, telefone, {
      statusConversa: StatusConversa.AGUARDANDO_CONFIRMACAO,
      rascunho: r as unknown as Prisma.InputJsonValue,
      tentativas: 0,
      ultimaMensagemId: mensagemId,
    });
    return {
      resposta: r.mensagemAoCliente,
      status: StatusConversa.AGUARDANDO_CONFIRMACAO,
      encaminhadoHumano: false,
      duplicada: false,
    };
  }

  // 7. Ainda coletando. Conta tentativas sem progresso (nenhum item extraído).
  const semProgresso = r.itens.length === 0;
  const tentativas = semProgresso ? tentativasAnteriores + 1 : 0;

  if (tentativas >= MAX_TENTATIVAS) {
    await salvarConversa(loja.id, telefone, {
      statusConversa: StatusConversa.HUMANO,
      rascunho: r as unknown as Prisma.InputJsonValue,
      tentativas,
      ultimaMensagemId: mensagemId,
    });
    return {
      resposta:
        "Vou te transferir para um atendente para te ajudar melhor. Um instante! 🙏",
      status: StatusConversa.HUMANO,
      encaminhadoHumano: true,
      duplicada: false,
    };
  }

  await salvarConversa(loja.id, telefone, {
    statusConversa: StatusConversa.COLETANDO,
    rascunho: r as unknown as Prisma.InputJsonValue,
    tentativas,
    ultimaMensagemId: mensagemId,
  });
  return {
    resposta: r.mensagemAoCliente,
    status: StatusConversa.COLETANDO,
    encaminhadoHumano: false,
    duplicada: false,
  };
}

/**
 * Lista as conversas de uma loja para o painel (mais recentes primeiro).
 * Por padrão traz apenas as que precisam de atenção humana; passe `todas` para
 * incluir as em coleta/aguardando confirmação.
 */
export async function listarConversasDaLoja(
  lojaId: string,
  opcoes: { apenasHumano?: boolean; limite?: number } = {}
) {
  const { apenasHumano = true, limite = 100 } = opcoes;
  return prisma.conversa.findMany({
    where: {
      lojaId,
      ...(apenasHumano
        ? { statusConversa: StatusConversa.HUMANO }
        : {
            statusConversa: {
              in: [
                StatusConversa.HUMANO,
                StatusConversa.COLETANDO,
                StatusConversa.AGUARDANDO_CONFIRMACAO,
              ],
            },
          }),
    },
    orderBy: { atualizadoEm: "desc" },
    take: limite,
    select: {
      id: true,
      telefone: true,
      statusConversa: true,
      tentativas: true,
      atualizadoEm: true,
    },
  });
}

/** Upsert da sessão de conversa (uma ativa por telefone por loja). */
async function salvarConversa(
  lojaId: string,
  telefone: string,
  dados: {
    statusConversa: StatusConversa;
    rascunho?: Prisma.InputJsonValue;
    tentativas: number;
    ultimaMensagemId: string;
  }
) {
  await prisma.conversa.upsert({
    where: { lojaId_telefone: { lojaId, telefone } },
    create: {
      lojaId,
      telefone,
      statusConversa: dados.statusConversa,
      rascunho: dados.rascunho,
      tentativas: dados.tentativas,
      ultimaMensagemId: dados.ultimaMensagemId,
    },
    update: {
      statusConversa: dados.statusConversa,
      rascunho: dados.rascunho,
      tentativas: dados.tentativas,
      ultimaMensagemId: dados.ultimaMensagemId,
    },
  });
}
