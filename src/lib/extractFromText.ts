/**
 * extractFromText.ts
 * Estrae automaticamente dal testo libero della descrizione:
 * - Codice prodotto / part number OEM
 * - VIN (numero di telaio)
 * - Brand
 * - Categoria prodotto
 *
 * Usato da ChatContainer per pre-compilare e saltare domande già risposte.
 */

import type { CategoriaProdotto } from "@/types/lead";

export interface ExtractedFields {
  codiceProdotto?: string;
  vinCode?: string;
  brandProdotto?: string;
  categoriaProdotto?: CategoriaProdotto;
}

// Brand noti nel settore ricambi auto americani
const KNOWN_BRANDS = [
  "amsoil", "mopar", "ford", "gm", "chevrolet", "dodge", "jeep", "chrysler",
  "ram", "cadillac", "buick", "pontiac", "oldsmobile", "lincoln", "mercury",
  "acdelco", "motorcraft", "moog", "gates", "dayco", "fel-pro", "felpro",
  "edelbrock", "holley", "flowmaster", "borla", "magnaflow", "bilstein",
  "rancho", "monroe", "kyb", "koni", "eibach", "h&r", "k&n", "wix",
  "bosch", "denso", "ngk", "champion", "autolite", "accel", "msd",
  "mothers", "meguiars", "chemical guys", "3m", "dupont", "ppg", "sikkens",
  "wheel pros", "fuel", "moto metal", "rockstar", "hostile", "american racing",
  "weld", "vision", "ion", "ultra", "mb wheels", "dcenti", "foose",
  "mickey thompson", "bfgoodrich", "toyo", "nitto", "cooper", "goodyear",
  "firestone", "continental", "hankook", "falken",
];

// Pattern per codici OEM / part number (es: 68218956AA, FL-2005, 5W-30, 15W-50)
const OEM_CODE_PATTERN = /\b([A-Z0-9]{2,4}-?[A-Z0-9]{3,10}(?:[A-Z]{0,3})?)\b/g;

// Pattern VIN: 17 caratteri alfanumerici (no I, O, Q)
const VIN_PATTERN = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;

// Pattern lubrificanti (es: 5W-30, 10W-40, 0W-20)
const LUBE_VISCOSITY_PATTERN = /\b(\d{1,2}W-\d{2})\b/gi;

// Keyword per categoria
const CATEGORY_KEYWORDS: Record<CategoriaProdotto, string[]> = {
  Lubrificanti: [
    "olio", "lubrificante", "grasso", "trasmissione", "differenziale",
    "cambio", "freni fluido", "liquido freni", "antigelo", "refrigerante",
    "5w", "10w", "15w", "0w", "20w", "atf", "gear oil", "brake fluid",
  ],
  Ricambi: [
    "filtro", "candela", "cinghia", "pompa", "valvola", "pistoni", "bronzine",
    "cuscinetto", "ammortizzatore", "molla", "freno", "disco", "pastiglie",
    "testata", "guarnizione", "alternatore", "motorino", "iniettore", "sensore",
    "radiatore", "termostato", "paraurti", "fanale", "faro", "specchio",
    "ricambio", "pezzo", "spare", "part",
  ],
  Accessori: [
    "cerchio", "cerchi", "ruota", "ruote", "pneumatico", "gomma", "tappetino",
    "sedile", "volante", "cofano", "spoiler", "tuning", "accessorio", "lift kit",
    "levata", "bullone", "dado", "protezione", "cover", "griglia", "antenna",
    "wheel", "rim", "tire", "tyre", "step", "pedana", "roll bar", "roll cage",
  ],
  Vernici: [
    "vernicia", "vernice", "lacca", "primer", "fondo", "antiruggine", "smalto",
    "trasparente", "clear coat", "base coat", "paint", "spray", "aerosol",
    "carrozzeria", "ritocco",
  ],
};

export function extractFromText(text: string): ExtractedFields {
  const result: ExtractedFields = {};
  const normalized = text.toLowerCase();

  // --- VIN ---
  const vinMatches = text.match(VIN_PATTERN);
  if (vinMatches && vinMatches.length > 0) {
    result.vinCode = vinMatches[0].toUpperCase();
  }

  // --- Brand ---
  for (const brand of KNOWN_BRANDS) {
    if (normalized.includes(brand.toLowerCase())) {
      // Capitalizza correttamente
      result.brandProdotto =
        brand.charAt(0).toUpperCase() + brand.slice(1);
      break;
    }
  }

  // --- Categoria ---
  const categoryCounts: Partial<Record<CategoriaProdotto, number>> = {};
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS) as [CategoriaProdotto, string[]][]) {
    const count = keywords.filter((kw) => normalized.includes(kw)).length;
    if (count > 0) categoryCounts[cat] = count;
  }
  if (Object.keys(categoryCounts).length > 0) {
    // Prende la categoria con più keyword trovate
    result.categoriaProdotto = Object.entries(categoryCounts).sort(
      ([, a], [, b]) => b - a
    )[0][0] as CategoriaProdotto;
  }

  // --- Codice prodotto (solo se non è un VIN) ---
  // Cerca viscosità lubrificanti prima (es: 5W-30)
  const lubeMatch = text.match(LUBE_VISCOSITY_PATTERN);
  if (lubeMatch && lubeMatch.length > 0 && !result.vinCode) {
    result.codiceProdotto = lubeMatch[0].toUpperCase();
  } else if (!result.vinCode) {
    // Cerca pattern OEM
    const oemMatches = [...text.matchAll(OEM_CODE_PATTERN)];
    const candidates = oemMatches
      .map((m) => m[1])
      .filter((c) => {
        // Esclude parole comuni, anni, sigle irrilevanti
        if (c.length < 5) return false;
        if (/^\d{4}$/.test(c)) return false; // anno
        if (/^[A-Z]{1,3}$/.test(c)) return false; // sigla troppo corta
        return true;
      });
    if (candidates.length > 0) {
      result.codiceProdotto = candidates[0];
    }
  }

  return result;
}
