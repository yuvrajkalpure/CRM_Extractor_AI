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
If multiple email addresses exist, use ONLY the first valid email in
the "email" field. Do NOT concatenate multiple addresses into "email"
(e.g. "a@x.com,b@y.com" is WRONG).
Append the remaining emails into crm_note, one per line, in the form
"Additional email: <address>".

Example — input contains "arjun@gmail.com,reddy@gmail.com":
  email:     "arjun@gmail.com"
  crm_note:  "Interested in 3BHK; Follow up after 2 days; Additional email: reddy@gmail.com"

CRITICAL: If the input contains an email value, you MUST copy the
first valid address through to "email" exactly as provided. Do NOT
clear, blank, or omit a valid email from the source — regardless of
crm_status, notes, or how "bad" the lead appears. Contact data is
always preserved; only the status bucket reflects lead quality.

3. mobile + country_code
country_code:   digits-only with leading "+", e.g. "+91" or "+1".
                NEVER include the local number here. NEVER include dashes.
mobile_without_country_code: digits only, e.g. "7766554433".
                NEVER include "+", dashes, spaces, or the country code here.
                If multiple phone numbers exist, use ONLY the first one.
                NEVER concatenate phone numbers into mobile_without_country_code.
If no country code is detectable, return "" for country_code and the
full digits-only local number in mobile_without_country_code.
Append remaining phones into crm_note, one per line, in the form
"Additional phone: <digits>".

CRITICAL: If the input contains a mobile/phone value, you MUST copy it
through to the phone fields EXACTLY as provided. Do NOT clear, blank,
or omit valid contact numbers from the source.

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

// Pulls the first plausible email from a raw CSV row. Looks at every
// common column name; returns "" if none of them contain a value that
// looks like an email. This is the safety net for when the model drops
// a valid contact field.
function pickOriginalEmail(row: Record<string, string> | undefined): string {
  if (!row) return "";
  const keys = ["email", "e-mail", "mail", "email_address", "primary email"];
  for (const k of keys) {
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase().trim() === k) {
        const v = (row[rowKey] || "").trim();
        if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
      }
    }
  }
  // Fallback: scan every value in the row for anything that looks like an
  // email. The model sometimes drops the field even though the source
  // CSV clearly contains one in a non-standard column.
  for (const v of Object.values(row)) {
    const s = (v || "").trim();
    if (s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  }
  return "";
}

