# ♟️ kontrol - Manual de Despliegue en Producción (VPS)

Este directorio contiene los archivos necesarios para empaquetar, transferir y desplegar la versión de producción de **kontrol** en el servidor remoto VPS. El flujo utiliza Docker local para construir y empaquetar, transferencias seguras mediante SCP/SSH y un contenedor efímero para correr migraciones y sembrado de la base de datos sin contaminar el entorno.

---

## 🏛️ Arquitectura del Despliegue

La aplicación se ejecuta como un contenedor Docker en el VPS remoto bajo la siguiente infraestructura:

- **Orquestador:** Traefik (reutiliza la red externa preconfigurada `rm_monkeycore_network`).
- **SSL/TLS:** Automatizado a través de Let's Encrypt administrado por Traefik.
- **Puerto Interno:** Expuesto a través del puerto configurado por la variable `${PORT}`.
- **Base de Datos:** PostgreSQL compartida o dedicada en la misma red de Docker.

---

## ⚙️ Variables de Entorno (`.env.production`)

Asegúrate de que el archivo `.prod_environment/.env.production` (que se copiará en el servidor remoto como `.env`) tenga definidos correctamente los siguientes parámetros:

```ini
# --- Configuración de Base de Datos ---
DATABASE_URL=postgresql://user:password@postgres-db-host:5432/kontrol_db

# --- Configuración de Auth (NextAuth/Auth.js) ---
NEXTAUTH_SECRET=tu_secreto_seguro_produccion
NEXTAUTH_URL=https://kontrol.remotemonkeys.ai
AUTH_SECRET=tu_secreto_seguro_produccion
AUTH_URL=https://kontrol.remotemonkeys.ai
AUTH_TRUST_HOST=true

# --- Configuración del Sistema ---
PORT=3000
NODE_ENV=production
APP_SUBDOMAIN=kontrol.remotemonkeys.ai
DOCKER_NETWORK_NAME=rm_monkeycore_network

# --- Gestión de Versiones ---
PROD_PREVIOUS_TAG=1.0.3
PROD_DEPLOY_TAG=1.0.4

# --- Servidor de Correo (SMTP / Invitaciones) ---
EMAIL_SERVER_USER=tu-correo@gmail.com
EMAIL_SERVER_PASSWORD=tu-app-password
EMAIL_FROM="kontrol <tu-correo@gmail.com>"
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
```

---

## 🚀 Flujo de Despliegue Completo

Puedes automatizar todo el proceso desde el directorio raíz del proyecto local utilizando el `Makefile` principal.

### Paso 1: Validar y compilar localmente

Valida los tipos TypeScript, corre el linter y compila la imagen Docker de producción de forma aislada:

```bash
make prod-build
```

### Paso 2: Guardar imagen local en un `.tar`

Guarda la imagen de producción en el directorio `.prod_environment/.image/` en formato comprimido `.tar`:

```bash
make prod-save
```

### Paso 3: Transferir archivos al VPS remoto (SCP)

Sube los archivos de configuración (`Makefile`, `docker-compose.prod.yml`, `.env.production` como `.env` e imagen `.tar`) al servidor VPS:

```bash
make prod-scp
```

### Paso 4: Desplegar en el Servidor (Flujo Completo Automatizado)

Si tu llave SSH está correctamente configurada, puedes ejecutar el flujo completo (Save + SCP + Remote Deploy) en un solo comando:

```bash
make prod-deploy
```

---

## 🛠️ Comandos de Gestión en el Servidor VPS

Una vez que te conectes al VPS (`ssh root@5.161.111.221`), navega a la carpeta `/srv/kontrol` y usa el `Makefile` de producción local para realizar tareas de gestión:

| Comando           | Descripción                                                                                                             |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------- |
| `make deploy`     | **[Recomendado]** Detiene la versión previa, carga el nuevo `.tar`, levanta el contenedor y limpia archivos temporales. |
| `make up`         | Levanta el contenedor de producción en segundo plano.                                                                   |
| `make down`       | Detiene y elimina el contenedor de producción sin borrar volumenes de datos.                                            |
| `make logs`       | Muestra los logs en tiempo real del contenedor de producción (`kontrol-app`).                                         |
| `make shell`      | Abre una terminal interactiva `sh` dentro del contenedor de la aplicación.                                              |
| `make test-local` | Realiza una petición interna HTTP de prueba para validar que la app está sana y respondiendo.                           |
| `make db-setup`   | Ejecuta migraciones pendientes y semillas en la base de datos de producción mediante contenedores efímeros.             |
| `make db-migrate` | Ejecuta de forma aislada las migraciones pendientes en la base de datos.                                                |
| `make seed`       | Ejecuta la semilla de la base de datos de producción de forma aislada.                                                  |

---

## ⚠️ Diagnóstico y Preguntas Frecuentes (Troubleshooting)

### 1. El contenedor dice estar "unhealthy" o se reinicia

- **Causa común:** La Base de Datos no está accesible o alguna variable de entorno es incorrecta.
- **Solución:** Revisa los logs usando `make logs`. Asegúrate de que el contenedor puede resolver el host de base de datos especificado en `DATABASE_URL`.
- **Causa común 2:** Las llamadas de verificación de salud (`healthcheck`) fallan porque se usaba el método `HEAD` (no soportado por Auth.js). La versión actual del `docker-compose.prod.yml` usa `GET` con `wget` en `http://localhost:${PORT}/api/auth/providers` para corregir esto.

### 2. El comando `make prod-scp` falla por SSH

- **Causa común:** La ruta de la llave en `SSH_KEY_PATH` del `.env` local contiene caracteres no interpretados o no tiene permisos.
- **Solución:** Asegúrate de que el archivo de tu llave privada tiene permisos restrictivos en tu máquina local:
  ```bash
  chmod 600 "/ruta/a/tu/llave"
  ```
  Y verifica que la ruta dentro de las comillas en `.env` sea absoluta y válida.

### 3. Las migraciones de Base de Datos no se reflejan

- **Causa común:** El contenedor corre pero la base de datos no se ha actualizado.
- **Solución:** Ejecuta `make db-setup` en el VPS. Esto creará un contenedor efímero a partir de la misma imagen construida para correr `npx prisma migrate deploy` de forma segura.
