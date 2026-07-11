"use client";

import { useState, type ReactNode } from "react";
import { ImportResult, SkippedRecord, CrmRecord } from "@/lib/api";
import {
  AlertTriangleIcon,
  BadgeCheckIcon,
  CircleIcon,
  FireIcon,
  InboxIcon,
  PhoneOffIcon,
  SparklesIcon,
} from "@/components/AppIcons";

interface ResultTableProps {
  result: ImportResult;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: ReactNode }
> = {
  GOOD_LEAD_FOLLOW_UP: {
    label: "Follow Up",
    className: "good",
    icon: <FireIcon size={14} />,
  },
  DID_NOT_CONNECT: {
    label: "DNC",
    className: "dnc",
    icon: <PhoneOffIcon size={14} />,
  },
  BAD_LEAD: {
    label: "Bad Lead",
    className: "bad",
    icon: <CircleIcon size={14} />,
  },
  SALE_DONE: {
    label: "Sale Done",
    className: "sale",
    icon: <BadgeCheckIcon size={14} />,
  },
};

const CRM_COLUMNS: { key: keyof CrmRecord; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "mobile_without_country_code", label: "Mobile" },
  { key: "country_code", label: "Code" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
  { key: "crm_status", label: "Status" },
  { key: "data_source", label: "Source" },
  { key: "lead_owner", label: "Lead Owner" },
  { key: "crm_note", label: "Notes" },
  { key: "created_at", label: "Created At" },
  { key: "possession_time", label: "Possession" },
  { key: "description", label: "Description" },
];

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function CrmStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return (
      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
        {status || "—"}
      </span>
    );
  }
  return (
    <span className={`cell-badge ${config.className}`}>
      {config.icon} {config.label}
    </span>
  );
}

/** Expandable notes cell — primary note inline, extras collapsible. */
function NoteCell({ value }: { value: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!value) {
    return (
      <span
        style={{
          color: "var(--text-muted)",
          fontStyle: "italic",
          fontSize: 12,
        }}
      >
        —
      </span>
    );
  }

  // Split on literal \n escape sequences OR actual newline chars
  const lines = value
    .split(/\\n|\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const primary = lines[0] || "";
  const extras = lines.slice(1);

  if (extras.length === 0) {
    return (
      <span
        title={value}
        style={{
          maxWidth: 220,
          display: "inline-block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          verticalAlign: "middle",
        }}
      >
        {primary}
      </span>
    );
  }

  return (
    <span
      style={{
        maxWidth: 240,
        display: "inline-block",
        verticalAlign: "middle",
      }}
    >
      <span>{primary}</span>
      {expanded && (
        <span>
          {extras.map((line, i) => (
            <span
              key={i}
              style={{
                display: "block",
                fontSize: 11,
                color: "var(--text-muted)",
                marginTop: i === 0 ? 4 : 2,
                paddingTop: i === 0 ? 4 : 0,
                borderTop:
                  i === 0 ? "1px dashed rgba(255,255,255,0.1)" : "none",
              }}
            >
              {line}
            </span>
          ))}
        </span>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--accent)",
          fontSize: 11,
          padding: "2px 0",
          display: "block",
          marginTop: 2,
        }}
      >
        {expanded ? "▲ less" : `▼ +${extras.length} more`}
      </button>
    </span>
  );
}

function CellContent({ col, value }: { col: keyof CrmRecord; value: string }) {
  if (col === "crm_status") return <CrmStatusBadge status={value} />;
  if (col === "created_at") return <span>{formatDate(value)}</span>;
  if (col === "crm_note") return <NoteCell value={value} />;
  if (!value)
    return (
      <span
        style={{
          color: "var(--text-muted)",
          fontStyle: "italic",
          fontSize: 12,
        }}
      >
        —
      </span>
    );
  return <span title={value}>{value}</span>;
}

