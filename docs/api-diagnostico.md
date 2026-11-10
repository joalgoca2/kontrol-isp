# API Técnica: Diagnóstico de Conexión & Telemetría MikroTik
**Endpoint**: `GET /api/v1/diagnostico`  
**Servicio**: Kontrol ISP Telemetry Engine  
**Consumo Principal**: Diagnóstico de Soporte Técnico en n8n, NOC y WhatsApp Bot

---

## 1. Descripción General

Permite realizar un **diagnóstico técnico en tiempo real** contra los routers de acceso **MikroTik RouterOS** que atienden a los abonados de **Kontrol ISP / Serkoi SAS**.

Bajo el estándar **Zero-Mock**, este endpoint no genera respuestas simuladas: establece una conexión TCP directa vía RouterOS API (`MikroTikNodeManager`) con el nodo físico correspondiente para:
1. Interrogar `/ppp/active` para saber si la sesión PPPoE está viva, su Uptime, tráfico y MAC de la ONT/CPE.
2. Interrogar `/ppp/secret` para verificar si el usuario está activo o suspendido por mora (`profile: corte`).
3. Generar un diagnóstico automático con recomendaciones para el cliente o técnico de soporte.

---

## 2. Autenticación & Seguridad

Requiere una **API Key de Marca** activa.

```http
x-api-key: isp_live_serkoi_token_2026
```

---

## 3. Parámetros de Consulta (Query String)

El endpoint requiere **estrictamente** el número de contrato del servicio a diagnosticar:

| Parámetro | Tipo | Obligatorio | Descripción | Ejemplo |
|---|---|---|---|---|
| `contrato` | `string` | **SÍ** | Número de contrato (`contractNumber`) en la base de datos. | `759` |

> [!IMPORTANT]
> El diagnóstico físico/lógico se ejecuta a nivel de contrato individual contra el router MikroTik donde está provisionado el enlace. Si un abonado posee varios enlaces o sedes, primero debe consultarse el titular con `GET /api/v1/cliente?documento=...` para listar sus contratos y luego diagnosticar el contrato específico deseado.

---

## 4. Respuestas del Servidor

### A. Escenario 1: Cliente Conectado y Navegando (`ONLINE`)
```json
{
  "success": true,
  "data": {
    "status": "ONLINE",
    "node": {
      "id": "node_serkoi_01",
      "name": "NOD-SERKOI-01",
      "host": "192.168.88.1"
    },
    "pppoeUser": "carlos_ramirez_ftth",
    "telemetry": {
      "ipAddress": "10.20.30.45",
      "uptime": "2d 14h 22m",
      "uptimeSeconds": 224520,
      "callerIdMac": "48:57:02:1A:2B:3C",
      "rxBytes": 15849204000,
      "txBytes": 4529014000,
      "profile": "PLAN-50M-RESIDENCIAL",
      "administrativeStatus": "ENABLED"
    },
    "diagnosis": {
      "level": "SUCCESS",
      "code": "OK_ONLINE",
      "message": "La conexión está activa y transmitiendo tráfico correctamente.",
      "suggestedAction": "Verificar señal Wi-Fi local si el cliente reporta lentitud."
    }
  }
}
```

### B. Escenario 2: Equipo Apagado o Fibra Cortada (`OFFLINE`)
```json
{
  "success": true,
  "data": {
    "status": "OFFLINE",
    "node": {
      "name": "NOD-SERKOI-01"
    },
    "pppoeUser": "carlos_ramirez_ftth",
    "telemetry": {
      "administrativeStatus": "ENABLED",
      "lastLogout": "2026-11-04T18:12:00.000Z",
      "lastCallerId": "48:57:02:1A:2B:3C"
    },
    "diagnosis": {
      "level": "WARNING",
      "code": "CPE_DISCONNECTED",
      "message": "El usuario no presenta sesión PPPoE activa en el MikroTik.",
      "suggestedAction": "Solicitar al cliente revisar si el router/ONT tiene los leds encendidos (Power y PON/LOS)."
    }
  }
}
```

### C. Escenario 3: Servicio Suspendido por Mora (`SUSPENDED`)
```json
{
  "success": true,
  "data": {
    "status": "SUSPENDED",
    "node": {
      "name": "NOD-SERKOI-01"
    },
    "pppoeUser": "carlos_ramirez_ftth",
    "telemetry": {
      "administrativeStatus": "DISABLED",
      "profile": "MOROSOS_PORTAL"
    },
    "diagnosis": {
      "level": "DANGER",
      "code": "ADMINISTRATIVE_SUSPENSION",
      "message": "El servicio se encuentra suspendido por corte administrativo o factura vencida.",
      "suggestedAction": "Redirigir al cliente a la pasarela de pagos o reportar abono pendiente."
    }
  }
}
```

---

## 5. Ejemplos de Implementación

### Consumo vía cURL
```bash
curl -X GET "http://localhost:3016/api/v1/diagnostico?pppoeUser=carlos_ramirez_ftth" \
  -H "x-api-key: isp_live_serkoi_token_2026" \
  -H "Accept: application/json"
```

### Configuración en n8n
El workflow de n8n puede encadenar la consulta:
1. Recibe la cédula por WhatsApp &rarr; Llama a `/api/v1/cliente`.
2. Extrae el `contract.pppoeUser` de la respuesta.
3. Invoca a `/api/v1/diagnostico?pppoeUser={{ $json.contract.pppoeUser }}`.
4. Con un nodo `Switch` o `If`, responde automáticamente al abonado con el diagnóstico humano (`diagnosis.message`).

