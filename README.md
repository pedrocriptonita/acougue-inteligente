# Açougue Inteligente

Plataforma SaaS que recebe e organiza pedidos de carne pelo **WhatsApp**, com IA para interpretar mensagens, impressão automática de comandas e painel de gestão.

> **Fluxo central:** Cliente → WhatsApp → Pedido → Impressão → Retirada

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend / Painel | Next.js 16 (App Router) · React 19.2 · TypeScript · Tailwind v4 · Shadcn/ui |
| Banco + Auth | Supabase (PostgreSQL + Auth + Realtime) |
| ORM | Prisma |
| Orquestração | N8N (VPS) |
| WhatsApp | Evolution API (VPS) |
| IA | OpenAI (`gpt-4o-mini`) |
| Impressão | PrintNode / Star CloudPRNT |

---

## Pré-requisitos

- **Node.js 20.9+** (veja `.nvmrc`)
- Conta no **Supabase**
- **VPS** com Docker para N8N + Evolution API (ver [`infra/README.md`](./infra/README.md))

---

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Variáveis de ambiente
cp .env.example .env.local
# preencha as variáveis do Supabase (ver Fase 2)

# 3. Gerar o Prisma Client
npm run prisma:generate

# 4. (após configurar o Supabase) aplicar migrations
npm run prisma:migrate

# 5. Rodar em desenvolvimento
npm run dev
```

App em `http://localhost:3000` · Health check em `http://localhost:3000/api/health`.

---

## Scripts

| Script | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | ESLint |
| `npm run type-check` | Verificação de tipos (`tsc --noEmit`) |
| `npm run format` | Formata com Prettier |
| `npm run prisma:generate` | Gera o Prisma Client |
| `npm run prisma:migrate` | Aplica migrations em dev |
| `npm run prisma:studio` | Abre o Prisma Studio |

---

## Estrutura de pastas

```
src/
├── app/                    # App Router (rotas)
│   ├── (auth)/             # Login / setup  (Fase 2)
│   ├── (dashboard)/        # Painel protegido (Fase 5)
│   └── api/                # Route Handlers (health, /n8n/* na Fase 4)
├── components/
│   └── ui/                 # Componentes Shadcn
├── lib/
│   ├── supabase/           # Clients Supabase (server + client)
│   ├── prisma.ts           # Singleton do Prisma
│   ├── env.ts              # Validação de env com Zod
│   └── utils.ts            # cn()
├── server/
│   ├── actions/            # Server Actions (por feature)
│   └── services/           # Serviços de domínio
└── types/                  # Tipos globais
infra/                      # Docker Compose (N8N + Evolution API) + nginx
prisma/                     # schema.prisma
```

---

## Roadmap (fases)

- [x] **Fase 1 — Setup inicial** · projeto, infra VPS, CI/CD, deploy
- [x] **Fase 2 — Autenticação** · Google Sign-In + RLS + tenant isolado
- [x] **Fase 3 — APIs externas** · Evolution, OpenAI, PrintNode, N8N
- [x] **Fase 4 — Automação WhatsApp** · mensagem → IA → pedido → comanda
- [x] **Fase 5 — Painel de gestão** · dashboard, status, realtime, fallback
- [x] **Fase 6 — UI shell e refatoração**
- [x] **Fase 7 — Billing (SaaS)**
- [ ] **Fase 8 — Polimento**

> ⚠️ **Nota sobre WhatsApp:** a Evolution API é não oficial (risco de banimento do número). Tratada como solução de validação/piloto; plano de migração para a WhatsApp Cloud API oficial previsto para produção.

---

## Deploy

- **Painel (Next.js):** Vercel — deploy automático ao merge na `main` (CI precisa estar verde).
- **Infra (N8N + Evolution API):** VPS via Docker Compose — ver [`infra/README.md`](./infra/README.md).

> A Fase 2 usa o `proxy.ts` (mecanismo de middleware renomeado no Next.js 16.2+) para renovar a sessão e proteger as rotas `/dashboard` e `/setup`.

---

## Autenticação (Fase 2)

