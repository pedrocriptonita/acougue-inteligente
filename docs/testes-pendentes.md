# ✅ Checklist de testes antes de subir para produção

> Estes testes **ainda não foram executados** (faltam chaves reais e a infra da
> VPS no ar). Rode todos antes do deploy. Marque cada item ao validar.

---

## 0. Pré-requisitos (preencher antes de testar)

`.env.local` com valores **reais**:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `DATABASE_URL`, `DIRECT_URL`
- [ ] `OPENAI_API_KEY` (substituir o placeholder `sk-...`)
- [ ] `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`
- [ ] `PRINTNODE_API_KEY`, `PRINTNODE_PRINTER_ID`
- [ ] `N8N_WEBHOOK_URL`, `INTERNAL_API_KEY` (mín. 32 chars aleatórios)

Infra:

- [ ] `npm run prisma:migrate` aplicado (6 tabelas + campos de billing na `Loja` + `preco_unitario` em `itens_pedido`)
- [ ] `prisma/sql/rls.sql` rodado no Supabase (RLS ativo — ver §1.4)
- [ ] Tabela `pedidos` adicionada à publicação Realtime do Supabase
      (`alter publication supabase_realtime add table pedidos;`)
- [ ] Provedor **Google** habilitado no Supabase + credenciais do Google Cloud
- [ ] VPS com Evolution API conectada ao WhatsApp + N8N no ar
- [ ] Impressora térmica conectada ao agente do PrintNode

Sanidade local:

- [ ] `npm run type-check` — sem erros
- [ ] `npm run build` — sucesso

---

## 1. Fase 2 — Autenticação e multi-tenant

### 1.1 Login Google (caminho feliz)
- [ ] `/login` → "Entrar com Google" → escolher conta → volta autenticado
- [ ] Usuário novo cai em `/setup`; após criar a loja, vai para `/dashboard`

### 1.2 Onboarding
- [ ] Criar loja com nome + WhatsApp → `Loja` e `Usuario` (perfil ADMIN) criados
- [ ] WhatsApp duplicado em outra loja → erro "WhatsApp já vinculado a outra loja"

### 1.3 Proteção de rotas (proxy)
- [ ] Deslogado, acessar `/dashboard` direto → redireciona para `/login`
- [ ] Logado sem loja, acessar `/dashboard` → redireciona para `/setup`
- [ ] **Sair** → sessão encerrada, volta ao `/login`

### 1.4 Isolamento por loja (RLS)
- [ ] No SQL Editor: `select tablename, rowsecurity from pg_tables where schemaname='public'`
      → 6 tabelas com `rowsecurity = true`
- [ ] (Opcional, 2 lojas) Loja A não enxerga pedidos/clientes da Loja B

---

## 2. Fase 3 — Integrações externas (isoladas)

### 2.1 OpenAI — interpretação da IA
- [ ] `npm run test:ia` roda os 5 cenários sem erro
- [ ] "meio quilo de picanha e 2 frangos" → `0.5 KG picanha` + `2 PECA frango`
- [ ] "1kg e meio de costela ... pego 18h" → itens corretos, `retirada=18:00`, `pedidoCompleto=true`
- [ ] "quero carne" → pergunta o que/quanto (não inventa item)
- [ ] "quero falar com alguém" → `precisaAtendimentoHumano=true`
- [ ] `npm run test:ia "sua mensagem"` aceita mensagem customizada

### 2.2 Evolution (manual, via VPS)
- [ ] `estadoConexao()` retorna `open` (instância conectada)
- [ ] `enviarTexto()` entrega uma mensagem de teste no WhatsApp

### 2.3 PrintNode (manual)
- [ ] `formatarComanda()` gera layout legível (testar string)
- [ ] `imprimirComanda()` imprime na térmica e retorna `jobId`

---

## 3. Fase 4 — Automação WhatsApp (ponta a ponta)

> Endpoint: `POST /api/n8n/mensagem` (header `x-internal-api-key`).
> Pode testar com curl/Postman **antes** de plugar o N8N.

### 3.1 Autenticação e validação
- [ ] Sem header / chave errada → `401`
- [ ] Payload incompleto → `400` com detalhes
- [ ] `numeroLoja` inexistente → `404`

