# GrowEasy CRM — AI-Powered CSV Importer

An intelligent CSV importer that uses **Google Gemini AI** to extract CRM lead data from any CSV format and map it to the GrowEasy CRM schema.

## Features

- 🤖 **AI Field Mapping** — Works with any CSV column names (Facebook, Google Ads, Excel, Real Estate CRMs, etc.)
- 📁 **Drag & Drop Upload** — Intuitive file upload with validation
- 👁️ **CSV Preview** — See raw data before sending to AI
- 📊 **Batch Processing** — Records processed in batches of 10 with retry logic
- 📈 **Progress Indicators** — Real-time progress during AI processing
- 🌙 **Dark Mode** — Premium dark UI with glassmorphism
- 📱 **Responsive** — Works on mobile, tablet, and desktop
- ✅ **Type Safe** — Full TypeScript on both frontend and backend

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Vanilla CSS |
| Backend | Node.js, Express, TypeScript |
| AI | Google Gemini 2.0 Flash |
| CSV Parsing | PapaParse (frontend), csv-parse (backend) |
| File Upload | react-dropzone, multer |

## Project Structure

```
CRM_Extractor_AI/
├── frontend/                  # Next.js 14 App Router
│   └── src/
│       ├── app/
│       │   ├── globals.css    # Full design system
│       │   ├── layout.tsx     # Root layout + SEO
│       │   └── page.tsx       # 4-step import flow
│       ├── components/
│       │   ├── DropZone.tsx   # Drag & drop upload
│       │   ├── StepIndicator.tsx
│       │   ├── PreviewTable.tsx
│       │   └── ResultTable.tsx
│       └── lib/
│           └── api.ts         # Backend API client
│
└── backend/                   # Node.js + Express
    └── src/
        ├── index.ts           # Server entry point
        ├── routes/
        │   └── import.ts      # POST /api/import
        ├── services/
        │   ├── csvParser.ts   # CSV parsing utility
        │   ├── geminiClient.ts# Gemini AI client + retry
        │   └── aiExtractor.ts # Batch AI extraction
        └── types/
            └── crm.ts         # TypeScript type definitions
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- A [Google Gemini API key](https://aistudio.google.com/app/apikey) (free tier available)

### 1. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Add your Gemini API key to .env
# GEMINI_API_KEY=your_actual_api_key_here

# Install dependencies (already done)
npm install

# Start development server
npm run dev
```

The backend runs on **http://localhost:3001**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (already done)
npm install

# Start development server
npm run dev
```

The frontend runs on **http://localhost:3000**

### 3. Environment Variables

**Backend (`backend/.env`):**

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
NODE_ENV=development
```

**Frontend** — no env vars needed for local development. For production, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

## API Reference

### `POST /api/import`

Accepts a multipart CSV file upload and returns extracted CRM records.

**Request:** `multipart/form-data` with field `file` (CSV file, max 10MB)

**Response:**
```json
{
  "imported": [
    {
      "created_at": "2026-05-13 14:20:48",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "country_code": "+91",
      "mobile_without_country_code": "9876543210",
      "company": "GrowEasy",
      "city": "Mumbai",
      "state": "Maharashtra",
      "country": "India",
      "lead_owner": "test@gmail.com",
      "crm_status": "GOOD_LEAD_FOLLOW_UP",
      "crm_note": "",
      "data_source": "",
      "possession_time": "",
      "description": ""
    }
  ],
  "skipped": [
    {
      "row": { "Name": "Unknown Person", "Source": "Manual" },
      "reason": "No email or mobile number found"
    }
  ],
  "totalImported": 1,
  "totalSkipped": 1
}
```

### `GET /health`

Health check endpoint.

## CRM Fields

| Field | Description |
|-------|-------------|
| `created_at` | Lead creation date |
| `name` | Lead full name |
| `email` | Primary email |
| `country_code` | Country dialing code (e.g. +91) |
| `mobile_without_country_code` | Mobile number |
| `company` | Company name |
| `city` | City |
| `state` | State |
| `country` | Country |
| `lead_owner` | Lead owner name/email |
| `crm_status` | `GOOD_LEAD_FOLLOW_UP` \| `DID_NOT_CONNECT` \| `BAD_LEAD` \| `SALE_DONE` |
| `crm_note` | Notes, extra emails/phones |
| `data_source` | `leads_on_demand` \| `meridian_tower` \| `eden_park` \| `varah_swamy` \| `sarjapur_plots` |
| `possession_time` | Property possession time |
| `description` | Additional description |

## CSV Compatibility

The AI handles:
- Any column naming convention
- Multiple emails or phone numbers (extras go to `crm_note`)
- Any date format
- Mixed status values mapped to allowed enums
- Records with no email/mobile are automatically skipped

## Performance

- **Batch Size:** 10 records per AI call
- **Retry Logic:** 3 attempts with exponential backoff
- **File Limit:** 10MB max CSV
- **Timeout:** 5 minutes for large files

## License

MIT
