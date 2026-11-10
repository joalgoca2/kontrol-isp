# Arquitectura del Sistema: Kontrol ISP
**Plataforma Integral de Gestión para Proveedores de Servicios de Internet (ISP)**  
*Arquitectura Empresarial, Multi-Tenant, Next.js 16, Prisma ORM y Hardware MikroTik*

---

## 1. Visión General de la Arquitectura

**Kontrol ISP** está diseñado bajo un modelo de arquitectura desacoplada y modular orientada a microservicios dentro de un monorepositorio estructurado:

```
+-----------------------------------------------------------------------------------+
|                            INTERFACES DE USUARIO & CLIENTES                       |
|   Portal Administrativo Web     |     NOC Cartográfico     |     App Móvil Técnicos |
+-----------------------------------------------------------------------------------+
                                         |
                                  HTTPS / WSS / REST
                                         v
+-----------------------------------------------------------------------------------+
|                        NEXT.JS 16 CORE ENGINE (services/app)                      |
|                                                                                   |
|  [Edge Proxy (src/proxy.ts)]  -->  [Auth & RBAC (NextAuth)]  -->  [i18n Provider] |
|  [Server Actions (src/actions)]                                                   |
|       * clients.ts, contracts.ts, nodes.ts, mikrotik.ts                           |
|  [API Gateway (src/app/api/v1/)]                                                  |
|       * /cliente, /diagnostico, /brand, /webhooks                                 |
|  [Zod Validation Layer (src/lib/validations/)]                                     |
+-----------------------------------------------------------------------------------+
              |                                            |
       TCP API (Port 8728)                               SQL (Port 5432)
              v                                            v
+----------------------------+             +---------------------------------------+
|  ROUTERS MIKROTIK ROUTEROS |             |      POSTGRESQL (kontrol_db)          |
|  * /ppp/active             |             |  * Tenants & Brands (Multi-tenant)     |
|  * /ppp/secret             |             |  * Clients, Contracts, CPEs           |
|  * Queues & Simple QoS     |             |  * unaccent & f_unaccent Extension    |
+----------------------------+             +---------------------------------------+
              ^                                            ^
              | ETL (Migración)                            | Eventos / Webhooks
              |                                            v
+----------------------------+             +---------------------------------------+
|  MARIADB LEGACY (SID ERP)  |             |      AUTOMATIZACIÓN & AGENTES N8N     |
|  * 2,575 contratos         |             |  * Bot de WhatsApp (Evolution API)   |
|  * 2,352 clientes          |             |  * Facturación y Notificaciones DIAN  |
+----------------------------+             +---------------------------------------+
```

---

## 2. Pilares Tecnológicos Centrales

### 1. Núcleo Web y Servidor
- **Next.js 16 (App Router)**: Renderizado híbrido (RSC para tablas pesadas y Client Components para mapas y telemetría interactiva).
- **Edge Proxy (`src/proxy.ts`)**: Control centralizado de seguridad, cabeceras HTTP estrictas (CSP, CORS, X-Frame-Options) y enrutamiento RBAC.
- **Tailwind CSS v4 & Next Themes**: Soporte dual automático para temas **Claro / Oscuro**, con variantes `@custom-variant dark`.

### 2. Base de Datos & Acceso de Datos
- **PostgreSQL 16**: Motor de persistencia principal.
- **Prisma ORM**: Tipado seguro generado a partir de `schema.prisma`. Modelo `User`, `Brand`, `Client`, `Contract`, `ContractEquipment`, `MikrotikNode`.
- **Búsqueda Insensible a Acentos (`unaccent`)**:
  - Implementación de la función SQL inmutable `public.f_unaccent(text)`.
  - Búsquedas normalizadas mediante el helper `@/lib/search` (`searchIdsWithUnaccent`), garantizando que búsquedas como "Perez", "Pérez" o "perez" coincidan con el 100% de registros.

### 3. Modelo Multi-Tenant & Multi-Brand
- Cada ISP o filial opera bajo un registro en la tabla `Brand`.
- Los contratos, clientes, nodos de red y usuarios se aíslan a nivel de base de datos con clave foránea `brandId`.
- **API Keys por Marca**: Cada empresa dispone de sus propias credenciales seguras para exponer endpoints a plataformas de terceros o n8n.

### 4. Telemetría de Red MikroTik (Estándar Zero-Mock)
- Conexión nativa con la API de RouterOS mediante `MikroTikNodeManager` (`services/app/src/lib/mikrotik/`).
- **Cero Simulación**: Cualquier consulta de estado o telemetría se realiza contra el hardware real; si el router no responde o el host es inalcanzable, el sistema reporta el fallo explícito para asegurar diagnósticos confiables.

### 5. Motor Cartográfico & NOC
- **Leaflet & MarkerCluster**: Visualización de abonados en mapa georreferenciado con agrupamiento dinámico por clusters para soportar miles de pines sin degradación de rendimiento.
- **Geocodificación Especializada**: Normalizador de nomenclatura de direcciones de Colombia (Google Geocoding API + fallback Nominatim OSM).

---

## 3. Estándares de Código y Buenas Prácticas

1. **Cero Tipos `any`**: TypeScript en modo estricto en el 100% de interfaces y Server Actions.
2. **Límite de Línea (<100 Caracteres)**: Todo el código fuente mantiene un ancho máximo para garantizar legibilidad en revisiones y diffs.
3. **Auditoría de Registros**:
   - Campos `createdBy` y `updatedBy` gestionados automáticamente en Prisma para entidades de negocio.
   - Timestamps en UTC (`DateTime @default(now())`).
4. **Validación Dual Zod**:
   - Validación del lado del cliente en formularios con `react-hook-form` + `@hookform/resolvers/zod`.
   - Re-validación del lado del servidor en Server Actions con `schema.safeParse()`.

---

## 4. Comandos Rápidos del Ecosistema Docker

El proyecto se gestiona 100% aislado dentro de contenedores Docker mediante atajos de `Makefile`:

```bash
make dev-up-d     # Iniciar servicios en segundo plano
make logs         # Monitorear logs de los contenedores
make db-migrate   # Ejecutar migraciones de Prisma
make db-seed      # Sembrar datos maestros idempotentes
make check        # Validar TypeScript y ESLint dentro del contenedor
make db-studio    # Abrir Prisma Studio para inspección visual
```