Login via **Google** sobre o Supabase Auth, com isolamento multi-tenant por loja.

**Fluxo:** `/login` → OAuth Google → `/auth/callback` (troca o code por sessão) →
`/setup` (onboarding: cria a `Loja` + `Usuario` ADMIN na 1ª vez) → `/dashboard`.

**Camadas de proteção:**

1. `src/proxy.ts` — renova a sessão (cookies) e bloqueia rotas privadas sem login (edge, só cookies).
2. Layouts server-side (`requireUsuario`) — garantem sessão **e** vínculo com uma `Loja`.
3. **RLS no Postgres** (`prisma/sql/rls.sql`) — isolamento por `loja_id` como defesa em profundidade.

**Configuração necessária no Supabase:**

```bash
# 1. Aplicar o schema
npm run prisma:migrate         # cria as tabelas
# 2. Aplicar as políticas de RLS (SQL Editor do Supabase ou psql na DIRECT_URL)
#    → cole o conteúdo de prisma/sql/rls.sql
# 3. Habilitar o provedor Google em Authentication > Providers
#    e adicionar a URL de callback: <APP_URL>/auth/callback
```

---

## APIs externas (Fase 3)

Clientes tipados das integrações, isolados em `src/server/services/`. Nenhum
mantém estado nem grava no banco — são acionados pela orquestração da Fase 4.

| Serviço | Arquivo | Função principal |
|---|---|---|
| OpenAI (`gpt-4o-mini`) | `openai.ts` | `interpretarPedido()` — texto livre → pedido estruturado (Structured Outputs + validação Zod) |
| Evolution API | `evolution.ts` | `enviarTexto()`, `notificarPedidoPronto()`, `estadoConexao()` |
| PrintNode | `printnode.ts` | `imprimirComanda()` + `formatarComanda()` (texto para térmica 80mm) |
| N8N | `n8n.ts` | `dispararWebhook()` (app→N8N) e `verificarChaveInterna()` (N8N→app, comparação em tempo constante) |

Padrões comuns:

- **`http.ts`** — `fetchJson()` com timeout (`AbortController`) e `ExternalApiError` normalizado.
- **`getRequiredEnv()`** (`lib/env.ts`) — as chaves são opcionais no boot e cobradas em runtime, só quando a integração é usada (não quebra o dev sem chaves).
- Variáveis necessárias: ver `.env.example` (`OPENAI_API_KEY`, `EVOLUTION_*`, `PRINTNODE_*`, `N8N_WEBHOOK_URL`, `INTERNAL_API_KEY`).

Validação manual da IA (sem subir o app): `npm run test:ia` (ver `scripts/test-ia.ts`).

---

## Automação WhatsApp (Fase 4)

O **app Next é o cérebro** da automação; o N8N só repassa o webhook da Evolution.
Toda a lógica e o estado da conversa ficam em TypeScript (testável, versionado).

**Fluxo:** Cliente → WhatsApp → Evolution → N8N → `POST /api/n8n/mensagem` →
IA interpreta → atualiza a `Conversa` → na confirmação cria o `Pedido` + imprime
a comanda → responde ao cliente via Evolution.

**Máquina de estados da conversa** (`server/services/conversa.ts`):

```
COLETANDO → AGUARDANDO_CONFIRMACAO → CONCLUIDA
   └────────────── HUMANO (fallback) ←─────────────┘
```

- **Idempotência:** `Conversa.ultimaMensagemId` evita processar a mesma mensagem 2×.
- **Confirmação:** a IA marca `confirmouPedido` quando o cliente aceita o resumo.
- **Número do pedido:** sequencial por loja, gerado com `pg_advisory_xact_lock`
  (`server/services/pedido.ts`) — sem colisão entre mensagens simultâneas.
- **Impressão:** *best effort* — o pedido é criado mesmo se a impressora falhar
  (`impresso=false` para reimpressão pelo painel).
- **Fallback humano:** pedido explícito do cliente ou `MAX_TENTATIVAS` sem progresso.

