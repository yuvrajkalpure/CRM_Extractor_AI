"use client";

import { useMemo } from "react";
import { InboxIcon } from "@/components/AppIcons";

interface PreviewTableProps {
  data: Record<string, string>[];
}

export default function PreviewTable({ data }: PreviewTableProps) {
  const columns = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]);
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">
          <InboxIcon size={28} />
        </div>
        <div className="empty-title">No data to preview</div>
        <div className="empty-desc">The CSV file appears to be empty.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="table-meta">
        <span>
          Showing{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {data.length}
          </strong>{" "}
          rows ·{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {columns.length}
          </strong>{" "}
          columns
        </span>
        <span className="table-meta-tag">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="5" r="5" />
          </svg>
          Raw CSV Preview — No AI processing yet
        </span>
      </div>

      <div
        className="table-container"
        role="region"
        aria-label="CSV data preview"
      >
        <table className="data-table" aria-label="Uploaded CSV contents">
          <thead>
            <tr>
              <th scope="col" style={{ width: 48 }}>
                #
              </th>
              {columns.map((col) => (
                <th scope="col" key={col} title={col}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIdx) => (
              <tr key={rowIdx}>
                <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {rowIdx + 1}
                </td>
                {columns.map((col) => (
                  <td key={col} title={row[col] || ""}>
                    {row[col] || (
                      <span
                        style={{
                          color: "var(--text-muted)",
                          fontStyle: "italic",
                          fontSize: 12,
                        }}
                      >
                        —
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
