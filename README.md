# GrowEasy CRM — Hybrid AI-Powered CSV Importer

An intelligent CSV importer that uses a **Hybrid Rule-Based + AI Fallback** architecture to extract CRM lead data from any CSV format and map it perfectly to the GrowEasy CRM schema.

## Features

- ⚡ **Hybrid Architecture** — Runs 100% accurate, fast rule-based parser for standard field mapping. AI (Gemini / local Ollama) is invoked *only* for ambiguous free-text note status inference.
- 🤖 **AI Provider Choice** — Supports Google Gemini (Gemini 1.5/2.0 Flash) or local Ollama (e.g. `qwen2.5:3b` or `qwen2.5:7b`) for offline deployment.
- 📁 **Drag & Drop Upload** — Intuitive file upload with validation.
- 👁️ **CSV Preview** — View raw data client-side before sending to server.
- 📊 **Flexible Formatting** — Handles multi-phone, multi-email cells, parses and cleans dial codes, enriches states/countries from city, and resolves complex dates.
- 📈 **Active Progress Ticker** — Ticks up incrementally (90% to 99%) during AI status extraction to show activity.
- 🌙 **Dark Mode** — Premium dark UI with glassmorphism.
- ✅ **Type Safe** — TypeScript on both frontend and backend.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Vanilla CSS |
| Backend | Node.js, Express, TypeScript |
| AI | Google Gemini OR Local Ollama |
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
│       │   └── page.tsx       # 4-step import flow (upload, preview, processing, results)
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
        │   ├── geminiClient.ts# AI client (Gemini/Ollama) + retry logic
        │   └── aiExtractor.ts # Hybrid rule + AI status extractor
        └── types/
            └── crm.ts         # TypeScript type definitions
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- Optional: A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- Optional: Local [Ollama](https://ollama.com/) running Qwen 2.5 (`qwen2.5:3b` or `qwen2.5:7b`)

### 1. Backend Setup

```bash
cd backend

# Copy environment file
cp .env.example .env

# Configure your provider in .env
# - For Gemini: set GEMINI_API_KEY=AIzaSy... and AI_PROVIDER=gemini
# - For Ollama: set AI_PROVIDER=ollama and OLLAMA_MODEL=qwen2.5:3b (ensure Ollama is running)

# Install dependencies
npm install

# Start development server
npm run dev
```

The backend runs on **http://localhost:3001**

### 2. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend runs on **http://localhost:3000** (or port 3002 if 3000 is occupied).

### 3. Backend Environment Variables (`backend/.env`)

```env
# "gemini" or "ollama"
AI_PROVIDER=ollama

# Google Gemini settings
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.0-flash

# Local Ollama settings
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:3b

PORT=3001
NODE_ENV=development
```

## How the Hybrid Processing Pipeline Works

```
CSV Row
   │
   ▼
[Rule-Based Extraction]
   ├── Header regex mapping (Company -> Developer/Builder, City -> Area, etc.)
   ├── Phone splitter (+91 9988776655, +91 9876501234 -> mobile, extra to notes)
   ├── Email splitter (arjun@gmail.com, reddy@gmail.com -> email, extra to notes)
   ├── Location enrichment (City: Hyderabad -> State: Telangana, Country: India)
   └── Date parsing (Strict ISO 8601, defaults to now)
   │
   ▼
[Can Status be Determined?]
   ├── Step A: Match lead status field directly against Synonym Map
   └── Step B: Match note keywords against Regex Patterns (e.g. "Looking for villa" -> Follow Up)
   │
   ├── [YES] ──► Keep status, Import directly (AI API bypassed!)
   └── [NO]  ──► [Call AI API Fallback] (Only ambiguous notes sent to Gemini/Ollama)
```

1. **Efficiency**: 100% of rows are extracted instantly via rules (zero processing lag). Only ambiguous records with notes are sent to the AI, saving API costs and preventing failures.
2. **Contact preservation**: Ensures 100% data fidelity on Name, Email, and Phone. No row-mixing, truncation, or omission.
3. **Validation**: Rows missing both email and phone are skipped and logged under the raw row details.

## License

MIT
