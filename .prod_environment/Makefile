# Makefile para gestión manual de contenedor de producción local

# Incluye el archivo .env (convertirá sus variables en disponibles para Make)
include .env
export $(shell sed 's/=.*//' .env)

# --- Configuración ---
# Nombre del contenedor definido en docker-compose.prod.yml
CONTAINER_NAME := kontrol-isp-app
# Etiqueta para la imagen de producción (tomadas de .env)
PREVIOUS_TAG := $(PROD_PREVIOUS_TAG)
DEPLOY_TAG := $(PROD_DEPLOY_TAG)
# Nombre del archivo .tar.gz que contiene la imagen
IMAGE_TAR_PATH := .image/
IMAGE_TAR_DEPLOY_FILE := kontrol-isp-$(DEPLOY_TAG).tar.gz
IMAGE_TAR_PREVIOUS_FILE := kontrol-isp-$(PREVIOUS_TAG).tar.gz
# Imagen a limpiar
IMAGE_PREVIOUS_REMOVE := kontrol-isp:$(PREVIOUS_TAG)
# Nombre del archivo Docker Compose de producción
COMPOSE_PROD_FILE := docker-compose.prod.yml 

# --- Comando Docker Compose (ejecuta directamente sin sudo) ---
COMPOSE_CMD := docker compose -f $(COMPOSE_PROD_FILE)

# --- Targets ---

.PHONY: help deploy load-image up down logs shell clean prune-images clean-images-files db-setup db-migrate seed test-local

help: ## Muestra esta ayuda
	@echo "Uso: make [target]"
	@echo ""
	@echo "Targets Gestión Contenedor Producción (Remoto):"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' | grep -vE '^help$$|^clean$$'
	@echo ""
	@echo "Targets Base de Datos (Prisma):"
	@echo "  \033[36mdb-setup\033[0m             Ejecuta migrate deploy + seed"
	@echo "  \033[36mdb-migrate\033[0m           Ejecuta migracion mediante contenedor efimero"
	@echo "  \033[36mseed\033[0m                 Ejecuta semilla mediante contenedor efimero"
	@echo ""
	@echo "Targets Debug:"
	@echo "  \033[36mtest-local\033[0m           Prueba conexión interna al puerto $(PORT)"

deploy: prune-images load-image up clean-images-files ## Flujo completo de despliegue remoto
	@echo "✨ Despliegue de $(CONTAINER_NAME) $(DEPLOY_TAG) completado con éxito."

prune-images: down ## Detiene contenedor y elimina la imagen de la versión previa
	@docker image prune -f
	@echo "🗑️ Elimina imagen previa $(IMAGE_PREVIOUS_REMOVE)..."
	@docker rmi $(IMAGE_PREVIOUS_REMOVE) || true

load-image: ## Carga la imagen Docker desde el archivo .tar.gz especificado
	@echo "🚢 Cargando imagen desde $(IMAGE_TAR_PATH)$(IMAGE_TAR_DEPLOY_FILE)..."
	@docker load -i $(IMAGE_TAR_PATH)$(IMAGE_TAR_DEPLOY_FILE)

up: ## Inicia el contenedor de producción en segundo plano
	@echo "🚀 Iniciando contenedor $(CONTAINER_NAME)..."
	$(COMPOSE_CMD) up -d

down: ## Detiene y elimina el contenedor de producción
	@echo "🛑 Deteniendo contenedor $(CONTAINER_NAME)..."
	$(COMPOSE_CMD) down

logs: ## Muestra logs del contenedor
	$(COMPOSE_CMD) logs -f $(CONTAINER_NAME)

shell: ## Terminal dentro del contenedor
	docker exec -it $(CONTAINER_NAME) sh

test-local: ## Prueba conexión interna al puerto de la app
	@echo "🔍 Probando conexión local a http://127.0.0.1:$(PORT)..."
	@docker exec $(CONTAINER_NAME) wget --no-verbose --tries=1 --spider http://127.0.0.1:$(PORT)/api/auth/providers || echo "❌ Error: App no responde en el puerto $(PORT)"

# --- Gestión de Base de Datos efímera (CI/CD Style) ---
DB_NETWORK = $(DOCKER_NETWORK_NAME)
PRISMA_VERSION = 6.19.2

db-setup: db-migrate seed ## Ejecuta migración y semillas

db-migrate: ## Sincroniza esquema en producción mediante contenedor efímero
	@echo "📦 Sincronizando Base de Datos (Modo Efímero)..."
	docker run --rm -it \
		--network $(DB_NETWORK) \
		--env-file $(PWD)/.env \
		-v $(PWD)/.env:/app/.env \
		kontrol-isp:$(DEPLOY_TAG) \
		sh -c "npx -y prisma@$(PRISMA_VERSION) migrate deploy"

seed: ## Ejecuta el sembrado de datos mediante contenedor efímero
	@echo "🌱 Sembrando datos base (Modo Efímero)..."
	docker run --rm -it \
		--network $(DB_NETWORK) \
		--env-file $(PWD)/.env \
		-v $(PWD)/.env:/app/.env \
		kontrol-isp:$(DEPLOY_TAG) \
		sh -c "npx -y tsx prisma/seed.ts"

clean-images-files: ## Elimina los archivos .tar.gz antiguos
	@echo "🧹 Eliminando archivos locales de imagen..."	
	@find $(IMAGE_TAR_PATH) -name 'kontrol-isp-*.tar.gz' \
		! -name '$(IMAGE_TAR_PREVIOUS_FILE)' \
		! -name '$(IMAGE_TAR_DEPLOY_FILE)' \
		-exec rm -v {} +
