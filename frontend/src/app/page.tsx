"use client";

import { useState, useCallback } from "react";
import Papa from "papaparse";
import StepIndicator from "@/components/StepIndicator";
import DropZone from "@/components/DropZone";
import PreviewTable from "@/components/PreviewTable";
import ResultTable from "@/components/ResultTable";
import { importCsv, ImportResult } from "@/lib/api";
import {
  AlertTriangleIcon,
  CheckIcon,
  InfoIcon,
  LoaderIcon,
  RobotIcon,
  SparklesIcon,
} from "@/components/AppIcons";

type Step = 1 | 2 | 3 | 4;

interface ProcessingState {
  uploadProgress: number;
  message: string;
}

export default function Home() {
  const [step, setStep] = useState<Step>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({
    uploadProgress: 0,
    message: "",
  });
  const [error, setError] = useState<string>("");

  // ── Step 1 → 2: File selected, parse CSV client-side ──────────────────────
  const handleFileSelect = useCallback((file: File) => {
    setCsvFile(file);
    setError("");

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0 && res.data.length === 0) {
          setError("Failed to parse CSV. Please check the file format.");
          return;
        }
        setPreviewData(res.data);
        setStep(2);
      },
      error: (err) => {
        setError(`CSV parse error: ${err.message}`);
      },
    });
  }, []);

  // ── Step 3: Confirm → call backend API ────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!csvFile) return;

    setStep(3);
    setError("");
    setProcessing({ uploadProgress: 0, message: "Uploading CSV to server..." });

    try {
      const importResult = await importCsv(csvFile, (pct) => {
        if (pct < 100) {
          setProcessing({
            uploadProgress: pct,
            message: `Uploading... ${pct}%`,
          });
        } else {
          setProcessing({
            uploadProgress: 100,
            message: "AI is extracting CRM fields...",
          });
        }
      });

      setResult(importResult);
      setStep(4);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } }; message?: string })
          ?.response?.data?.error ||
        (err as { message?: string })?.message ||
        "An unexpected error occurred. Please try again.";
      setError(message);
      setStep(2); // Go back to preview on error
    }
  }, [csvFile]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setStep(1);
    setCsvFile(null);
    setPreviewData([]);
    setResult(null);
    setError("");
    setProcessing({ uploadProgress: 0, message: "" });
  }, []);

  // ── Elapsed time ticker for loading state ─────────────────────────────────
  const estimatedBatches = Math.ceil(previewData.length / 10);

  return (
    <div className="page-wrapper">
      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-inner">
            <div className="header-logo" aria-hidden="true">
              <RobotIcon size={22} />
            </div>
            <span className="header-title">GrowEasy CRM Importer</span>
            <span className="header-subtitle" aria-live="polite">
              AI-Powered · Any CSV Format
            </span>
          </div>
        </div>
      </header>

      <main className="container" style={{ paddingTop: 0, paddingBottom: 60 }}>
        {/* Hero */}
        <section className="hero" aria-labelledby="hero-heading">
          <div className="hero-badge" role="status">
            <span className="hero-badge-dot" aria-hidden="true" />
            Powered by Gemini AI
          </div>
          <h1 id="hero-heading">
            Import Any CSV into
            <br />
            <span className="gradient-text">GrowEasy CRM</span>
          </h1>
          <p className="hero-desc">
            Upload leads from Facebook, Google Ads, Excel, or any custom
            spreadsheet. Our AI intelligently maps every column to the right CRM
            field.
          </p>
        </section>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Error Banner */}
        {error && (
          <div
            className="alert alert-error"
            role="alert"
            style={{ marginBottom: 24 }}
          >
            <span aria-hidden="true">
              <AlertTriangleIcon size={16} />
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Upload ───────────────────────────────────────────────── */}
        {step === 1 && (
          <section className="animate-slidein" aria-labelledby="step1-title">
            <div className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title" id="step1-title">
                    Upload your CSV file
                  </h2>
                  <p className="section-desc">
                    Supports any CSV format — column names don&apos;t matter
                  </p>
                </div>
              </div>
              <DropZone onFileSelect={handleFileSelect} />
            </div>
          </section>
        )}

        {/* ── Step 2: Preview ──────────────────────────────────────────────── */}
        {step === 2 && (
          <section className="animate-slidein" aria-labelledby="step2-title">
            <div className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title" id="step2-title">
                    Preview — {csvFile?.name}
                  </h2>
                  <p className="section-desc">
                    {previewData.length} rows detected · Ready for AI extraction
                  </p>
                </div>
                <div className="btn-group">
                  <button
                    id="back-to-upload-btn"
                    className="btn btn-outline"
                    onClick={handleReset}
                    aria-label="Go back and upload a different file"
                  >
                    ← Upload Different File
                  </button>
                  <button
                    id="confirm-import-btn"
                    className="btn btn-success btn-lg"
                    onClick={handleConfirm}
                    disabled={previewData.length === 0}
                    aria-label={`Confirm import of ${previewData.length} records`}
                  >
                    <span aria-hidden="true">
                      <SparklesIcon size={16} />
                    </span>
                    Confirm Import ({previewData.length} rows)
                  </button>
                </div>
              </div>

              <div
                className="alert alert-info"
                role="note"
                style={{ marginBottom: 20 }}
              >
                <span aria-hidden="true">
                  <InfoIcon size={16} />
                </span>
                <span>
                  Reviewing raw CSV data below. Click{" "}
                  <strong>Confirm Import</strong> to start AI extraction. AI
                  processing takes ~{estimatedBatches * 3}–
                  {estimatedBatches * 6} seconds.
                </span>
              </div>

              <PreviewTable data={previewData} />
            </div>
          </section>
        )}

        {/* ── Step 3: Processing ───────────────────────────────────────────── */}
        {step === 3 && (
          <section
            className="animate-slidein"
            aria-labelledby="step3-title"
            aria-live="polite"
          >
            <div className="card">
              <div className="loading-center">
                <div
                  className="spinner spinner-lg"
                  role="status"
                  aria-label="Processing"
                />
                <div>
                  <h2 className="loading-title" id="step3-title">
                    AI is Processing Your Data
                  </h2>
                  <p className="loading-sub">
                    Gemini is intelligently mapping your CSV columns to GrowEasy
                    CRM fields. Processing in batches of 10 records.
                  </p>
                </div>

                <div
                  className="progress-wrapper"
                  style={{ width: "100%", maxWidth: 480 }}
                >
                  <div className="progress-header">
                    <span className="progress-label" aria-live="polite">
                      {processing.message}
                    </span>
                    <span className="progress-pct">
                      {processing.uploadProgress}%
                    </span>
                  </div>
                  <div
                    className="progress-bar"
                    role="progressbar"
                    aria-valuenow={processing.uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.max(processing.uploadProgress, 5)}%`,
                      }}
                    />
                  </div>
                  <div className="progress-steps">
                    <span className={`progress-step-pill done`}>
                      <CheckIcon size={14} /> CSV Uploaded
                    </span>
                    <span
                      className={`progress-step-pill ${processing.uploadProgress >= 100 ? "done" : ""}`}
                    >
                      {processing.uploadProgress >= 100 ? (
                        <CheckIcon size={14} />
                      ) : (
                        <LoaderIcon size={14} />
                      )}{" "}
                      AI Extraction
                    </span>
                    <span className="progress-step-pill">○ Results Ready</span>
                  </div>
                </div>

                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {previewData.length} records · ~{estimatedBatches} batch
                  {estimatedBatches !== 1 ? "es" : ""}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ── Step 4: Results ──────────────────────────────────────────────── */}
        {step === 4 && result && (
          <section className="animate-slidein" aria-labelledby="step4-title">
            <div className="card">
              <div className="section-header">
                <div>
                  <h2 className="section-title" id="step4-title">
                    Import Complete
                  </h2>
                  <p className="section-desc">
                    AI successfully extracted CRM data from{" "}
                    <strong>{csvFile?.name}</strong>
                  </p>
                </div>
                <div className="btn-group">
                  <button
                    id="import-another-btn"
                    className="btn btn-primary"
                    onClick={handleReset}
                    aria-label="Start a new import"
                  >
                    ← Import Another File
                  </button>
                </div>
              </div>

              <ResultTable result={result} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
