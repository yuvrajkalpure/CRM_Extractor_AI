import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parseCsvBuffer } from '../services/csvParser';
import { extractCrmRecords } from '../services/aiExtractor';

const router = Router();

// Store in memory — no disk writes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

/**
 * POST /api/import
 * Accepts a CSV file, parses it, runs AI extraction, returns CRM records.
 */
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Send a CSV as multipart/form-data field "file".' });
    }

    // 1. Parse CSV
    let rawRecords: Record<string, string>[];
    try {
      rawRecords = parseCsvBuffer(req.file.buffer);
    } catch (parseErr) {
      return res.status(422).json({
        error: 'Failed to parse CSV file. Please ensure it is a valid CSV.',
        detail: (parseErr as Error).message,
      });
    }

    if (rawRecords.length === 0) {
      return res.status(422).json({ error: 'CSV file is empty or has no data rows.' });
    }

    console.log(`[Import] Received ${rawRecords.length} records from "${req.file.originalname}"`);

    // 2. AI Extraction
    const result = await extractCrmRecords(rawRecords);

    console.log(`[Import] Done: ${result.totalImported} imported, ${result.totalSkipped} skipped`);
    console.log(result);

    return res.status(200).json(result);
  } catch (err) {
    console.error("========== FULL ERROR ==========");
    console.error(err);
    console.error("================================");

    return res.status(500).json({
      error: (err as Error).message,
    });
  }
});

export default router;
