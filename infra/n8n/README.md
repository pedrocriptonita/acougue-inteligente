# N8N — Automação WhatsApp (Açougue Inteligente)

O N8N é só o **encanamento**: ele recebe o webhook da Evolution API (mensagem
nova do WhatsApp), normaliza o payload e repassa para a aplicação em
`POST /api/n8n/mensagem`. **Toda a lógica** (IA, conversa, pedido, comanda,
resposta ao cliente) está no app — o N8N não decide nada.

```
Cliente → WhatsApp → Evolution API → [Webhook] N8N → POST /api/n8n/mensagem (app)
                                                              │
                          app: IA → Conversa → Pedido → Comanda → responde via Evolution
```

> A resposta ao cliente é enviada **pelo app** (via Evolution). O N8N **não**
> deve reenviar nada — evita mensagem duplicada.

---

## 1. Pré-requisitos

- N8N rodando na VPS (ver [`../docker-compose.yml`](../docker-compose.yml)).
- Evolution API conectada ao número de WhatsApp da loja.
- App publicado e acessível pela VPS (ex.: `https://app.seudominio.com`).
- A `INTERNAL_API_KEY` **igual** no app (`.env`) e no N8N.

---

## 2. Variáveis de ambiente do N8N

Defina no container do N8N (docker-compose `environment:` ou painel):

```env
APP_BASE_URL=https://app.seudominio.com        # sem barra no final
INTERNAL_API_KEY=<a mesma chave do .env do app>
```

O workflow referencia `{{ $env.APP_BASE_URL }}` e `{{ $env.INTERNAL_API_KEY }}`,
então **não** há segredo hardcoded no JSON.

---

## 3. Importar o workflow

1. No N8N: **Workflows → Import from File**.
2. Selecione [`workflow-whatsapp.json`](./workflow-whatsapp.json).
3. Abra o nó **Webhook Evolution** e copie a **Production URL**, algo como:
   ```
   https://n8n.seudominio.com/webhook/evolution-acougue
   ```
4. **Active** o workflow (toggle no topo) para a Production URL funcionar.

### Nós do workflow
| Nó | Função |
|---|---|
| **Webhook Evolution** | Recebe o `POST` da Evolution (`messages.upsert`). |
| **Mapear payload** | Filtra (ignora `fromMe`, grupos e mídia) e converte para o formato do app. |
| **POST /api/n8n/mensagem** | Envia ao app com o header `x-internal-api-key`. |

---

## 4. Configurar o webhook na Evolution API

Aponte a Evolution para a Production URL do webhook, ouvindo o evento
`MESSAGES_UPSERT`. Via API (ajuste host, instância e `apikey`):

```bash
curl -X POST "https://evolution.seudominio.com/webhook/set/acougue-instance" \
  -H "apikey: SUA_CHAVE_EVOLUTION" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://n8n.seudominio.com/webhook/evolution-acougue",
      "byEvents": false,
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```

> O formato exato do corpo varia entre versões da Evolution v2 — confira em
> **Settings → Webhook** no Manager da Evolution se preferir configurar pela UI.

---

## 5. Mapeamento do payload

O nó **Mapear payload** extrai do webhook da Evolution:

| Campo enviado ao app | Origem no payload da Evolution |
|---|---|
| `numeroLoja` | `body.sender` (número conectado = WhatsApp da loja) → só dígitos |
| `telefoneCliente` | `data.key.remoteJid` → só dígitos |
| `texto` | `data.message.conversation` ou `extendedTextMessage.text` |
| `mensagemId` | `data.key.id` (idempotência) |
| `nomeCliente` | `data.pushName` |

Descarta automaticamente: mensagens do próprio bot (`fromMe`), grupos (`@g.us`)
e mensagens sem texto (áudio/imagem/etc.).

> **Atenção ao `numeroLoja`:** o app resolve a loja por `telefoneWhatsapp` (o
> número cadastrado no onboarding). Se `body.sender` não vier como esperado na
> sua versão da Evolution, ajuste o nó **Mapear payload** para usar o campo
> correto, ou fixe o número da loja se houver só uma instância no piloto.

---

## 6. Testar

### Sem WhatsApp (simulando a Evolution)
Com o workflow **ativo**, mande um POST para a Production URL imitando o evento:

```bash
curl -X POST "https://n8n.seudominio.com/webhook/evolution-acougue" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "acougue-instance",
    "sender": "5511999990000@s.whatsapp.net",
    "data": {
      "key": { "remoteJid": "5511988887777@s.whatsapp.net", "fromMe": false, "id": "TESTE-1" },
      "pushName": "João Teste",
      "message": { "conversation": "meio quilo de picanha pra hoje 18h" }
    }
  }'
```

Esperado: o app processa, cria/atualiza a `Conversa` e responde ao cliente.
Reenviar com o **mesmo** `id` (`TESTE-1`) deve ser tratado como duplicado
(idempotência) e **não** criar um segundo pedido.

### Com WhatsApp real
Mande uma mensagem para o número da loja e acompanhe a execução em
**Executions** no N8N + os logs do app.

---

## 7. (Opcional) Automações downstream

O app dispara webhooks para o N8N em eventos de negócio (best effort), em
`{{ N8N_WEBHOOK_URL }}/<evento>`:

| Evento | Quando |
|---|---|
| `pedido.criado` | Pedido confirmado e criado |
| `pedido.pronto` | (reservado) |
| `pedido.cancelado` | (reservado) |
| `conversa.fallback_humano` | Conversa encaminhada para atendimento humano |

Esses eventos chegam com o header `x-internal-api-key`. Crie workflows extras
(ex.: avisar a equipe no Telegram quando cair em `conversa.fallback_humano`, ou
registrar pedidos numa planilha). **Não são necessários** para o fluxo principal
— o app já cuida de criar o pedido, imprimir a comanda e responder ao cliente.
