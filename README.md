# 🌐 KONTROL-ISP — Plataforma CRM Multi-Tenant & Multi-Nodo MikroTik con Agente IA

![Next.js 16](https://img.shields.io/badge/Next.js-16.3.0-black?style=for-the-badge&logo=next.js)
![React 19](https://img.shields.io/badge/React-19.0.0-61DAFB?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38BDF8?style=for-the-badge&logo=tailwind-css)
![Prisma ORM 6](https://img.shields.io/badge/Prisma_ORM-6.19-2D3748?style=for-the-badge&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql)
![RouterOS API](https://img.shields.io/badge/MikroTik-RouterOS_v6_&_v7-E01A22?style=for-the-badge)

Plataforma Enterprise de Gestión para **Proveedores de Servicios de Internet (ISP)** con arquitectura **Multi-Tenant (Multi-Marca)**, gestión distribuida de servidores **MikroTik RouterOS**, modelo de datos **Cliente 1 a N Contratos**, facturación y corte automático por mora, y **Agente de IA** para atención técnica guiada compatible con **Evolution API** (WhatsApp) y **n8n**.

---

## 📑 Tabla de Contenidos

1. [Arquitectura del Sistema](#-arquitectura-del-sistema)
2. [Multi-Tenant & Jerarquía de Roles](#-multi-tenant--jerarquía-de-roles)
3. [Modelo Cliente 1 a N Contratos](#-modelo-cliente-1-a-n-contratos)
4. [Motor Multi-Nodo MikroTik RouterOS](#-motor-multi-nodo-mikrotik-routeros)
5. [Agente de IA y Compatibilidad con N8N](#-agente-de-ia-y-compatibilidad-con-n8n)
6. [Modelo de Datos (Prisma)](#-modelo-de-datos-prisma)
7. [Endpoints de la API](#-endpoints-de-la-api)
8. [Comandos del Makefile](#-comandos-del-makefile)

---

## 🏛️ Arquitectura del Sistema

```mermaid
graph TD
    User([Cliente por WhatsApp / Web]) --> Evolution[Evolution API / N8N]
    Evolution --> ApiEngine[kontrol-isp Next.js 16 REST API]
    ApiEngine --> AIAgent[Agente de IA (Triaje 3 Fases)]
    
    AIAgent --> ToolA[Tool A: Consultar Cliente]
    AIAgent --> ToolB[Tool B: Diagnóstico MikroTik en Vivo]
    AIAgent --> ToolE[Tool E: Transferir a Humano]
    
    ToolB --> RouterDispatcher[MikroTik Node Dispatcher]
    
    RouterDispatcher -->|Contrato Zona 1| Node1[(MikroTik Nodo Soacha)]
    RouterDispatcher -->|Contrato Zona 2| Node2[(MikroTik Nodo Cazucá)]
    RouterDispatcher -->|Contrato Zona N| NodeN[(MikroTik Nodo Central)]
    
    WebAdmin([Operadores / Administradores]) --> Dashboard[NOC & CRM Dashboard]
    Dashboard --> BrandSwitch[BrandSwitcher Multi-Tenant]
    Dashboard --> ClientMgmt[Gestión de Titulares & Contratos]
    Dashboard --> BillingMgmt[Facturación & Reactivación RouterOS]
    Dashboard --> NodeMonitoring[Monitoreo de Nodos MikroTik]
```

---

## 🏢 Multi-Tenant & Jerarquía de Roles

Inspirado en la arquitectura probada de `rm-omnistock`:
1. **`SUPER_ADMIN`**:
   - Acceso global a todas las marcas del sistema.
   - Selector de Marca (`BrandSwitcher`) con opción `🌐 Todas las Marcas (Global NOC)` o filtrado específico.
   - Administración de empresas/tenants (`Brand`), claves API y asignación de administradores.
2. **`ADMIN` (Administrador de Marca)**:
   - Aislado estrictamente a su `brandId`.
   - Administra nodos MikroTik, abonados, contratos, inventario, facturas y operadores de su ISP.
3. **`USER` (Técnico / Operador)**:
   - Aislado a su `brandId`.
   - Consulta de clientes, ejecución de diagnósticos en vivo, registro de pagos y resolución de tickets.

---

## 👤 Modelo Cliente 1 a N Contratos

Un titular (persona o empresa con su respectiva cédula o NIT) puede contar con múltiples contratos de servicio independientes:
- Cada contrato tiene su propia **ubicación física de instalación**, su **nodo MikroTik** correspondiente, su **plan de velocidad**, sus **credenciales PPPoE**, su **inventario de equipos** (ONU Fibra o Antena Microondas) y su **estado de cartera**.
- Los cortes y diagnósticos se ejecutan a nivel de contrato sobre el router correspondiente sin afectar los demás servicios del cliente.

---

## ⚡ Motor Multi-Nodo MikroTik RouterOS

Ubicado en `services/app/src/lib/mikrotik/`:
- **Protocolo Socket TCP**: Conexión nativa a los puertos 8728 (API plana) y 8729 (TLS cifrado), compatible con RouterOS v6 y v7.
- **Failover Inteligente**: Si la IP pública del router no responde (ej. por ausencia de Hairpin NAT en la red local), conmuta automáticamente a la IP secundaria LAN (`fallbackHost`).
- **Operaciones en Tiempo Real**:
  - `testNodeHealth`: Ping, CPU, memoria, versión y conteo de sesiones PPPoE activas.
  - `getClientPppSession`: Consulta `/ppp/active/print ?name=<user>` para uptime, IP activa y MAC.
  - `setClientSuspensionOnRouter`: Desactiva el secret en `/ppp/secret` y elimina la sesión activa para forzar la desconexión inmediata del moroso.
  - `kickClientSession`: Reinicia la sesión sin alterar credenciales.

---

## 🤖 Agente de IA y Compatibilidad con N8N

Emula con exactitud el prompt y herramientas de `serkoi-core`:
- **Fase 1**: Identificación del abonado por documento y validación de mora (con desambiguación si posee múltiples contratos).
- **Fase 2**: Diagnóstico técnico en vivo según tecnología:
  - **Fibra Óptica**: Potencias ópticas Rx (-20 a -25 dBm óptimo, < -27 dBm crítica), temperatura ONU y LEDs LOS/PON.
  - **Microondas**: Enlace de radio, inyector PoE/LAN y validación de router Wi-Fi.
- **Fase 3**: Traspaso a asesor humano (`SupportTicket` con estado `TRANSFERIDO_HUMANO`).

---

## 📡 Endpoints de la API (Compatibles con N8N / Evolution API)

### 1. `GET /api/v1/cliente`
- **Autenticación**: Cabecera `X-API-KEY: isp_live_...` (asociada a la marca).
- **Parámetros**: `documento`, `telefono`, `contrato`, `cliente_id`.
- **Respuesta**: Datos del titular, tecnología (`FIBRA_OPTICA` o `MICROONDAS`), estado de cartera (`ACTIVO`, `SUSPENDIDO_MORA`), plan contratado y lista de contratos si tiene más de uno.

### 2. `GET /api/v1/diagnostico`
- **Autenticación**: Cabecera `X-API-KEY: isp_live_...`.
- **Parámetros**: `cliente_id`, `contrato` o `documento` (y `debug=1` opcional).
- **Respuesta**: Consulta en tiempo real al router MikroTik del nodo correspondiente con estado `ONLINE`, `OFFLINE` o `SUSPENDIDO_MORA`, uptime, IP y MAC.

---

## 🛠️ Comandos del Makefile

```bash
# Levantar el entorno de desarrollo
make dev-up-d

# Detener el entorno
make dev-down

# Regenerar tipos de Prisma tras cambios en schema.prisma
make db-generate

# Ejecutar migraciones en el contenedor
make db-migrate

# Ejecutar semillero idempotente con marcas, nodos y clientes demo
make db-seed

# Validación completa de TypeScript y Linter
make check

# Abrir Prisma Studio
make db-studio
```
