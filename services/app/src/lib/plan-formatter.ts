export interface FormattedPlanInfo {
  title: string;
  speed: string;
  priceText: string;
  cutoffText: string;
}

export function formatPlanInfo(
  plan?: {
    name: string;
    rateLimit?: string;
    priceCop?: number;
    billingDay?: number;
  } | null
): FormattedPlanInfo {
  if (!plan) {
    return {
      title: "Sin plan",
      speed: "N/D",
      priceText: "$0 COP",
      cutoffText: "",
    };
  }

  const rawName = plan.name || "";
  if (rawName.startsWith("PLAN|")) {
    const parts = rawName.split("|");
    const speedPart = parts[1] || plan.rateLimit || "N/D";
    const categoryPart = parts[2] || "Residencial";
    const rawPrice = Number(parts[3] ?? plan.priceCop ?? 0);
    const rawCutoff = parts[4] || String(plan.billingDay || 10);

    const categoryMap: Record<string, string> = {
      Fidelizacion: "Fidelización",
      Residencial: "Residencial",
      Comercial: "Comercial",
      Corporativo: "Corporativo",
      Institucional: "Institucional",
      Dedicado: "Dedicado",
      Cortesia: "Cortesía",
      Pruebas: "Pruebas",
    };

    const cleanCategory = categoryMap[categoryPart] || categoryPart;
    const priceVal =
      Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : plan.priceCop ?? 0;
    const priceText =
      priceVal > 0
        ? `$${priceVal.toLocaleString("es-CO")} COP`
        : "Cortesía ($0)";
    const cutoffText =
      rawCutoff && rawCutoff !== "0" ? `Día ${rawCutoff}` : "";

    return {
      title: cleanCategory,
      speed: speedPart,
      priceText,
      cutoffText,
    };
  }

  const priceVal = plan.priceCop ?? 0;
  return {
    title: plan.name,
    speed: plan.rateLimit || "N/D",
    priceText:
      priceVal > 0
        ? `$${priceVal.toLocaleString("es-CO")} COP`
        : "Cortesía ($0)",
    cutoffText: plan.billingDay ? `Día ${plan.billingDay}` : "",
  };
}

