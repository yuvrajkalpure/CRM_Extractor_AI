import { generateContent } from "./geminiClient";
import { CrmRecord, CrmStatus, ImportResult, SkippedRecord } from "../types/crm";

const BATCH_SIZE = 20;

// Hard whitelist for crm_status. Anything else (including English phrases
// like "Reviewing quotation", "Interested", "Busy") gets stripped to "" by
// the post-parse sanitizer below — this is defense in depth on top of the
// prompt.
const ALLOWED_CRM_STATUSES: ReadonlySet<CrmStatus> = new Set<CrmStatus>([
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
]);

function buildBatchPrompt(records: Record<string, string>[]) {
  return `
You are an expert CRM extraction engine.

Convert the following CSV records into GrowEasy CRM records.

CRM Fields

created_at
name
email
country_code
mobile_without_country_code
company
city
state
country
lead_owner
crm_status
crm_note
data_source
possession_time
description

Rules

1. created_at
Return an ISO 8601 string in UTC, e.g. "2026-07-11T14:23:00.000Z".
If unavailable return "".

2. email
Use first valid email.
Extra emails go into crm_note.

3. mobile + country_code
country_code:   digits-only with leading "+", e.g. "+91" or "+1".
                NEVER include the local number here. NEVER include dashes.
mobile_without_country_code: digits only, e.g. "7766554433".
                NEVER include "+", dashes, spaces, or the country code here.
If no country code is detectable, return "" for country_code and the
full digits-only local number in mobile_without_country_code.
Extra phones go into crm_note.

4. crm_status

The ONLY legal values are exactly these four strings:

  GOOD_LEAD_FOLLOW_UP
  DID_NOT_CONNECT
  BAD_LEAD
  SALE_DONE

Infer crm_status ONLY if the evidence exactly matches one of these values.
Never invent any other status.
If uncertain return "".

The downstream system will reject anything outside the 4-value whitelist,
so returning a phrase is wasted work. Put the long-form text into
crm_note instead.

5. crm_note

Put comments,
remarks,
extra phones,
extra emails,
follow-up notes,
everything useful.

6. data_source

Allowed values

leads_on_demand
meridian_tower
eden_park
varah_swamy
sarjapur_plots

Otherwise return "".

7.

If BOTH email and phone are missing

DO NOT return that record.

8.

Every object MUST contain ALL fields.

9.

Return ONLY a JSON array.

No explanation.

No markdown.

No code fences.

Input Records

${JSON.stringify(records, null, 2)}
`;
}

function cleanJson(text: string) {

  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

}

function normalizePhone(record: any) {

  let phone =
    record.mobile_without_country_code ||
    record.phone ||
    record.mobile ||
    "";

  let countryCode =
    record.country_code ||
    "";

  if (phone.startsWith("+")) {

    const m = phone.match(/^(\+\d+)/);

    if (m) {

      countryCode = m[1];

      phone = phone.replace(m[1], "");

    }

  }

  phone = phone.replace(/\D/g, "");

  return {

    countryCode,

    phone

  };

}

// If the model put the full number into country_code (e.g. "+91-7766554433"),
// peel off the leading "+<digits>" and drop the rest into the local phone.
function repairCountryCode(
  countryCode: string,
  phone: string
): { countryCode: string; phone: string } {
  if (!countryCode) return { countryCode, phone };

  const m = countryCode.match(/^(\+\d{1,4})\D*(.*)$/);
  if (!m) return { countryCode, phone };

  const cc = m[1];
  const leaked = m[2] || "";

  if (!leaked) {
    return { countryCode: cc, phone };
  }

  // Move any leaked digits back into the local phone field.
  const leakedDigits = leaked.replace(/\D/g, "");
  const phoneDigits = (phone || "").replace(/\D/g, "");

  // De-dupe when the local phone is a prefix/substring of leaked (common
  // when the model literally copied the same number into both fields).
  let merged = phoneDigits;
  if (leakedDigits && !phoneDigits.endsWith(leakedDigits)) {
    merged = phoneDigits + leakedDigits;
  } else if (!phoneDigits && leakedDigits) {
    merged = leakedDigits;
  }

  return { countryCode: cc, phone: merged };
}

