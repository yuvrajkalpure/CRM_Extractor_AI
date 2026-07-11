"use client";

import { useCallback, useState } from "react";
import { useDropzone, FileRejection } from "react-dropzone";
import {
  AlertTriangleIcon,
  FileIcon,
  InboxIcon,
  UploadIcon,
  XIcon,
} from "@/components/AppIcons";

interface DropZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DropZone({ onFileSelect, disabled }: DropZoneProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError("");
      if (rejectedFiles.length > 0) {
        const msg = rejectedFiles[0]?.errors?.[0]?.message;
        setError(msg || "Invalid file. Please upload a CSV file.");
        return;
      }
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile(file);
        onFileSelect(file);
      }
    },
    [onFileSelect],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.ms-excel": [".csv"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10 MB
    disabled,
  });

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    setError("");
  };

  return (
    <div>
      <div
        {...getRootProps()}
        id="csv-dropzone"
        className={`dropzone-wrapper ${isDragActive ? "drag-active" : ""} ${disabled ? "disabled" : ""}`}
        aria-label="CSV file upload area"
      >
        <input
          {...getInputProps()}
          id="csv-file-input"
          aria-label="Upload CSV file"
        />

        <div className="dropzone-icon" aria-hidden="true">
          {isDragActive ? <InboxIcon size={34} /> : <UploadIcon size={34} />}
        </div>

        <h2 className="dropzone-title">
          {isDragActive ? "Drop your CSV here" : "Upload your CSV file"}
        </h2>

        <p className="dropzone-subtitle">
          Works with Facebook Leads, Google Ads, Excel exports, Real Estate
          CRMs, and more
        </p>

        <span className="dropzone-hint">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 1v7M3 5l3 3 3-3M1 10h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Drag & drop or click to browse — CSV files up to 10MB
        </span>
      </div>

      {error && (
        <div
          className="alert alert-error"
          role="alert"
          style={{ marginTop: 12 }}
        >
          <span>
            <AlertTriangleIcon size={16} />
          </span>
          <span>{error}</span>
        </div>
      )}

      {selectedFile && (
        <div className="file-selected" role="status">
          <div className="file-icon" aria-hidden="true">
            <FileIcon size={22} />
          </div>
          <div className="file-info">
            <div className="file-name">{selectedFile.name}</div>
            <div className="file-size">
              {formatBytes(selectedFile.size)} · CSV file ready
            </div>
          </div>
          <button
            id="clear-file-btn"
            className="btn btn-outline btn-sm"
            onClick={handleClearFile}
            aria-label="Remove selected file"
            disabled={disabled}
          >
            <XIcon size={14} /> Remove
          </button>
        </div>
      )}
    </div>
  );
}