function SkippedTable({ records }: { records: SkippedRecord[] }) {
  const skippedColumns = records.length > 0 ? Object.keys(records[0].row) : [];
  return (
    <div className="table-container accordion-content">
      <table className="data-table" aria-label="Skipped records">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Reason</th>
            {skippedColumns.slice(0, 6).map((col) => (
              <th scope="col" key={col}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((rec, i) => (
            <tr key={i}>
              <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {i + 1}
              </td>
              <td>
                <span className="cell-badge bad">{rec.reason}</span>
              </td>
              {skippedColumns.slice(0, 6).map((col) => (
                <td key={col} title={rec.row[col] || ""}>
                  {rec.row[col] || (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ResultTable({ result }: ResultTableProps) {
  const [showSkipped, setShowSkipped] = useState(false);

  const total = result.totalImported + result.totalSkipped;
  const successRate =
    total > 0 ? Math.round((result.totalImported / total) * 100) : 0;

  const imported = result?.imported ?? [];

  // Status breakdown
  const statusCounts = imported.reduce<Record<string, number>>(
    (acc, r) => {
      const key = r.crm_status || "__UNCLASSIFIED__";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div className="animate-fadein">
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-label">Total Records</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card success">
          <div className="stat-label">Imported</div>
          <div className="stat-value">{result.totalImported}</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-label">Skipped</div>
          <div className="stat-value">{result.totalSkipped}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value">{successRate}%</div>
        </div>
      </div>

      {/* Status breakdown pills */}
      {Object.keys(statusCounts).length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            margin: "12px 0",
          }}
        >
          {Object.entries(statusCounts).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status];
            return cfg ? (
              <span
                key={status}
                className={`cell-badge ${cfg.className}`}
                style={{ fontSize: 13 }}
              >
                {cfg.icon} {cfg.label}: <strong>{count}</strong>
              </span>
            ) : (
              <span
                key={status}
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  background: "var(--surface)",
                  borderRadius: 6,
                  padding: "3px 10px",
                }}
              >
                Status not inferred: <strong>{count}</strong>
              </span>
            );
          })}
        </div>
      )}

      {/* Imported Records Table */}
      {imported.length > 0 ? (
        <div>
          <div className="table-meta">
            <span>
              <strong style={{ color: "var(--text-primary)" }}>
                {imported.length}
              </strong>{" "}
              CRM records extracted by AI
            </span>
            <span className="table-meta-tag">
              <SparklesIcon size={12} /> GrowEasy CRM Format
            </span>
          </div>
          <div
            className="table-container"
            role="region"
            aria-label="Imported CRM records"
          >
            <table className="data-table" aria-label="Extracted CRM records">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  {CRM_COLUMNS.map((col) => (
                    <th scope="col" key={col.key}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imported.map((record, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--text-muted)", fontSize: 12 }}>
                      {i + 1}
                    </td>
                    {CRM_COLUMNS.map((col) => (
                      <td key={col.key}>
                        <CellContent col={col.key} value={record[col.key]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">
            <InboxIcon size={28} />
          </div>
          <div className="empty-title">No records imported</div>
          <div className="empty-desc">
            The AI could not extract any valid CRM records from the uploaded
            CSV.
          </div>
        </div>
      )}

      {/* Skipped Records Accordion */}
      {result.totalSkipped > 0 && (
        <div style={{ marginTop: 16 }}>
          <button
            id="toggle-skipped-btn"
            className="accordion-btn"
            onClick={() => setShowSkipped(!showSkipped)}
            aria-expanded={showSkipped}
          >
            <span>
              <AlertTriangleIcon size={14} /> {result.totalSkipped} record
              {result.totalSkipped !== 1 ? "s" : ""} skipped
            </span>
            <span
              style={{
                transition: "transform 0.2s",
                transform: showSkipped ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▼
            </span>
          </button>
          {showSkipped && <SkippedTable records={result.skipped} />}
        </div>
      )}
    </div>
  );
}
