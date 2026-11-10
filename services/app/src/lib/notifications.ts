import { prisma } from "@/lib/prisma";

export type NotificationTypeKey =
  | "LOGIN_SUCCESS"
  | "SUBSCRIPTION_EXPIRED_DOWNGRADE_FREE"
  | "SUBSCRIPTION_PAST_DUE_WARNING"
  | "SUBSCRIPTION_EXPIRING_SOON"
  | "PLAN_DOWNGRADE_SCHEDULED"
  | "PAYMENT_SUCCESS"
  | "PLAN_DOWNGRADE_CANCELED";

interface NotificationPayload {
  userId: string;
  type: NotificationTypeKey;
  data?: Record<string, string | number>;
}

const templates: Record<
  NotificationTypeKey,
  Record<string, (d: Record<string, string | number>) => { title: string; desc: string }>
> = {
  LOGIN_SUCCESS: {
    es: (d) => ({
      title: "Inicio de sesión registrado",
      desc: `Acceso exitoso desde ${d.browser || "Navegador"} (${d.device || "Dispositivo"}) • IP ${d.ip || "N/A"}`,
    }),
    en: (d) => ({
      title: "Login Session Registered",
      desc: `Successful login from ${d.browser || "Browser"} (${d.device || "Device"}) • IP ${d.ip || "N/A"}`,
    }),
    pt: (d) => ({
      title: "Sessão de Login Registrada",
      desc: `Acesso bem-sucedido de ${d.browser || "Navegador"} (${d.device || "Dispositivo"}) • IP ${d.ip || "N/A"}`,
    }),
  },
  SUBSCRIPTION_EXPIRED_DOWNGRADE_FREE: {
    es: (d) => ({
      title: "Suscripción Vencida: Cambio a Plan Gratuito",
      desc: `Tras finalizar el período de gracia de 5 días sin registrar un pago, el plan de tu empresa ha sido cambiado automáticamente a ${d.plan || "Free"}.`,
    }),
    en: (d) => ({
      title: "Subscription Expired: Downgraded to Free Plan",
      desc: `After the 5-day grace period expired without payment, your company's plan was automatically changed to ${d.plan || "Free"}.`,
    }),
    pt: (d) => ({
      title: "Assinatura Expirada: Alteração para Plano Gratuito",
      desc: `Após o período de carência de 5 dias sem pagamento, o plano da sua empresa foi alterado automaticamente para ${d.plan || "Free"}.`,
    }),
  },
  SUBSCRIPTION_PAST_DUE_WARNING: {
    es: () => ({
      title: "Suscripción en Período de Gracia (5 días restantes)",
      desc: "Tu pago no se procesó. Tienes 5 días de gracia para regularizar tu suscripción antes del downgrade automático a Free.",
    }),
    en: () => ({
      title: "Subscription in Grace Period (5 days remaining)",
      desc: "Your payment was not processed. You have 5 grace days to regularize your subscription before automatic downgrade to Free.",
    }),
    pt: () => ({
      title: "Assinatura em Período de Carência (5 dias restantes)",
      desc: "Seu pagamento não foi processado. Você tem 5 dias para regularizar sua assinatura antes do rebaixamento automático para o Free.",
    }),
  },
  SUBSCRIPTION_EXPIRING_SOON: {
    es: (d) => ({
      title: "Suscripción Próxima a Vencer",
      desc: `Tu plan ${d.planName} vencerá el ${d.endDate}. Recuerda renovar para mantener los límites y características activas.`,
    }),
    en: (d) => ({
      title: "Subscription Expiring Soon",
      desc: `Your ${d.planName} plan will expire on ${d.endDate}. Remember to renew to keep your limits and features active.`,
    }),
    pt: (d) => ({
      title: "Assinatura Próxima de Expirar",
      desc: `Seu plano ${d.planName} expira em ${d.endDate}. Lembre-se de renovar para manter seus limites e recursos ativos.`,
    }),
  },
  PLAN_DOWNGRADE_SCHEDULED: {
    es: (d) => ({
      title: "Reducción de Plan Programada",
      desc: `Se ha programado el cambio de plan a ${d.targetPlan}. Mantendrás los beneficios del plan actual hasta ${d.endDate}.`,
    }),
    en: (d) => ({
      title: "Plan Downgrade Scheduled",
      desc: `Plan change to ${d.targetPlan} has been scheduled. You will keep your current plan benefits until ${d.endDate}.`,
    }),
    pt: (d) => ({
      title: "Redução de Plano Agendada",
      desc: `A alteração do plano para ${d.targetPlan} foi agendada. Você manterá os benefícios do plano atual até ${d.endDate}.`,
    }),
  },
  PAYMENT_SUCCESS: {
    es: (d) => ({
      title: "Pago Procesado y Plan Actualizado",
      desc: `Tu pago de $${d.amount} USD vía ${d.provider} fue aprobado. Tu suscripción al plan ${d.plan} está activa.`,
    }),
    en: (d) => ({
      title: "Payment Processed & Plan Updated",
      desc: `Your payment of $${d.amount} USD via ${d.provider} was approved. Your subscription to the ${d.plan} plan is active.`,
    }),
    pt: (d) => ({
      title: "Pagamento Processado e Plano Atualizado",
      desc: `Seu pagamento de $${d.amount} USD via ${d.provider} foi aprovado. Sua assinatura do plano ${d.plan} está ativa.`,
    }),
  },
  PLAN_DOWNGRADE_CANCELED: {
    es: (d) => ({
      title: "Reducción de Plan Cancelada",
      desc: `Has cancelado el cambio programado a ${d.previousPlan || "plan inferior"}. Tu empresa mantendrá el plan ${d.plan}.`,
    }),
    en: (d) => ({
      title: "Plan Downgrade Canceled",
      desc: `You canceled the scheduled change to ${d.previousPlan || "lower plan"}. Your company will keep the ${d.plan} plan.`,
    }),
    pt: (d) => ({
      title: "Redução de Plano Cancelada",
      desc: `Você cancelou a alteração agendada para ${d.previousPlan || "plano inferior"}. Sua empresa manterá o plano ${d.plan}.`,
    }),
  },
};

export async function createLocalizedNotification({
  userId,
  type,
  data = {},
}: NotificationPayload) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });

    const userLocale = user?.locale?.toLowerCase() || "es";
    const lang = userLocale.startsWith("pt") ? "pt" : userLocale.startsWith("en") ? "en" : "es";

    const typeTemplates = templates[type];
    const templateFn = typeTemplates?.[lang] || typeTemplates?.es;

    if (!templateFn) return;

    const { title, desc } = templateFn(data);

    await prisma.notification.create({
      data: {
        userId,
        title,
        desc,
        type,
        read: false,
      },
    });
  } catch (_err) {
    // Fail-safe notification dispatch
  }
}