**Endpoint** `POST /api/n8n/mensagem` (runtime Node):

```jsonc
// headers: { "x-internal-api-key": "<INTERNAL_API_KEY>" }
{
  "numeroLoja": "5511999990000",     // WhatsApp da loja → resolve o tenant
  "telefoneCliente": "5511988887777",
  "texto": "meio quilo de picanha pra hoje 18h",
  "mensagemId": "ABC123",            // id da mensagem (idempotência)
  "nomeCliente": "João"              // opcional (pushName)
}
```

> O N8N **não** deve reenviar a resposta — o app já envia via Evolution. O campo
> `resposta` no retorno é só para diagnóstico.

---

## Painel de gestão (Fase 5)

Dashboard operacional em `/dashboard` (protegido, escopado por loja).

- **Board por status:** colunas _Em preparo_ → _Pronto p/ retirada_ → _Concluídos_.
- **Ações** (Server Actions, `server/actions/pedidos.ts`):
  - _Marcar pronto_ → status `PRONTO`, `prontoEm` e **notifica o cliente** no WhatsApp.
  - _Concluir_ → `CONCLUIDO` + `concluidoEm`. _Cancelar_ → `CANCELADO`.
  - _Imprimir/Reimprimir_ comanda (PrintNode). Transições válidas são validadas no servidor.
- **Tempo real:** `RealtimePedidos` assina a tabela `pedidos` via Supabase Realtime
  e dá `router.refresh()` a cada mudança — pedidos novos (vindos do WhatsApp)
  aparecem sem recarregar. Requer a tabela na publicação `supabase_realtime`
  (incluída em `prisma/sql/rls.sql`); o RLS isola os eventos por loja.
- **Isolamento:** toda ação revalida o `lojaId` do usuário logado antes de gravar.

---

## UI shell (Fase 6)

Shell de aplicação do painel: **sidebar** fixa no desktop e **navegação
horizontal** no mobile, com destaque do link ativo.

- Navegação compartilhada em `app/(dashboard)/_components/nav-config.tsx`
  (`Sidebar` + `MobileNav` consomem a mesma lista).
- Seções: **Pedidos** (`/dashboard`), **Clientes** (`/dashboard/clientes`),
  **Conversas** (`/dashboard/conversas`, fila de atendimento humano) e
  **Configurações** (`/dashboard/configuracoes`, edição da loja — só ADMIN).
- Refatoração: `components/page-header.tsx` padroniza o cabeçalho das páginas;
  o `signOut` e os dados do usuário foram para o rodapé da sidebar.

---

## Billing / SaaS (Fase 7)

Assinaturas via **Stripe**, com a Loja como Customer.

> 🚩 **Desligado por padrão** (`BILLING_ENABLED="false"`). O MVP atende uma loja
> só, então a tela de assinatura fica oculta. O código (serviço, webhook, ações)
> permanece pronto: para ativar no futuro, defina `BILLING_ENABLED="true"` e as
> chaves `STRIPE_*`.

- **Planos:** `MENSAL` / `ANUAL` (price ids no `.env`). `TRIAL` é o estado inicial.
- **Fluxo:** Configurações → "Assinar" → Stripe Checkout → retorno ao painel.
  Gerenciar/cancelar é pelo **Customer Portal** do Stripe.
- **Webhook** `POST /api/stripe/webhook` (runtime Node, fora do proxy) é a
  **fonte da verdade**: valida a assinatura `stripe-signature` (corpo cru) e
  atualiza `plano`, `assinaturaStatus`, `assinaturaExpiraEm`, `stripe*Id` na Loja.
  Eventos tratados: `checkout.session.completed`,
  `customer.subscription.created/updated/deleted`.
- **Serviço:** `server/services/stripe.ts` (cliente lazy, checkout, portal,
  verificação de webhook, mapa price↔plano). **Ações:** `server/actions/billing.ts`
  (só ADMIN).
- ⚠️ **Migration necessária:** os campos de billing foram adicionados à `Loja` —
  rode `npm run prisma:migrate` antes de usar.
- Para testar webhooks localmente: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