// Pulls the first plausible mobile/phone digits from a raw CSV row.
// Returns "" if nothing usable is found. Defensive counterpart to
// pickOriginalEmail — only used to re-fill when the model blanks a
// valid contact number.
function pickOriginalPhone(row: Record<string, string> | undefined): string {
  if (!row) return "";
  const keys = [
    "mobile",
    "mobile number",
    "mobile_number",
    "phone",
    "phone number",
    "phone_number",
    "contact number",
    "whatsapp",
  ];
  for (const k of keys) {
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase().trim() === k) {
        const v = (row[rowKey] || "").trim();
        const digits = (v || "").replace(/\D/g, "");
        if (digits && digits.length >= 7) return digits;
      }
    }
  }
  return "";
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
  { status: "SALE_DONE", re: /\b(sale\s+completed|booking\s+confirmed|payment\s+completed|deal\s+closed|onboarding\s+started|closed[- ]?won|token\s+(?:paid|given)|agreement\s+signed)\b/i },

  // BAD_LEAD — explicit rejection or disqualification. Covers both
  // declarative phrases ("not looking for services", "not interested",
  // "no requirement", "not in market", "budget too low") and the CRM
  // dropdown value "Rejected" itself.
  {
    status: "BAD_LEAD",
    re: /\b(rejected|wrong\s+(?:person|number)|not\s+interested|\bspam\b|no\s+requirement|not\s+looking|not\s+in\s+(?:the\s+)?market|not\s+relevant|invalid\s+(?:lead|number|contact)|budget\s+(?:too\s+low|issue)|not\s+eligible|do\s+not\s+disturb|\bdnd\b|out\s+of\s+(?:scope|region|city|country)|wrong\s+lead|duplicate\s+lead|test\s+lead)\b/i,
  },

  // GOOD_LEAD_FOLLOW_UP — checked BEFORE DID_NOT_CONNECT so that
  // "call later" / "call next week" / "follow up" / "interested" /
  // "ready to purchase" / "proposal" / "quotation" / "review" /
  // "approval" / "demo" all land here, not in the failed-contact bucket.
  // Also catches the "call after <time>" / "call at <time>" pattern
  // (e.g. "Asked to call after 5 PM") — that's a warm lead with a
  // scheduled callback, NOT a failed contact.
  // Real-estate vocabulary is included because the downstream CRM is
  // a property platform: "looking for villa", "wants 3BHK", "site
  // visit", "possession", "ready to move", etc. are all active
  // buyer signals, not failed contacts.
  {
    status: "GOOD_LEAD_FOLLOW_UP",
    re: /\b(call\s+next|call\s+later|call\s+tomorrow|call\s+back|call\s+(?:at|after|before|in)\s+\d|next\s+week|next\s+month|follow[\s-]?up|interested|ready\s+to\s+(?:purchase|buy|move)|proposal|quotation|\breview\b|approval|approv|\bdemo\b|discuss(?:ing|ion)?\s+with|reviewing\s+quotation|requested?\s+(?:proposal|document|demo|quote|info|detail)|review\s+internally|waiting\s+for\s+(?:approval|sign|review|management|decision|confirm|internal)|asked\s+to\s+call|will\s+call\s+back|will\s+get\s+back|will\s+reach\s+out|will\s+(?:review|check|discuss|respond|decide|get\s+back)|schedule(?:d)?\s+(?:a\s+)?call|book(?:ed)?\s+(?:a\s+)?call|meeting\s+(?:set|scheduled)|site\s+visit|hot\s+lead|warm\s+lead|positive\s+response|enquiry|enquired|inquir(?:y|ed)|looking\s+for|looking\s+to\s+(?:buy|purchase|invest|rent)|wants?\s+(?:a\s+)?(?:villa|apartment|flat|plot|house|home|property|\d\s*bhk|2\s*bhk|3\s*bhk|4\s*bhk|1\s*bhk)|need(?:s)?\s+(?:a\s+)?(?:villa|apartment|flat|plot|house|home|property|\d\s*bhk)|searching\s+for|\bvilla\b|\bapartment\b|\bflat\b|\bplot\b|\d\s*bhk|2\s*bhk|3\s*bhk|4\s*bhk|1\s*bhk|possession|ready\s+to\s+move|investment\s+purpose|end\s+use|self\s+use|budget\s+(?:is|around|of)|booking\s+amount|token\s+amount|emi\s+(?:option|plan)|in\s+discussion|considering|thinks?\s+about|need(?:s)?\s+time\s+to)\b/i,
  },

  // DID_NOT_CONNECT — failed contact: busy, no answer, unreachable,
  // travelling, postponed, out of office, decision maker away.
  // Phrases like "call later" / "call next week" are NOT here — they
  // are a warm-lead callback commitment, not a missed contact.
  {
    status: "DID_NOT_CONNECT",
    re: /\b(\bbusy\b|\bno\s+answer\b|didn'?t\s+connect|did\s+not\s+connect|call\s+not\s+connected|not\s+reachable|unreachable|switched\s+off|phone\s+off|line\s+busy|ringing\s+no\s+reply|phone\s+switched\s+off|number\s+(?:does\s+not\s+exist|invalid|not\s+in\s+service)|voicemail|phone\s+dead|postponed?|travel+ing|out\s+of\s+(?:town|office|station|country|city)|on\s+(?:leave|vacation|holiday|tour)|decision\s+maker\s+(?:is\s+)?(?:travel+ing|away|unavailable|not\s+available)|not\s+in\s+office|not\s+available\s+(?:right\s+now|at\s+the\s+moment|today|this\s+week)|will\s+be\s+(?:back|available)\s+(?:after|next|in)|reschedul)\b/i,
  },
];


function inferStatusFromText(text: string): CrmStatus | "" {
  if (!text) return "";
  for (const { status, re } of STATUS_PATTERNS) {
    if (re.test(text)) return status;
  }
  return "";
}

