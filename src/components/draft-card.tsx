"use client";

import { useState } from "react";

interface DraftCardProps {
  draft: {
    id: string;
    scan_score: number | null;
    scan_grade: string | null;
    pdf_url: string | null;
    pdf_filename: string | null;
    email_to: string | null;
    email_subject: string | null;
    email_body: string | null;
    status: string;
    error_message: string | null;
    created_at: string;
    prospects: {
      target: string;
      contact_name: string | null;
      contact_email: string | null;
    } | null;
    campaigns: {
      name: string;
      brand_company: string;
    } | null;
  };
}

export function DraftCard({ draft }: DraftCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const gradeColor =
    draft.scan_grade === "A" || draft.scan_grade === "B"
      ? "text-green-400"
      : draft.scan_grade === "C"
        ? "text-yellow-400"
        : "text-red-400";

  if (draft.status === "error") {
    return (
      <div className="bg-gray-900 rounded-xl border border-red-900/50 p-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-900/30 flex items-center justify-center">
            <span className="text-red-400 text-sm">!</span>
          </div>
          <div>
            <p className="text-white font-medium">{draft.prospects?.target ?? "Unknown"}</p>
            <p className="text-red-400 text-xs">{draft.error_message ?? "Scan failed"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          {/* Score badge */}
          <div className="w-12 h-12 rounded-lg bg-gray-800 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold ${gradeColor}`}>
              {draft.scan_grade ?? "?"}
            </span>
            <span className="text-[10px] text-gray-500">{draft.scan_score ?? 0}</span>
          </div>

          <div className="text-left">
            <p className="text-white font-medium">{draft.prospects?.target ?? "Unknown"}</p>
            <p className="text-gray-500 text-xs">
              {draft.campaigns?.name ?? ""} &middot;{" "}
              {new Date(draft.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {draft.pdf_url && (
            <a
              href={draft.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="px-3 py-1.5 text-xs font-medium text-indigo-400 bg-indigo-400/10 rounded-md hover:bg-indigo-400/20 transition-colors"
            >
              View PDF
            </a>
          )}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content — email copy-paste */}
      {expanded && (
        <div className="border-t border-gray-800 p-5 space-y-4">
          {/* Subject line */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Subject
              </label>
              <button
                onClick={() => copyToClipboard(draft.email_subject ?? "", "subject")}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                {copiedField === "subject" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-sm text-white font-medium">
              {draft.email_subject}
            </div>
          </div>

          {/* Email body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Email Body
              </label>
              <button
                onClick={() => copyToClipboard(draft.email_body ?? "", "body")}
                className="text-xs text-indigo-400 hover:text-indigo-300"
              >
                {copiedField === "body" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300 whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
              {draft.email_body}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => {
                const full = `Subject: ${draft.email_subject}\n\n${draft.email_body}`;
                copyToClipboard(full, "all");
              }}
              className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-500 transition-colors text-center"
            >
              {copiedField === "all" ? "Copied to clipboard!" : "Copy Full Email"}
            </button>
            {draft.pdf_url && (
              <a
                href={draft.pdf_url}
                download={draft.pdf_filename}
                className="py-2.5 px-4 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                Download PDF
              </a>
            )}
          </div>

          {/* Recipient hint */}
          {draft.prospects?.contact_email ? (
            <p className="text-xs text-gray-500">
              Send to:{" "}
              <span className="text-gray-400">{draft.prospects.contact_email}</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500">
              No contact email found — look up the right person before sending.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
