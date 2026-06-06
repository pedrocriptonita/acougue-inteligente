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
- [ ] **Fase 4 — Automação WhatsApp** · mensagem → IA → pedido → comanda
- [ ] **Fase 5 — Painel de gestão** · dashboard, status, realtime, fallback
- [ ] **Fase 6 — UI shell e refatoração**
- [ ] **Fase 7 — Billing (SaaS)**
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
