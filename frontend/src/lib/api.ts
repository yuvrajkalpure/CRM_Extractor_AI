import axios, { AxiosProgressEvent } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface CrmRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: string;
  crm_note: string;
  data_source: string;
  possession_time: string;
  description: string;
}

export interface SkippedRecord {
  row: Record<string, string>;
  reason: string;
}

export interface ImportResult {
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
}

export async function importCsv(
  file: File,
  onUploadProgress?: (progress: number) => void
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await axios.post<ImportResult>(`${API_BASE}/api/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e: AxiosProgressEvent) => {
      if (e.total && onUploadProgress) {
        onUploadProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
    timeout: 300_000, // 5 minutes for large files
  });

  console.log("API_URL", API_BASE);
  console.log(response.data);

  return response.data;
}