// Coerce whatever the model returned into a strict ISO 8601 UTC string.
// Returns "" if the value can't be parsed.
function normalizeCreatedAt(v: any): string {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

// Rule-based status inference from free-text notes. The model is told to
// return "" for crm_status when it isn't sure, so we fill in the bucket
// ourselves using a fixed synonym list. Order matters: more specific
// phrases (e.g. "sale completed") are tested first, and GOOD_LEAD_FOLLOW_UP
// is tested BEFORE DID_NOT_CONNECT because "call later", "call next week",
// "follow up" are warm-lead signals, not failed-contact signals.
const STATUS_PATTERNS: Array<{ status: CrmStatus; re: RegExp }> = [
  // SALE_DONE — explicit close signals
  { status: "SALE_DONE", re: /\b(sale\s+completed|booking\s+confirmed|payment\s+completed|deal\s+closed|onboarding\s+started|closed[- ]?won)\b/i },

  // BAD_LEAD
  { status: "BAD_LEAD", re: /\b(rejected|wrong\s+person|not\s+interested|\bspam\b|no\s+requirement)\b/i },

  // GOOD_LEAD_FOLLOW_UP — checked BEFORE DID_NOT_CONNECT so that
  // "call later" / "call next week" / "follow up" / "interested" /
  // "ready to purchase" / "proposal" / "quotation" / "review" /
  // "approval" / "demo" all land here, not in the failed-contact bucket.
  {
    status: "GOOD_LEAD_FOLLOW_UP",
    re: /\b(call\s+next|call\s+later|call\s+tomorrow|call\s+back|next\s+week|next\s+month|follow[\s-]?up|interested|ready\s+to\s+purchase|proposal|quotation|\breview\b|approval|demo|discuss(ing|ion)?\s+with\s+finance|reviewing\s+quotation|requested\s+(?:proposal|demo)|review\s+internally|waiting\s+for\s+approval)\b/i,
  },

  // DID_NOT_CONNECT — failed contact only: busy, no answer, unreachable,
  // travelling, switched off. Phrases like "call later" / "call next
  // week" are NOT in this list — they're a commitment to re-engage,
  // not a missed call.
  {
    status: "DID_NOT_CONNECT",
    re: /\b(\bbusy\b|\bno\s+answer\b|didn'?t\s+connect|did\s+not\s+connect|call\s+not\s+connected|not\s+reachable|unreachable|switched\s+off|unavailable|\btravelling\b|\btraveling\b|\bon\s+travel\b)\b/i,
  },
];

function inferStatusFromText(text: string): CrmStatus | "" {
  if (!text) return "";
  for (const { status, re } of STATUS_PATTERNS) {
    if (re.test(text)) return status;
  }
  return "";
}

function inferState(city: string) {

  const map: Record<string, string> = {

    Hyderabad: "Telangana",

    Chennai: "Tamil Nadu",

    Bangalore: "Karnataka",

    Mumbai: "Maharashtra",

    Pune: "Maharashtra",

    Kolkata: "West Bengal",

    Jaipur: "Rajasthan",

    Delhi: "Delhi"

  };

  return map[city] || "";

}

function inferCountry(country: string, state: string) {

  if (country) return country;

  if (state) return "India";

  return "";

}
async function processBatch(
  batch: Record<string, string>[]
): Promise<any[]> {

  const prompt = buildBatchPrompt(batch);

  const response = await generateContent(prompt);

  console.log("========== RAW AI ==========");
  console.log(response);
  console.log("============================");

  let cleaned = cleanJson(response);

  // Remove anything before first [
  const firstArray = cleaned.indexOf("[");

  if (firstArray !== -1) {
    cleaned = cleaned.substring(firstArray);
  }

  // Remove anything after last ]
  const lastArray = cleaned.lastIndexOf("]");

  if (lastArray !== -1) {
    cleaned = cleaned.substring(0, lastArray + 1);
  }

  // Remove trailing commas
  cleaned = cleaned.replace(/,\s*}/g, "}");
  cleaned = cleaned.replace(/,\s*]/g, "]");

  try {

    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed))
      throw new Error("Expected JSON array");

    return parsed;

  } catch (err) {

    console.error("========== INVALID JSON ==========");
    console.error(cleaned);
    console.error("==================================");

    throw err;

  }

}


export async function extractCrmRecords(
  rawRecords: Record<string, string>[]
): Promise<ImportResult> {

  const imported: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  const batches: Record<string, string>[][] = [];

  for (let i = 0; i < rawRecords.length; i += BATCH_SIZE) {
    batches.push(rawRecords.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `[AI Extractor] Processing ${rawRecords.length} records in ${batches.length} batch(es)`
  );

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {

    const batch = batches[batchIndex];

    console.log(
      `[AI Extractor] Batch ${batchIndex + 1}/${batches.length}`
    );

    try {

      const results = await processBatch(batch);

      for (let i = 0; i < results.length; i++) {

        const parsed = results[i];

        if (
          !parsed.email &&
          !parsed.mobile_without_country_code &&
          !parsed.phone &&
          !parsed.mobile
        ) {

          skipped.push({
            row: batch[i],
            reason: "Missing email/mobile"
          });

          continue;
        }

        const normalized = normalizePhone(parsed);
        const phoneRepaired = repairCountryCode(
          normalized.countryCode,
          normalized.phone
        );

        // Whitelist guard for crm_status — strip anything that isn't in the
        // 4-value enum. Defense in depth against the model smuggling in
        // phrases like "Reviewing quotation".
        const rawStatus = ((parsed.crm_status as string) || "").trim();
        const modelStatus: CrmStatus | "" = ALLOWED_CRM_STATUSES.has(
          rawStatus as CrmStatus
        )
          ? (rawStatus as CrmStatus)
          : "";

        // If the model returned a valid status, trust it. Otherwise infer
        // from crm_note using the synonym map. (The strict prompt nudges
        // the model toward "", so this fallback is the load-bearing path.)
        const note = (parsed.crm_note as string) || "";
        const safeStatus: CrmStatus | "" =
          modelStatus || inferStatusFromText(note);

        const city = parsed.city || "";

        let state = parsed.state || "";

        if (!state)
          state = inferState(city);

        let country = parsed.country || "";

        if (!country)
          country = inferCountry(country, state);

        imported.push({

          created_at: normalizeCreatedAt(parsed.created_at),

          name: parsed.name || "",

          email: parsed.email || "",

          country_code: phoneRepaired.countryCode,

          mobile_without_country_code: phoneRepaired.phone,

          company: parsed.company || "",

          city,

          state,

          country,

          lead_owner: parsed.lead_owner || "",

          crm_status: safeStatus,

          crm_note: parsed.crm_note || "",

          data_source: parsed.data_source || "",

          possession_time: parsed.possession_time || "",

          description: parsed.description || ""

        });

      }

    } catch (err) {

      console.error(
        `[Batch ${batchIndex}] Failed`,
        err
      );

      batch.forEach((row) => {

        skipped.push({

          row,

          reason: "AI parse error"

        });

      });

    }

  }

  return {

    imported,

    skipped,

    totalImported: imported.length,

    totalSkipped: skipped.length

  };

}

