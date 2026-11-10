# --- CONFIGURACIÓN GLOBAL ---
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

NETWORK_NAME = $(DOCKER_NETWORK_NAME)
PROJECT_NAME ?= $(or $(COMPOSE_PROJECT_NAME),kontrol-isp)

# Comandos base con prefijo de proyecto para evitar colisiones en el VPS
DOCKER_COMPOSE_BASE = docker compose -p $(PROJECT_NAME)
DOCKER_COMPOSE_DEV  = $(DOCKER_COMPOSE_BASE) -f docker-compose.yml -f docker-compose.dev.yml
DOCKER_COMPOSE_PROD = $(DOCKER_COMPOSE_BASE) -f docker-compose.yml -f docker-compose.prod.yml

# Selección dinámica de comando según el entorno
ifeq ($(NODE_ENV), production)
    CMD_ACTIVE = $(DOCKER_COMPOSE_PROD)
else
    CMD_ACTIVE = $(DOCKER_COMPOSE_DEV)
endif

.PHONY: help dev-up dev-down dev-up-d dev-up-build prod-build prod-save prod-scp prod-sync prod-deploy prod-up prod-down db-setup-prod db-setup logs shell-app shell-db db-migrate db-seed db-studio clean fix-permissions check lint-fix

# --- AYUDA ---
help: ## Muestra este menú de ayuda
	@echo "\033[1mRM-Framework 2026 - CLI Management\033[0m"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# --- ENTORNOS DE EJECUCIÓN ---

dev-up: ## Inicia desarrollo con hot-reload (primer plano)
	@docker network inspect $(NETWORK_NAME) >/dev/null 2>&1 || docker network create $(NETWORK_NAME)
	$(DOCKER_COMPOSE_DEV) up

dev-up-d: ## Inicia desarrollo en segundo plano (detached)
	@docker network inspect $(NETWORK_NAME) >/dev/null 2>&1 || docker network create $(NETWORK_NAME)
	$(DOCKER_COMPOSE_DEV) up -d
	@echo "🚀 App (DEV) en http://localhost:$(PORT)"

dev-up-build: ## Fuerza reconstrucción e inicia desarrollo
	@docker network inspect $(NETWORK_NAME) >/dev/null 2>&1 || docker network create $(NETWORK_NAME)
	$(DOCKER_COMPOSE_DEV) up -d --build
	@echo "🚀 App (DEV) reconstruida en http://localhost:$(PORT)"

dev-down: ## Detiene el entorno de desarrollo
	$(DOCKER_COMPOSE_DEV) down

# --- PRODUCCIÓN (BUILD LOCAL + SCP / RSYNC) ---

# Variables de imagen (personalizar según sea necesario)
DOCKER_USER ?= root
PROD_IMAGE_TAG ?= ${PROD_DEPLOY_TAG}
PROD_IMAGE_NAME = $(PROJECT_NAME)
PROD_IMAGE_FULL = $(PROD_IMAGE_NAME):$(PROD_IMAGE_TAG)

# Configuración del Servidor Remoto
REMOTE_USER ?= serkoi
REMOTE_HOST ?= 38.52.157.50
REMOTE_PORT ?= 22
REMOTE_APP_DIR ?= /srv/kontrol-isp
IMAGE_TAR_FILE = $(PROJECT_NAME)-$(PROD_IMAGE_TAG).tar.gz

# Llave SSH (tomada de .env o ruta por defecto)
SSH_KEY ?= $(SSH_KEY_PATH)
SSH_CMD = ssh -p $(REMOTE_PORT) $(if $(SSH_KEY),-i $(SSH_KEY))
SCP_CMD = scp -P $(REMOTE_PORT) $(if $(SSH_KEY),-i $(SSH_KEY))
RSYNC_CMD = rsync -avzP -e "ssh -p $(REMOTE_PORT) $(if $(SSH_KEY),-i $(SSH_KEY))"

prod-validate: ## [LOCAL] Valida tipos y linter dentro del contenedor antes del build
	@echo "🔍 Validando tipos y linter dentro del contenedor..."
	$(DOCKER_COMPOSE_DEV) run --rm app sh -c "npx tsc --noEmit && npm run lint"

prod-build: prod-validate ## [LOCAL] Construye la imagen de producción
	@echo "📦 Construyendo imagen de producción $(PROD_IMAGE_FULL)..."
	docker build --network=host -f services/app/Dockerfile \
		--build-arg NEXT_PUBLIC_APP_VERSION=$(PROD_DEPLOY_TAG) \
		-t $(PROD_IMAGE_FULL) \
		-t $(PROD_IMAGE_NAME):latest \
		--target runner \
		services/app

prod-save: prod-build ## [LOCAL] Guarda y comprime la imagen en archivo .tar.gz
	@echo "💾 Guardando y comprimiendo imagen en .prod_environment/.image/$(IMAGE_TAR_FILE)..."
	@mkdir -p .prod_environment/.image
	docker save $(PROD_IMAGE_FULL) | gzip > .prod_environment/.image/$(IMAGE_TAR_FILE)
	@echo "⚡ Imagen comprimida exitosamente. Tamaño:" $$(du -h .prod_environment/.image/$(IMAGE_TAR_FILE) | cut -f1)

prod-sync: prod-scp ## [LOCAL] Alias para sincronización con rsync

