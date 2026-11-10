# API Técnica: Consulta de Cliente & Estado del Servicio
**Endpoint**: `GET /api/v1/cliente`  
**Servicio**: Kontrol ISP API Gateway  
**Consumo Principal**: Workflows n8n, Chatbots de WhatsApp, Portales de Autoservicio

---

## 1. Descripción General

Permite a sistemas externos (como bots de atención al cliente en n8n o WhatsApp) consultar la información integral de un abonado en la base de datos productiva de **Kontrol ISP / Serkoi SAS**.

El endpoint devuelve:
- Datos personales y de contacto del titular.
- Contrato activo, plan de navegación, velocidad y fecha de corte.
- Equipos CPE instalados en sitio (marca, MAC, serial).
- Estado financiero preliminar y saldo pendiente.
- Estado de conexión física/lógica en el nodo MikroTik.

---

## 2. Autenticación & Seguridad

Todas las peticiones requieren una **API Key de Marca** válida asociada a la empresa correspondiente (por ejemplo, Serkoi SAS).

Puede suministrarse mediante cualquiera de estos tres métodos:

1. **Cabecera HTTP Estándar (Recomendado)**:
   ```http
   x-api-key: isp_live_serkoi_token_2026
   ```
2. **Cabecera de Autorización Bearer**:
   ```http
   Authorization: Bearer isp_live_serkoi_token_2026
   ```
3. **Parámetro Query en la URL**:
   ```http
   GET /api/v1/cliente?documento=45495991&apiKey=isp_live_serkoi_token_2026
   ```

---

## 3. Parámetros de Consulta (Query String)

El endpoint requiere **estrictamente** el documento de identidad del abonado:

| Parámetro | Tipo | Obligatorio | Descripción | Ejemplo |
|---|---|---|---|---|
| `documento` | `string` | **SÍ** | Cédula de ciudadanía o NIT del cliente registrado. | `45495991` |

> [!IMPORTANT]
> Para garantizar máxima precisión y evitar colisiones entre líneas o sedes, la búsqueda de clientes opera exclusivamente por **documento**. La consulta devuelve la información del titular junto con todos sus contratos de servicio asociados y sus respectivos números de contrato (`numero_contrato`), los cuales deben usarse para el endpoint de diagnóstico técnico.

---

## 4. Respuestas del Servidor

### Respuesta Exitosa (`200 OK`)
```json
{
  "success": true,
  "data": {
    "client": {
      "id": "clx123abc456",
      "code": "CLI-0542",
      "name": "CARLOS ANDRES RAMIREZ",
      "identification": "1088294711",
      "phone": "3101234567",
      "email": "carlos.ramirez@gmail.com",
      "address": "CRA 15 # 24-30 BARRIO CENTRO",
      "city": "Pereira",
      "department": "Risaralda"
    },
    "contract": {
      "id": "cnt_998877",
      "contractNumber": "CNT-2024-001",
      "status": "ACTIVE",
      "pppoeUser": "carlos_ramirez_ftth",
      "ipAddress": "10.20.30.45",
      "nodeName": "NOD-SERKOI-01",
      "plan": {
        "name": "Plan Fibra Residencial 50M",
        "downloadSpeed": "50 Mbps",
        "uploadSpeed": "25 Mbps",
        "monthlyFee": 65000,
        "cutOffDay": 10
      }
    },
    "equipment": {
      "hasCpe": true,
      "model": "Huawei HG8145V5",
      "macAddress": "48:57:02:1A:2B:3C",
      "serialNumber": "HWTC1A2B3C4D"
    },
    "billing": {
      "currentBalance": 0,
      "paymentStatus": "UP_TO_DATE",
      "lastPaymentDate": "2026-10-05T14:30:00.000Z"
    },
    "connectionStatus": "ONLINE"
  }
}
```

### Respuestas de Error Comunes

#### `401 Unauthorized` (Falta o es inválida la API Key)
```json
{
  "success": false,
  "error": "API Key inválida o no proporcionada. Verifique las credenciales de la marca."
}
```

#### `400 Bad Request` (Faltan parámetros de búsqueda)
```json
{
  "success": false,
  "error": "Debe especificar al menos un parámetro de búsqueda: cedula, contractNumber, phone, email o code."
}
```

#### `404 Not Found` (Cliente no encontrado)
```json
{
  "success": false,
  "error": "No se encontró ningún abonado con los datos especificados."
}
```

---

## 5. Ejemplos de Implementación

### Consumo vía cURL
```bash
curl -X GET "http://localhost:3016/api/v1/cliente?cedula=1088294711" \
  -H "x-api-key: isp_live_serkoi_token_2026" \
  -H "Accept: application/json"
```

### Configuración en n8n (Nodo HTTP Request)
1. **Method**: `GET`
2. **URL**: `http://kontrol-isp-app:3000/api/v1/cliente` (o URL pública del proxy)
3. **Authentication**: `None` (usamos cabecera personalizada)
4. **Send Headers**: Activado
   - Name: `x-api-key`
   - Value: `isp_live_serkoi_token_2026`
5. **Send Query Parameters**: Activado
   - Name: `cedula`
   - Value: `{{ $json.chatInputIdentification }}`

