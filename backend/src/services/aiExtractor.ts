import { generateContent } from "./geminiClient";
import {
  CrmRecord,
  CrmStatus,
  ImportResult,
  SkippedRecord,
  DataSource,
} from "../types/crm";

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Configuration
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_BATCH_SIZE = 10;

const ALLOWED_CRM_STATUSES: ReadonlySet<CrmStatus> = new Set<CrmStatus>([
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
]);

const ALLOWED_SOURCES: ReadonlySet<string> = new Set<string>([
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Status Mapping Patterns & Synonyms
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_PATTERNS: Array<{ status: CrmStatus; re: RegExp }> = [
  // SALE_DONE — explicit close signals
  {
    status: "SALE_DONE",
    re: /\b(sale\s+completed|booking\s+confirmed|payment\s+completed|deal\s+closed|onboarding\s+started|closed[- ]?won|token\s+(?:paid|given)|agreement\s+signed|purchased|bought|closed\s+deal)\b/i,
  },

  // BAD_LEAD — explicit rejection or disqualification
  {
    status: "BAD_LEAD",
    re: /\b(rejected|wrong\s+(?:person|number)|not\s+interested|\bspam\b|no\s+requirement|not\s+looking|not\s+in\s+(?:the\s+)?market|not\s+relevant|invalid\s+(?:lead|number|contact)|budget\s+(?:too\s+low|issue)|not\s+eligible|do\s+not\s+disturb|\bdnd\b|out\s+of\s+(?:scope|region|city|country)|wrong\s+lead|duplicate\s+lead|test\s+lead)\b/i,
  },

  // GOOD_LEAD_FOLLOW_UP — follow ups, callbacks, interests, real estate buying intent
  {
    status: "GOOD_LEAD_FOLLOW_UP",
    re: /\b(call\s+next|call\s+later|call\s+tomorrow|call\s+back|call\s+(?:at|after|before|in)\s+\d|next\s+week|next\s+month|follow[\s-]?up|interested|ready\s+to\s+(?:purchase|buy|move)|proposal|quotation|\breview\b|approval|approv|\bdemo\b|discuss(?:ing|ion)?\s+with|reviewing\s+quotation|requested?\s+(?:proposal|document|demo|quote|info|detail)|review\s+internally|waiting\s+for\s+(?:approval|sign|review|management|decision|confirm|internal)|asked\s+to\s+call|will\s+call\s+back|will\s+get\s+back|will\s+reach\s+out|will\s+(?:review|check|discuss|respond|decide|get\s+back)|schedule(?:d)?\s+(?:a\s+)?call|book(?:ed)?\s+(?:a\s+)?call|meeting\s+(?:set|scheduled)|site\s+visit|hot\s+lead|warm\s+lead|positive\s+response|enquiry|enquired|inquir(?:y|ed)|looking\s+for|looking\s+to\s+(?:buy|purchase|invest|rent)|wants?\s+(?:a\s+)?(?:villa|apartment|flat|plot|house|home|property|\d\s*bhk|2\s*bhk|3\s*bhk|4\s*bhk|1\s*bhk)|need(?:s)?\s+(?:a\s+)?(?:villa|apartment|flat|plot|house|home|property|\d\s*bhk)|searching\s+for|\bvilla\b|\bapartment\b|\bflat\b|\bplot\b|\d\s*bhk|2\s*bhk|3\s*bhk|4\s*bhk|1\s*bhk|possession|ready\s+to\s+move|investment\s+purpose|end\s+use|self\s+use|budget\s+(?:is|around|of)|booking\s+amount|token\s+amount|emi\s+(?:option|plan)|in\s+discussion|considering|thinks?\s+about|need(?:s)?\s+time\s+to)\b/i,
  },

  // DID_NOT_CONNECT — failed contact, busy, no answer, travelling
  {
    status: "DID_NOT_CONNECT",
    re: /\b(\bbusy\b|\bno\s+answer\b|didn'?t\s+connect|did\s+not\s+connect|call\s+not\s+connected|not\s+reachable|unreachable|switched\s+off|phone\s+off|line\s+busy|ringing\s+no\s+reply|phone\s+switched\s+off|number\s+(?:does\s+not\s+exist|invalid|not\s+in\s+service)|voicemail|phone\s+dead|postponed?|travel+ing|out\s+of\s+(?:town|office|station|country|city)|on\s+(?:leave|vacation|holiday|tour)|decision\s+maker\s+(?:is\s+)?(?:travel+ing|away|unavailable|not\s+available)|not\s+in\s+office|not\s+available\s+(?:right\s+now|at\s+the\s+moment|today|this\s+week)|will\s+be\s+(?:back|available)\s+(?:after|next|in)|reschedul)\b/i,
  },
];

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

function inferStatusFromText(text: string): CrmStatus | "" {
  if (!text) return "";
  for (const { status, re } of STATUS_PATTERNS) {
    if (re.test(text)) return status;
  }
  return "";
}

function lookupStatusLabel(label: string): CrmStatus | "" {
  if (!label) return "";
  const k = label.trim().toLowerCase();
  if (!k) return "";
  if (ALLOWED_CRM_STATUSES.has(label as CrmStatus)) return label as CrmStatus;
  return STATUS_SYNONYMS[k] || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Header Mapping
// ─────────────────────────────────────────────────────────────────────────────

const HEADER_MAP: Array<{ keys: RegExp; field: keyof CrmRecord }> = [
  // Name variants
  { keys: /^name$|fullname|clientname|^customer$|customername|leadname|contactperson|contactname/i, field: 'name' },
  // Email variants
  { keys: /^emails?$|emailaddress(es)?|primaryemail|personalemail|workemail|officialemail|contactemail/i, field: 'email' },
  // Phone variants
  { keys: /phone|mobile|telephone|^tel$|contactnumber|phonenumber|contactnumbers|mobilenumber/i, field: 'mobile_without_country_code' },
  { keys: /countrycode/i, field: 'country_code' },
  // Company variants
  { keys: /company|organization|^org$|firm|builder|developer|project|companyname/i, field: 'company' },
  // Location variants
  { keys: /^city$|^area$|locality|^location$/i, field: 'city' },
  { keys: /^state$|statename|province|region/i, field: 'state' },
  { keys: /^country$|countryname/i, field: 'country' },
  // Lead Owner variants
  { keys: /leadowner|^owner$|assignedto|salesexecutive|salesexec|salesagent|^agent$/i, field: 'lead_owner' },
  { keys: /status|leadstatus|lead_status|stage|pipeline/i, field: 'crm_status' },
  // Notes variants
  { keys: /comment|remark|note|message|followup|follow.up|comments|remarks|notes/i, field: 'crm_note' },
  { keys: /source|datasource|leadsource/i, field: 'data_source' },
  // Date variants
  { keys: /createdon|created|^date$|createdat|datetime|timestamp|leaddate|dateadded|date_added/i, field: 'created_at' },
  // Possession
  { keys: /possession|handover|delivery/i, field: 'possession_time' },
  // Description
  { keys: /description|details|about/i, field: 'description' },
];

function preNormalizeRecord(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const norm = key.toLowerCase().replace(/[\s_\-./]+/g, '').trim();
    let mapped = false;
    for (const { keys, field } of HEADER_MAP) {
      if (keys.test(norm)) {
        if (out[field] === undefined) {
          out[field] = (value ?? '').toString().trim();
        }
        mapped = true;
        break;
      }
    }
    if (!mapped) {
      out[key] = (value ?? '').toString().trim();
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Cleaning & Helpers
// ─────────────────────────────────────────────────────────────────────────────

function pickOriginalEmail(row: Record<string, string> | undefined): string {
  if (!row) return "";
  const keys = ["email", "emails", "emailaddress", "primaryemail", "mail"];
  for (const k of keys) {
    for (const rowKey of Object.keys(row)) {
      if (rowKey.toLowerCase().replace(/[\s_\-./]+/g, '').trim() === k) {
        const v = (row[rowKey] || "").trim();
        if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return v;
      }
    }
  }
  for (const v of Object.values(row)) {
    const s = (v || "").trim();
    if (s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return s;
  }
  return "";
}

function pickOriginalPhone(row: Record<string, string> | undefined): string {
  if (!row) return "";
  const keys = ["mobile", "phone", "contact", "telephone", "tel", "whatsapp"];
  for (const k of keys) {
    for (const rowKey of Object.keys(row)) {
      const norm = rowKey.toLowerCase().replace(/[\s_\-./]+/g, '').trim();
      if (norm.includes(k)) {
        const v = (row[rowKey] || "").trim();
        const digits = v.replace(/\D/g, "");
        if (digits && digits.length >= 7) return v;
      }
    }
  }
  for (const v of Object.values(row)) {
    const s = (v || "").trim();
    const digits = s.replace(/\D/g, "");
    if (digits && digits.length >= 7 && /^\+?[\d\s\-.]+$/.test(s)) return s;
  }
  return "";
}

function splitPhone(
  countryCode: string | undefined,
  mobile: string | undefined
): { country_code: string; mobile_without_country_code: string } {
  const raw = (mobile || '').toString().trim();
  const ccRaw = (countryCode || '').toString().trim();

  // If starts with +, match prefix
  const plusMatch = raw.match(/^(\+\d{1,4})[\s\-.]?(\d{6,15})$/);
  if (plusMatch) return { country_code: plusMatch[1], mobile_without_country_code: plusMatch[2] };

  const plusDirty = raw.match(/^(\+\d{1,4})[\s\-.](\d[\d\s\-.]+)$/);
  if (plusDirty) {
    const digits = plusDirty[2].replace(/[\s\-.]/g, '');
    if (digits.length >= 6) return { country_code: plusDirty[1], mobile_without_country_code: digits };
  }

  // Known country codes without + prefix
  const noPlusMatch = raw.match(/^(91|1|44|971|65|60|62|63|66|86|81|82)[\s\-.]?(\d{6,15})$/);
  if (noPlusMatch) {
    return {
      country_code: `+${noPlusMatch[1]}`,
      mobile_without_country_code: noPlusMatch[2].replace(/[\s\-.]/g, ''),
    };
  }

  // Separate country_code field provided
  if (ccRaw) {
    const ccDigits = ccRaw.replace(/^\+/, '');
    const stripped = raw.replace(/^\+/, '');
    if (stripped.startsWith(ccDigits)) {
      return {
        country_code: ccRaw.startsWith('+') ? ccRaw : `+${ccDigits}`,
        mobile_without_country_code: stripped.slice(ccDigits.length).replace(/^[\s\-.]+/, '').replace(/[\s\-.]/g, ''),
      };
    }
  }

  const cleanPhone = raw.replace(/^\+/, '').replace(/\D/g, '');
  const cleanCC = ccRaw ? (ccRaw.startsWith('+') ? ccRaw : `+${ccRaw.replace(/\D/g, '')}`) : '';
  return { country_code: cleanCC, mobile_without_country_code: cleanPhone };
}

const CITY_LOOKUP: Record<string, { state: string; country: string }> = {
  hyderabad:  { state: 'Telangana',      country: 'India' },
  chennai:    { state: 'Tamil Nadu',     country: 'India' },
  kolkata:    { state: 'West Bengal',    country: 'India' },
  jaipur:     { state: 'Rajasthan',     country: 'India' },
  mumbai:     { state: 'Maharashtra',   country: 'India' },
  pune:       { state: 'Maharashtra',   country: 'India' },
  bangalore:  { state: 'Karnataka',     country: 'India' },
  bengaluru:  { state: 'Karnataka',     country: 'India' },
  delhi:      { state: 'Delhi',         country: 'India' },
  newdelhi:   { state: 'Delhi',         country: 'India' },
  noida:      { state: 'Uttar Pradesh', country: 'India' },
  gurgaon:    { state: 'Haryana',       country: 'India' },
  gurugram:   { state: 'Haryana',       country: 'India' },
  ahmedabad:  { state: 'Gujarat',       country: 'India' },
  lucknow:    { state: 'Uttar Pradesh', country: 'India' },
  surat:      { state: 'Gujarat',       country: 'India' },
  nagpur:     { state: 'Maharashtra',   country: 'India' },
  indore:     { state: 'Madhya Pradesh', country: 'India' },
  bhopal:     { state: 'Madhya Pradesh', country: 'India' },
  chandigarh: { state: 'Punjab',        country: 'India' },
  kochi:      { state: 'Kerala',        country: 'India' },
  thiruvananthapuram: { state: 'Kerala', country: 'India' },
  coimbatore: { state: 'Tamil Nadu',    country: 'India' },
  vizag:      { state: 'Andhra Pradesh', country: 'India' },
  visakhapatnam: { state: 'Andhra Pradesh', country: 'India' },
};

function enrichLocation(
  city: string | undefined,
  state: string | undefined,
  country: string | undefined
): { city: string; state: string; country: string } {
  const c = (city || '').trim();
  const s = (state || '').trim();
  const co = (country || '').trim();
  if (s && co) return { city: c, state: s, country: co };
  const known = CITY_LOOKUP[c.toLowerCase().replace(/\s+/g, '')];
  if (known) return { city: c, state: s || known.state, country: co || known.country };
  return { city: c, state: s, country: co };
}

function normalizeCreatedAt(v: any): string {
  if (!v) return new Date().toISOString();
  const s = String(v).trim();
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function splitFirstEmail(raw: string, extras: string[]): string {
  if (!raw) return '';
  const parts = raw.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  const valid = parts.filter((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p));
  if (valid.length === 0) return raw.trim();
  extras.push(...valid.slice(1));
  return valid[0];
}

function splitFirstPhone(raw: string, extras: string[]): string {
  if (!raw) return '';
  const parts = raw.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return '';
  extras.push(...parts.slice(1));
  return parts[0];
}

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

// ─────────────────────────────────────────────────────────────────────────────
// AI Status Inference Fallback
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_INFERENCE_PROMPT = `Classify each lead note into exactly one CRM status.

Allowed values ONLY:
- GOOD_LEAD_FOLLOW_UP  (interested, wants demo, follow up needed, callback requested, warm/hot, looking to buy)
- DID_NOT_CONNECT      (busy, call later, no answer, not reachable, switched off, voicemail, travelling)
- BAD_LEAD             (not interested, wrong number, spam, duplicate, rejected, not relevant)
- SALE_DONE            (deal closed, purchased, payment received, booked, onboarding, converted)

Return ONLY a JSON array of strings, one per note, in the same order.
Use "" (empty string) if the note gives no clear status signal.
No markdown. No explanation. Example: ["GOOD_LEAD_FOLLOW_UP","BAD_LEAD",""]`;

async function inferStatusWithAI(notes: string[]): Promise<(CrmStatus | '')[]> {
  if (notes.length === 0) return [];

  const prompt = `${STATUS_INFERENCE_PROMPT}\n\nNotes:\n${notes.map((n, i) => `[${i}] "${n}"`).join('\n')}\n\nJSON array:`;

  try {
    const raw = await generateContent(prompt);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error('Not an array');

    return parsed.map((v: unknown) => {
      const s = (typeof v === 'string' ? v : '').trim();
      return (ALLOWED_CRM_STATUSES as Set<string>).has(s) ? (s as CrmStatus) : lookupStatusLabel(s);
    });
  } catch (err) {
    console.warn('[AI Status Inference] Fallback to regex due to error:', (err as Error).message);
    return notes.map(inferStatusFromText);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Rule-Based Record Extractor
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedRecord {
  crmRecord: CrmRecord;
  needsAiStatus: boolean;
  originalRow: Record<string, string>;
}

function extractRecordRules(row: Record<string, string>): ExtractedRecord {
  const norm = preNormalizeRecord(row);

  // Email processing & fallbacks
  let rawEmail = norm['email'] || pickOriginalEmail(row);
  const extraEmails: string[] = [];
  rawEmail = splitFirstEmail(rawEmail, extraEmails);

  // Phone processing & fallbacks
  let rawPhone = norm['mobile_without_country_code'] || pickOriginalPhone(row);
  const extraPhones: string[] = [];
  rawPhone = splitFirstPhone(rawPhone, extraPhones);

  const phoneDetails = splitPhone(norm['country_code'], rawPhone);

  // Location enrichment
  const location = enrichLocation(norm['city'], norm['state'], norm['country']);

  // Date parsing
  const createdAt = normalizeCreatedAt(norm['created_at']);

  // Status mapping
  const sourceStatusLabel = norm['crm_status'] || '';
  const initialStatus = lookupStatusLabel(sourceStatusLabel) || inferStatusFromText(norm['crm_note'] || '');

  // Note merging
  const note = appendExtrasToNote(norm['crm_note'] || '', extraEmails, extraPhones);

  // Whitelist data source
  const sourceRaw = (norm['data_source'] || '').trim();
  const data_source: DataSource = ALLOWED_SOURCES.has(sourceRaw) ? (sourceRaw as DataSource) : "";

  const crmRecord: CrmRecord = {
    created_at: createdAt,
    name: norm['name'] || '',
    email: rawEmail,
    country_code: phoneDetails.country_code,
    mobile_without_country_code: phoneDetails.mobile_without_country_code,
    company: norm['company'] || '',
    city: location.city,
    state: location.state,
    country: location.country,
    lead_owner: norm['lead_owner'] || '',
    crm_status: initialStatus,
    crm_note: note,
    data_source,
    possession_time: norm['possession_time'] || '',
    description: norm['description'] || '',
  };

  const needsAiStatus = !initialStatus && !!(norm['crm_note'] || '').trim();

  return {
    crmRecord,
    needsAiStatus,
    originalRow: row,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function extractCrmRecords(
  rawRecords: Record<string, string>[]
): Promise<ImportResult> {
  const imported: CrmRecord[] = [];
  const skipped: SkippedRecord[] = [];

  console.log(`[AI Extractor] Rule-based extraction starting for ${rawRecords.length} records...`);

  // Step 1: Run rule-based extraction on all records
  const extractedList = rawRecords.map(extractRecordRules);

  // Step 2: Identify any records that need AI status fallback
  const aiFallbackJobs: { index: number; note: string }[] = [];
  extractedList.forEach((item, index) => {
    // Basic skip validation before processing status
    const rec = item.crmRecord;
    if (!rec.email && !rec.mobile_without_country_code) {
      return; // Handled in skip routing below
    }
    if (item.needsAiStatus) {
      aiFallbackJobs.push({ index, note: item.crmRecord.crm_note });
    }
  });

  // Step 3: Run AI inference on notes that need it
  if (aiFallbackJobs.length > 0) {
    console.log(`[AI Extractor] Calling AI API to resolve status for ${aiFallbackJobs.length} records...`);
    const notesToQuery = aiFallbackJobs.map((j) => j.note);
    const statuses = await inferStatusWithAI(notesToQuery);

    aiFallbackJobs.forEach((job, i) => {
      const resolvedStatus = statuses[i];
      if (resolvedStatus) {
        extractedList[job.index].crmRecord.crm_status = resolvedStatus;
        console.log(`  [Record #${job.index + 1}] Resolved status via AI: "${job.note}" → ${resolvedStatus}`);
      } else {
        console.log(`  [Record #${job.index + 1}] AI status classification returned empty for note: "${job.note}"`);
      }
    });
  } else {
    console.log(`[AI Extractor] All statuses resolved via rules/synonyms — AI API calls skipped completely!`);
  }

  // Step 4: Validate and populate final output collections
  extractedList.forEach((item, index) => {
    const rec = item.crmRecord;
    if (!rec.email && !rec.mobile_without_country_code) {
      skipped.push({
        row: item.originalRow,
        reason: "Missing email/mobile",
      });
      console.log(`  [Record #${index + 1}] Skipped: No email or mobile number`);
    } else {
      imported.push(rec);
    }
  });

  return {
    imported,
    skipped,
    totalImported: imported.length,
    totalSkipped: skipped.length,
  };
}
