export type GatewayProvider = "DAVIPAY" | "EFECTY";

export interface PaymentGatewayConfig {
  id: string;
  brandId: string;
  provider: GatewayProvider;
  isEnabled: boolean;
  isTestMode: boolean;
  customerId?: string | null;
  publicKey?: string | null;
  privateKey?: string | null;
  pKey?: string | null;
  agreementCode?: string | null;
  secretKey?: string | null;
  validationMode: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface DaviPayWebhookPayload {
  x_cust_id_cliente?: string;
  x_ref_payco?: string;
  x_id_invoice?: string;
  x_amount?: string | number;
  x_currency_code?: string;
  x_signature?: string;
  x_cod_response?: string | number;
  x_response?: string;
  x_response_reason_text?: string;
  x_extra1?: string;
  x_extra2?: string;
  x_transaction_id?: string;
  x_franchise?: string;
  x_customer_doctype?: string;
  x_customer_document?: string;
  x_customer_name?: string;
  x_customer_email?: string;
  x_customer_phone?: string;
}

export interface EfectyQueryRequest {
  convenio: string;
  referencia: string;
  token?: string;
}

export interface EfectyQueryResponse {
  estado: "EXITO" | "ERROR";
  codigo: string;
  mensaje?: string;
  cliente?: string;
  referencia?: string;
  factura?: string;
  valor?: number;
  fechaLimite?: string;
}

export interface EfectyPaymentRequest {
  convenio: string;
  referencia: string;
  valor: number;
  transaccionId: string;
  fecha?: string;
  token?: string;
}

export interface EfectyPaymentResponse {
  estado: "EXITO" | "ERROR";
  codigo: string;
  mensaje?: string;
  reciboId?: string;
  referencia?: string;
  transaccionId?: string;
}