// Direct synonym map for canonical status labels that come straight
// from CRM UI dropdowns (e.g. "Interested", "Busy", "Closed",
// "Rejected"). These are short, unambiguous values that don't need
// the pattern list — if the source row's Lead Status is one of these,
// we map it directly to the bucket.
const STATUS_SYNONYMS: Record<string, CrmStatus> = {
  // GOOD_LEAD_FOLLOW_UP
  "interested": "GOOD_LEAD_FOLLOW_UP",
  "warm": "GOOD_LEAD_FOLLOW_UP",
  "hot": "GOOD_LEAD_FOLLOW_UP",
  "prospect": "GOOD_LEAD_FOLLOW_UP",
  "qualified": "GOOD_LEAD_FOLLOW_UP",
  "follow up": "GOOD_LEAD_FOLLOW_UP",
  "follow_up": "GOOD_LEAD_FOLLOW_UP",
  "followup": "GOOD_LEAD_FOLLOW_UP",
  "callback": "GOOD_LEAD_FOLLOW_UP",
  "call back": "GOOD_LEAD_FOLLOW_UP",
  "new": "GOOD_LEAD_FOLLOW_UP",
  "open": "GOOD_LEAD_FOLLOW_UP",
  "active": "GOOD_LEAD_FOLLOW_UP",
  "in progress": "GOOD_LEAD_FOLLOW_UP",
  "pending": "GOOD_LEAD_FOLLOW_UP",

  // DID_NOT_CONNECT
  "busy": "DID_NOT_CONNECT",
  "no answer": "DID_NOT_CONNECT",
  "not reachable": "DID_NOT_CONNECT",
  "unreachable": "DID_NOT_CONNECT",
  "switched off": "DID_NOT_CONNECT",
  "voicemail": "DID_NOT_CONNECT",
  "ringing": "DID_NOT_CONNECT",

  // BAD_LEAD
  "rejected": "BAD_LEAD",
  "not interested": "BAD_LEAD",
  "junk": "BAD_LEAD",
  "spam": "BAD_LEAD",
  "invalid": "BAD_LEAD",
  "lost": "BAD_LEAD",
  "dead": "BAD_LEAD",
  "do not disturb": "BAD_LEAD",
  "dnd": "BAD_LEAD",
  "duplicate": "BAD_LEAD",
  "wrong number": "BAD_LEAD",

  // SALE_DONE
  "closed": "SALE_DONE",
  "closed won": "SALE_DONE",
  "won": "SALE_DONE",
  "converted": "SALE_DONE",
  "booked": "SALE_DONE",
  "sold": "SALE_DONE",
  "paid": "SALE_DONE",
  "completed": "SALE_DONE",
};

// Look up a canonical status by its raw label. Returns "" if the label
// is empty or not a recognized synonym. Used to map the source CSV's
// "Lead Status" column directly to a bucket.
function lookupStatusLabel(label: string): CrmStatus | "" {
  if (!label) return "";
  const k = label.trim().toLowerCase();
  if (!k) return "";
  return STATUS_SYNONYMS[k] || "";
}

// Pulls the original "Lead Status" (or equivalent) value from a raw CSV
// row. Used as an additional input to the rule-based classifier when
// the model blanks crm_status. The model is told to map this column
// onto the 4-value enum, but it often returns "" instead — so we read
// the source value directly and look it up in STATUS_SYNONYMS.
function pickOriginalLeadStatus(row: Record<string, string> | undefined): string {
  if (!row) return "";
  const keys = ["lead status", "status", "lead_status", "stage", "pipeline stage"];
  for (const k of keys) {
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase().trim() === k) {
        return (row[rowKey] || "").trim();
      }
    }
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

// ── Contact splitting helpers ─────────────────────────────────────────────────

/** Given a raw email string that may contain several addresses (comma /
 *  semicolon separated), keeps only the first valid RFC-like address in the
 *  return value and pushes the rest into `extras`. */
