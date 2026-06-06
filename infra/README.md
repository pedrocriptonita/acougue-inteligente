# Infraestrutura VPS

Sobe **N8N**, **Evolution API** e **Postgres** via Docker Compose.

## Pré-requisitos
- VPS com mínimo 2 GB RAM e 20 GB SSD (Ubuntu 22.04+)
- Docker + Docker Compose instalados
- Domínio com DNS apontando para o IP do VPS:
  - `n8n.seudominio.com`
  - `evolution.seudominio.com`

## Passo a passo

```bash
# 1. Variáveis
cp infra/.env.example infra/.env && nano infra/.env

# 2. Subir os serviços
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d

# 3. Conferir
docker compose -f infra/docker-compose.yml ps

# 4. Reverse proxy + HTTPS
sudo cp infra/nginx/n8n.conf       /etc/nginx/sites-available/n8n
sudo cp infra/nginx/evolution.conf /etc/nginx/sites-available/evolution
sudo ln -s /etc/nginx/sites-available/n8n       /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d n8n.seudominio.com -d evolution.seudominio.com
```

## Validação (critério da Fase 1)
- [ ] `https://n8n.seudominio.com` abre a interface do N8N
- [ ] `https://evolution.seudominio.com` responde ao health check
- [ ] `restart: unless-stopped` garante reinício automático dos containers

## Backup (recomendado)
```bash
# Workflows e credenciais do N8N
docker run --rm -v acougue-inteligente_n8n_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/n8n-backup-$(date +%F).tar.gz /data
```
