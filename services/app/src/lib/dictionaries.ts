import es from "@/locales/es.json";

export type Dictionary = typeof es;

const dictionaries: Record<string, Dictionary> = {
  es,
};

/**
 * Returns the static JSON dictionary for Spanish (es).
 */
export async function getDictionary(_locale = "es"): Promise<Dictionary> {
  return dictionaries.es;
}