prod-scp: ## [LOCAL] Transfiere archivos al servidor usando rsync con barra de progreso
	@echo "⬆️ Sincronizando archivos con $(REMOTE_HOST) vía rsync..."
	@$(SSH_CMD) $(REMOTE_USER)@$(REMOTE_HOST) "mkdir -p $(REMOTE_APP_DIR)/.image"
	$(RSYNC_CMD) .prod_environment/README.md $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_APP_DIR)/README.md
	$(RSYNC_CMD) .prod_environment/Makefile $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_APP_DIR)/Makefile
	$(RSYNC_CMD) .prod_environment/docker-compose.prod.yml $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_APP_DIR)/docker-compose.prod.yml
	$(RSYNC_CMD) .prod_environment/.env.production $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_APP_DIR)/.env
	$(RSYNC_CMD) .prod_environment/.image/$(IMAGE_TAR_FILE) $(REMOTE_USER)@$(REMOTE_HOST):$(REMOTE_APP_DIR)/.image/$(IMAGE_TAR_FILE)
	@echo "✅ Sincronización rsync completada con éxito."
	
prod-deploy: ## [LOCAL -> REMOTE] Flujo completo de despliegue usando el Makefile remoto
	@echo '$(MAKE) prod-save'
	$(MAKE) prod-save
	$(MAKE) prod-scp
	@echo "💻 Conectando al servidor para ejecutar despliegue con control de versiones..."
	$(SSH_CMD) $(REMOTE_USER)@$(REMOTE_HOST) "cd $(REMOTE_APP_DIR) && make deploy"
	@echo "✨ Despliegue de producción completado."

prod-up: ## Levanta infraestructura en el VPS (usando archivos locales si están montados)
	@docker network inspect $(NETWORK_NAME) >/dev/null 2>&1 || docker network create $(NETWORK_NAME)
	$(DOCKER_COMPOSE_PROD) up -d --build --remove-orphans
	@echo "🚀 Contenedores de producción activos."

prod-down: ## Detiene la aplicación en producción en el VPS (vía Makefile remoto)
	$(SSH_CMD) $(REMOTE_USER)@$(REMOTE_HOST) "cd $(REMOTE_APP_DIR) && make down"

# --- GESTIÓN DE BASE DE DATOS (PRISMA) ---

db-generate: ## Genera los tipos de Prisma Client dentro del contenedor
	$(CMD_ACTIVE) exec app npx prisma generate

db-setup: ## Inicialización completa para DESARROLLO
	$(DOCKER_COMPOSE_DEV) exec app npx prisma generate
	$(DOCKER_COMPOSE_DEV) exec app npx prisma migrate dev
	$(DOCKER_COMPOSE_DEV) exec app npx tsx prisma/seed.ts

db-setup-prod: ## Ejecución estándar de Prisma 6
	@echo "📦 Sincronizando Base de Datos en Producción..."
	# Ahora 'npx prisma' funcionará a la primera porque nada ha sido borrado
	$(DOCKER_COMPOSE_PROD) exec -u nextjs app npx prisma migrate deploy
	$(DOCKER_COMPOSE_PROD) exec -u nextjs app npx tsx prisma/seed.ts

db-migrate: ## Ejecuta migraciones de desarrollo
	$(DOCKER_COMPOSE_DEV) exec app npx prisma migrate dev

db-seed: ## Ejecuta el sembrado de datos en desarrollo
	$(DOCKER_COMPOSE_DEV) exec app npx tsx prisma/seed.ts

db-migrate-serkoi: ## Ejecuta la importación masiva de datos reales de Serkoi (SQL en UTF-8)
	@echo "📥 Importando datos reales de Serkoi en PostgreSQL (UTF-8)..."
	docker exec -i postgres-local sh -c 'psql -v ON_ERROR_STOP=1 -U "$$(cat /run/secrets/db_user)" -d kontrol_db' < services/app/prisma/data/serkoi-migration.sql

db-studio: ## Abre Prisma Studio
	$(DOCKER_COMPOSE_DEV) exec app npx prisma studio

# --- UTILIDADES Y DEBUG ---

logs: ## Muestra logs del entorno activo (DEV por defecto)
	$(CMD_ACTIVE) logs -f

shell-app: ## Terminal dentro del contenedor de la App
	$(CMD_ACTIVE) exec app sh

shell-db: ## Terminal dentro del contenedor de la DB (Solo si existe en el compose)
	$(CMD_ACTIVE) exec db bash

check: ## Validación proactiva: TypeScript y Linter
	@echo "🔍 Validando tipos y linter dentro del contenedor..."
	$(CMD_ACTIVE) exec app sh -c "npx tsc --noEmit && npm run lint"

lint-fix: ## Corrige automáticamente errores de formateo y linter dentro del contenedor
	@echo "🛠 Corrigiendo errores de linter dentro del contenedor..."
	$(CMD_ACTIVE) exec app npm run lint:fix

fix-permissions: ## Corrige permisos de archivos generados por Docker
	sudo chown -R $(shell id -u):$(shell id -g) .

clean: ## Limpieza profunda: Contenedores, volúmenes y caché de Next.js
	$(DOCKER_COMPOSE_DEV) down -v
	$(DOCKER_COMPOSE_PROD) down -v
	rm -rf services/app/.next
	@echo "🗑 Sistema purgado."