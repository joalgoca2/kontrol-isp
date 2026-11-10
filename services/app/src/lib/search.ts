import { prisma } from "@/lib/prisma";

export type UnaccentSearchScope =
  | "users"
  | "brands"
  | "nodes"
  | "plans"
  | "clients"
  | "contracts"
  | "payments"
  | "tickets";

export type SearchCategory = "SHORT_NUMERIC" | "LONG_NUMERIC" | "TEXT";

/**
 * Categoriza el término de búsqueda para enrutar la consulta a los índices
 * óptimos (B-Tree exacto vs unaccent) y prevenir sobrecarga en PostgreSQL.
 */
export function categorizeSearch(raw: string): {
  category: SearchCategory;
  cleaned: string;
} {
  const cleaned = raw.trim().replace(/^#/, "");
  if (/^\d{1,5}$/.test(cleaned)) {
    return { category: "SHORT_NUMERIC", cleaned };
  }
  if (/^\d{6,12}$/.test(cleaned)) {
    return { category: "LONG_NUMERIC", cleaned };
  }
  return { category: "TEXT", cleaned };
}

/**
 * Ejecuta una búsqueda insensible a acentos y mayúsculas con enrutamiento inteligente
 * según el patrón del término (código/contrato vs cédula/teléfono vs texto general).
 */
export async function searchIdsWithUnaccent(
  scope: UnaccentSearchScope,
  rawSearch: string,
  brandId?: string | null,
  limit: number = 50
): Promise<string[]> {
  const { category, cleaned } = categorizeSearch(rawSearch);
  if (!cleaned) {
    return [];
  }

  const pattern = `%${cleaned}%`;
  const legacyClientId = `serkoi-client-${cleaned}`;
  const legacyContractId = `serkoi-contract-${cleaned}`;
  const validBrand = brandId && brandId !== "ALL" ? brandId : null;
  let rows: Array<{ id: string }> = [];

  switch (scope) {
    case "users":
      rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT u."id"
        FROM "users" u
        WHERE (
          ${validBrand}::text IS NULL OR u."brandId" = ${validBrand}
        ) AND public.f_unaccent(
          CONCAT_WS(' ', u."name", u."email")
        ) ILIKE public.f_unaccent(${pattern})
        LIMIT ${limit}
      `;
      break;

    case "brands":
      rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT b."id"
        FROM "brands" b
        WHERE public.f_unaccent(
          CONCAT_WS(' ', b."name", b."slug", b."legalName", b."taxId")
        ) ILIKE public.f_unaccent(${pattern})
        LIMIT ${limit}
      `;
      break;

    case "nodes":
      rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT n."id"
        FROM "mikrotik_nodes" n
        WHERE (
          ${validBrand}::text IS NULL OR n."brandId" = ${validBrand}
        ) AND public.f_unaccent(
          CONCAT_WS(' ', n."name", n."code", n."host", n."location")
        ) ILIKE public.f_unaccent(${pattern})
        LIMIT ${limit}
      `;
      break;

    case "plans":
      rows = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT p."id"
        FROM "plans" p
        WHERE (
          ${validBrand}::text IS NULL OR p."brandId" = ${validBrand}
        ) AND public.f_unaccent(
          CONCAT_WS(' ', p."name", p."rateLimit", p."mikrotikProfile")
        ) ILIKE public.f_unaccent(${pattern})
        LIMIT ${limit}
      `;
      break;

    case "clients":
      if (category === "SHORT_NUMERIC") {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT c."id"
          FROM "clients" c
          LEFT JOIN "contracts" ct ON ct."clientId" = c."id"
          WHERE (
            ${validBrand}::text IS NULL OR c."brandId" = ${validBrand}
          ) AND (
            c."client_code" = ${cleaned}
            OR c."id" = ${cleaned}
            OR c."id" = ${legacyClientId}
            OR ct."contractNumber" = ${cleaned}
            OR c."documentNumber" = ${cleaned}
          )
          LIMIT ${limit}
        `;
      } else if (category === "LONG_NUMERIC") {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT c."id"
          FROM "clients" c
          WHERE (
            ${validBrand}::text IS NULL OR c."brandId" = ${validBrand}
          ) AND (
            c."documentNumber" = ${cleaned}
            OR c."phonePrimary" ILIKE ${"%" + cleaned}
            OR c."phoneSecondary" ILIKE ${"%" + cleaned}
          )
          LIMIT ${limit}
        `;
      } else {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT c."id"
          FROM "clients" c
          LEFT JOIN "contracts" ct ON ct."clientId" = c."id"
          WHERE (
            ${validBrand}::text IS NULL OR c."brandId" = ${validBrand}
          ) AND (
            public.f_unaccent(c."fullName") ILIKE public.f_unaccent(${pattern})
            OR ct."pppoeUser" ILIKE ${pattern}
            OR c."email" ILIKE ${pattern}
            OR public.f_unaccent(COALESCE(c."address", ''))
               ILIKE public.f_unaccent(${pattern})
          )
          LIMIT ${limit}
        `;
      }
      break;

    case "contracts":
      if (category === "SHORT_NUMERIC") {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT ct."id"
          FROM "contracts" ct
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR ct."brandId" = ${validBrand}
          ) AND (
            ct."contractNumber" = ${cleaned}
            OR ct."id" = ${cleaned}
            OR ct."id" = ${legacyContractId}
            OR c."client_code" = ${cleaned}
            OR c."id" = ${cleaned}
            OR c."id" = ${legacyClientId}
            OR c."documentNumber" = ${cleaned}
          )
          LIMIT ${limit}
        `;
      } else if (category === "LONG_NUMERIC") {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT ct."id"
          FROM "contracts" ct
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR ct."brandId" = ${validBrand}
          ) AND (
            c."documentNumber" = ${cleaned}
            OR ct."contractNumber" = ${cleaned}
            OR c."phonePrimary" ILIKE ${"%" + cleaned}
          )
          LIMIT ${limit}
        `;
      } else {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT ct."id"
          FROM "contracts" ct
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR ct."brandId" = ${validBrand}
          ) AND (
            public.f_unaccent(c."fullName") ILIKE public.f_unaccent(${pattern})
            OR ct."pppoeUser" ILIKE ${pattern}
            OR c."email" ILIKE ${pattern}
            OR public.f_unaccent(ct."address") ILIKE public.f_unaccent(${pattern})
          )
          LIMIT ${limit}
        `;
      }
      break;

    case "payments":
      if (category === "SHORT_NUMERIC") {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT p."id"
          FROM "payments" p
          INNER JOIN "contracts" ct ON ct."id" = p."contractId"
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR p."brandId" = ${validBrand}
          ) AND (
            CAST(p."receiptNumber" AS TEXT) = ${cleaned}
            OR ct."contractNumber" = ${cleaned}
            OR c."client_code" = ${cleaned}
          )
          LIMIT ${limit}
        `;
      } else if (category === "LONG_NUMERIC") {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT p."id"
          FROM "payments" p
          INNER JOIN "contracts" ct ON ct."id" = p."contractId"
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR p."brandId" = ${validBrand}
          ) AND (
            c."documentNumber" = ${cleaned}
            OR p."invoiceNumber" ILIKE ${pattern}
            OR p."externalReference" ILIKE ${pattern}
          )
          LIMIT ${limit}
        `;
      } else {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT p."id"
          FROM "payments" p
          INNER JOIN "contracts" ct ON ct."id" = p."contractId"
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR p."brandId" = ${validBrand}
          ) AND (
            public.f_unaccent(c."fullName") ILIKE public.f_unaccent(${pattern})
            OR ct."pppoeUser" ILIKE ${pattern}
            OR p."notes" ILIKE ${pattern}
          )
          LIMIT ${limit}
        `;
      }
      break;

    case "tickets":
      if (category === "SHORT_NUMERIC") {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT t."id"
          FROM "support_tickets" t
          INNER JOIN "contracts" ct ON ct."id" = t."contractId"
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR t."brandId" = ${validBrand}
          ) AND (
            t."ticketNumber" = ${cleaned}
            OR ct."contractNumber" = ${cleaned}
            OR c."client_code" = ${cleaned}
          )
          LIMIT ${limit}
        `;
      } else if (category === "LONG_NUMERIC") {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT t."id"
          FROM "support_tickets" t
          INNER JOIN "contracts" ct ON ct."id" = t."contractId"
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR t."brandId" = ${validBrand}
          ) AND (
            c."documentNumber" = ${cleaned}
            OR c."phonePrimary" ILIKE ${"%" + cleaned}
          )
          LIMIT ${limit}
        `;
      } else {
        rows = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT DISTINCT t."id"
          FROM "support_tickets" t
          INNER JOIN "contracts" ct ON ct."id" = t."contractId"
          INNER JOIN "clients" c ON c."id" = ct."clientId"
          WHERE (
            ${validBrand}::text IS NULL OR t."brandId" = ${validBrand}
          ) AND (
            public.f_unaccent(t."description") ILIKE public.f_unaccent(${pattern})
            OR public.f_unaccent(c."fullName") ILIKE public.f_unaccent(${pattern})
            OR ct."pppoeUser" ILIKE ${pattern}
          )
          LIMIT ${limit}
        `;
      }
      break;
  }

  return rows.map((r) => r.id);
}