function splitFirstEmail(raw: string, extras: string[]): string {
  if (!raw) return '';
  const parts = raw.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  const valid = parts.filter((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
  if (valid.length === 0) return raw.trim(); // not recognisable — return as-is
  extras.push(...valid.slice(1));
  return valid[0];
}

/** Given a raw phone string that may contain several numbers (comma /
 *  semicolon separated), keeps only the first digits-only token in the
 *  return value and pushes the rest into `extras`. */
function splitFirstPhone(raw: string, extras: string[]): string {
  if (!raw) return '';
  const parts = raw.split(/[,;]+/).map((p) => p.trim().replace(/\D/g, '')).filter(Boolean);
  if (parts.length === 0) return '';
  extras.push(...parts.slice(1));
  return parts[0];
}

/** Appends extra email and phone entries to the base note string. */
function appendExtrasToNote(
  baseNote: string,
  extraEmails: string[],
  extraPhones: string[]
): string {
  const lines: string[] = baseNote ? [baseNote] : [];
  extraEmails.forEach((e) => lines.push(`Additional email: ${e}`));
  extraPhones.forEach((p) => lines.push(`Additional phone: ${p}`));
  return lines.join('\n');
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
        const originalRow = batch[i];

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

        // Sanitize "email": if the model put multiple addresses into one
        // string (separated by commas, semicolons, or whitespace), keep
        // only the first valid one in `email` and append the rest to
        // `crm_note`. This enforces the prompt rule server-side as a
        // safety net, since the model occasionally violates it.
        let safeEmail = (parsed.email as string) || "";
        const extraEmails: string[] = [];
        safeEmail = splitFirstEmail(safeEmail, extraEmails);

        // Same treatment for "mobile_without_country_code": split on
        // any separator and keep only the first digits-only token.
        // Remainder goes into crm_note as "Additional phone: …".
        let safePhone = phoneRepaired.phone;
        const extraPhones: string[] = [];
        safePhone = splitFirstPhone(safePhone, extraPhones);

        // Defensive re-fill: if the model blanked a contact field that
        // exists in the source CSV (e.g. it dropped "rohit@gmail.com"
        // because the lead was marked Rejected), pull it back from the
        // original row. The prompt now explicitly forbids this, but
        // models still slip up — better to recover than to lose data.
        if (!safeEmail) {
          safeEmail = pickOriginalEmail(originalRow);
        }

        if (!safePhone) {
          safePhone = pickOriginalPhone(originalRow);
        }

        // Merge any extras we salvaged into crm_note.
        const baseNote = (parsed.crm_note as string) || "";
        safeEmail = safeEmail; // already set above
        const mergedNote = appendExtrasToNote(baseNote, extraEmails, extraPhones);

        // Whitelist guard for crm_status — strip anything that isn't in the
        // 4-value enum. Defense in depth against the model smuggling in
        // phrases like "Reviewing quotation".
        const rawStatus = ((parsed.crm_status as string) || "").trim();
        const modelStatus: CrmStatus | "" = ALLOWED_CRM_STATUSES.has(
          rawStatus as CrmStatus
        )
          ? (rawStatus as CrmStatus)
          : "";

        // Status resolution cascade:
        //   1. Trust the model if it returned a valid 4-value status.
        //   2. Otherwise, infer from crm_note (free-text patterns).
        //   3. Otherwise, look up the source CSV's "Lead Status" column
        //      in the synonym map. This catches the common case where
        //      the model returns "" but the source row had a clear
        //      label like "Interested" / "Busy" / "Closed" / "Rejected".
        //   4. Otherwise, "".
        const note = (parsed.crm_note as string) || "";
        const originalLeadStatus = pickOriginalLeadStatus(originalRow);
        const safeStatus: CrmStatus | "" =
          modelStatus ||
          inferStatusFromText(note) ||
          lookupStatusLabel(originalLeadStatus) ||
          "";

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

          email: safeEmail,

          country_code: phoneRepaired.countryCode,

          mobile_without_country_code: safePhone,

          company: parsed.company || "",

          city,

          state,

          country,

          lead_owner: parsed.lead_owner || "",

          crm_status: safeStatus,

          crm_note: mergedNote,

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