### 3.2 Fluxo de coleta → confirmação → pedido
- [ ] Mensagem com itens parciais → responde pedindo o que falta (`COLETANDO`)
- [ ] Completar itens + horário → resumo + "posso confirmar?" (`AGUARDANDO_CONFIRMACAO`)
- [ ] "sim" → cria `Pedido` (#sequencial), responde "Pedido #N confirmado" (`CONCLUIDA`)
- [ ] Comanda impressa na térmica e `Pedido.impresso = true`
- [ ] Cliente recebe as respostas no WhatsApp (via Evolution)

### 3.3 Número sequencial por loja
- [ ] Pedidos da mesma loja recebem #1, #2, #3... sem pular/repetir
- [ ] (Concorrência) Disparar 2 confirmações ~simultâneas → números distintos

### 3.4 Idempotência
- [ ] Reenviar o mesmo `mensagemId` → `duplicada: true`, **não** cria pedido novo

### 3.5 Fallback humano
- [ ] "quero falar com atendente" → `HUMANO`, para de responder automaticamente
- [ ] 3 mensagens sem entender → encaminha para humano

### 3.6 Resiliência
- [ ] Impressora offline → pedido **ainda é criado** (`impresso = false`)
- [ ] Evolution offline → webhook responde `200`, erro de envio só logado

### 3.7 N8N (integração real)
- [ ] Mensagem real no WhatsApp → Evolution → N8N → `/api/n8n/mensagem`
- [ ] N8N **não** reenvia a resposta (o app já envia)

---

## 4. Fase 5 — Painel de gestão

### 4.1 Listagem
- [ ] Dashboard mostra os pedidos da loja agrupados por status
- [ ] Itens, cliente, horário de retirada e nº do pedido corretos

### 4.2 Mudança de status
- [ ] "Marcar pronto" → status `PRONTO`, `prontoEm` preenchido, cliente notificado no WhatsApp
- [ ] "Concluir" → `CONCLUIDO`, `concluidoEm` preenchido
- [ ] "Cancelar" → `CANCELADO`
- [ ] Reimprimir comanda → novo job no PrintNode

### 4.3 Realtime
- [ ] Novo pedido criado pelo WhatsApp **aparece no painel sem recarregar**
- [ ] Mudança de status reflete em outra aba aberta

### 4.4 Isolamento
- [ ] Usuário só vê e altera pedidos da própria loja

---

## 5. Fase 6 — UI shell e navegação

### 5.1 Navegação
- [ ] Sidebar aparece no desktop; navegação horizontal no mobile (responsivo)
- [ ] Link ativo destacado corretamente em cada seção (Pedidos não fica ativo nas subrotas)
- [ ] **Sair** (no rodapé da sidebar) encerra a sessão

### 5.2 Clientes
- [ ] Lista os clientes da loja com a contagem de pedidos correta
- [ ] Loja sem clientes → estado vazio

### 5.3 Conversas
- [ ] Lista as conversas ativas; as em `HUMANO` aparecem com alerta destacado
- [ ] Status traduzido (Atendimento humano / Coletando / Aguardando confirmação)

### 5.4 Configurações
- [ ] ADMIN consegue editar o nome da loja → reflete no painel e nas comandas
- [ ] FUNCIONÁRIO vê os dados em modo leitura (sem botão salvar)
- [ ] WhatsApp e plano exibidos corretamente (somente leitura)

### 5.5 Design dark + extras (Stitch)
> Requer `npm run prisma:migrate` (campo `precoUnitario` novo em `itens_pedido`).
- [ ] Tema dark aplicado em todas as telas (login, setup, painel) sem contraste quebrado
- [ ] Sidebar com link ativo destacado (tint crimson + barra lateral)
- [ ] Badge "WhatsApp Bot: Online/Offline" reflete o `estadoConexao()` da Evolution
      (offline quando a Evolution não está configurada/acessível)
- [ ] Card de pedido: "Definir preços" → inputs por item → total em R$ exibido
- [ ] Total correto = Σ (preço unitário × quantidade); botão "editar" reabre o editor

---

## 6. Fase 7 — Billing (Stripe)

> Pré: `STRIPE_*` no `.env.local`, `npm run prisma:migrate` (campos novos na
> `Loja`), produtos/preços criados no Stripe, e `stripe listen` rodando para o
> webhook local.

### 6.1 Checkout
- [ ] ADMIN em Configurações → "Assinar mensal" → redireciona ao Stripe Checkout
- [ ] Pagamento de teste aprovado → volta ao painel com `?checkout=sucesso`
- [ ] FUNCIONÁRIO não vê botões de assinatura (mensagem de restrição)

### 6.2 Webhook (fonte da verdade)
- [ ] `checkout.session.completed` → Loja recebe `stripeSubscriptionId`, `plano`, `assinaturaStatus=active`
- [ ] `customer.subscription.updated` → status/plano/`assinaturaExpiraEm` refletidos
- [ ] `customer.subscription.deleted` → Loja volta a `TRIAL`, vínculo zerado
- [ ] Assinatura inválida (corpo adulterado) → `400`

### 6.3 Portal
- [ ] Com assinatura ativa → "Gerenciar assinatura" abre o Customer Portal
- [ ] Cancelar no portal → webhook atualiza o status no painel

### 6.4 Estado na UI
- [ ] Badge de status correto (Ativa / Em teste / Pendente / Cancelada)
- [ ] Data de renovação/expiração exibida

---

## 7. Pré-deploy (Vercel)

- [ ] Variáveis de ambiente configuradas na Vercel (mesmas do `.env.local`)
- [ ] Redirect URLs do Supabase incluem a URL de produção (`https://.../**`)
- [ ] Google Cloud: origens/redirect autorizados incluem a URL de produção
- [ ] CI verde (atenção: `npm run lint` está quebrado por config — ver memória)
- [ ] Sem erro `431` em produção (cookies de sessão grandes — ver §nota)

> **Nota 431:** resolvido em dev com `--max-http-header-size`. Se aparecer na
> Vercel, configurar o Supabase para não persistir os provider tokens do Google.
