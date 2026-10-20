"use client";
import { useEffect, useState } from "react";
import {
  AI_TYPES,
  type AiAnalysis,
  type AnalysisType,
  type TicketCategory,
  type TicketPriority,
} from "@supportpilot/types";
import { api, errorMessage } from "../../lib/api";
import { formatDate, label } from "../../lib/format";
import { EmptyState, ErrorState, Loading } from "../ui/states";

const titles: Record<AnalysisType, string> = {
  CLASSIFICATION: "Classify",
  SUMMARY: "Summarize",
  PRIORITY_SUGGESTION: "Suggest priority",
  DRAFT_RESPONSE: "Draft reply",
};
export function AiPanel({
  ticketId,
  busy,
  onApply,
  onDraft,
}: {
  ticketId: string;
  busy: boolean;
  onApply: (value: {
    priority?: TicketPriority;
    category?: TicketCategory;
  }) => Promise<void>;
  onDraft: (text: string) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [analyses, setAnalyses] = useState<AiAnalysis[]>([]);
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setError("");
    async function refresh() {
      try {
        const [capabilities, results] = await Promise.all([
          api<{ enabled: boolean }>("/ai/capabilities", {
            signal: controller.signal,
          }),
          api<AiAnalysis[]>(`/ai/tickets/${ticketId}/analyses`, {
            signal: controller.signal,
          }),
        ]);
        if (controller.signal.aborted) return;
        setEnabled(capabilities.enabled);
        setAnalyses(results);
        if (results.some((item) => item.status === "PENDING"))
          timer = setTimeout(() => void refresh(), 3000);
      } catch (err) {
        if (!controller.signal.aborted) setError(errorMessage(err));
      }
    }
    void refresh();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [ticketId, revision]);
  async function run(type: AnalysisType) {
    setRequesting(true);
    setError("");
    try {
      await api(`/ai/tickets/${ticketId}/analyze`, {
        method: "POST",
        body: JSON.stringify({ type }),
      });
      setRevision((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRequesting(false);
    }
  }
  return (
    <section className="panel detail-card ai-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Human reviewed</p>
          <h2>AI assistance</h2>
        </div>
        <span className="ai-mark" aria-hidden="true">
          ✧
        </span>
      </div>
      <p className="muted">
        Suggestions are advisory. Nothing is changed or sent automatically.
      </p>
      {error && (
        <ErrorState message={error} retry={() => setRevision((v) => v + 1)} />
      )}
      {enabled === null && !error ? (
        <Loading text="Checking AI availability" />
      ) : enabled === false ? (
        <div className="notice">
          <strong>AI not configured</strong>
          <p>
            Your support workflow is fully available. An administrator can
            configure a provider on the server to enable suggestions.
          </p>
        </div>
      ) : (
        enabled && (
          <div className="ai-actions">
            {AI_TYPES.map((type) => (
              <button
                key={type}
                className="button button-small"
                disabled={
                  requesting ||
                  busy ||
                  analyses.some(
                    (item) => item.type === type && item.status === "PENDING",
                  )
                }
                onClick={() => void run(type)}
              >
                {titles[type]}
              </button>
            ))}
          </div>
        )
      )}
      {!analyses.length && enabled && (
        <EmptyState title="A second perspective">
          Request a summary or recommendation when you need it.
        </EmptyState>
      )}
      <div className="analysis-list">
        {analyses.slice(0, 8).map((analysis) => (
          <article className="analysis" key={analysis.id}>
            <div className="analysis-heading">
              <strong>{label(analysis.type)}</strong>
              <span
                className={`analysis-status ${analysis.status === "FAILED" ? "danger" : ""}`}
              >
                {label(analysis.status)}
              </span>
            </div>
            <time className="field-help">{formatDate(analysis.createdAt)}</time>
            {analysis.status === "PENDING" && (
              <p className="muted" role="status">
                Queued for background processing. This panel updates
                automatically.
              </p>
            )}
            {analysis.status === "FAILED" && (
              <p className="notice notice-error">
                The analysis could not finish. Check provider and worker
                availability, then request it again.
              </p>
            )}
            {analysis.status === "COMPLETED" && analysis.result && (
              <>
                {"priority" in analysis.result && (
                  <>
                    <p className="recommendation">
                      {label(analysis.result.priority)}
                    </p>
                    <p>{analysis.result.rationale}</p>
                    <p className="field-help">
                      Confidence {Math.round(analysis.result.confidence * 100)}%
                    </p>
                    <button
                      className="button button-small"
                      disabled={busy}
                      onClick={() => {
                        const result = analysis.result;
                        if (result && "priority" in result)
                          void onApply({ priority: result.priority });
                      }}
                    >
                      Apply priority
                    </button>
                  </>
                )}
                {"category" in analysis.result && (
                  <>
                    <p className="recommendation">
                      {label(analysis.result.category)}
                    </p>
                    <p>{analysis.result.rationale}</p>
                    <p className="field-help">
                      Confidence {Math.round(analysis.result.confidence * 100)}%
                    </p>
                    <button
                      className="button button-small"
                      disabled={busy}
                      onClick={() => {
                        const result = analysis.result;
                        if (result && "category" in result)
                          void onApply({ category: result.category });
                      }}
                    >
                      Apply category
                    </button>
                  </>
                )}
                {"summary" in analysis.result && (
                  <>
                    <p>{analysis.result.summary}</p>
                    <ul>
                      {analysis.result.keyPoints.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                  </>
                )}
                {"response" in analysis.result && (
                  <>
                    <p className="message-body">{analysis.result.response}</p>
                    <button
                      className="button button-small"
                      disabled={busy}
                      onClick={() => {
                        const result = analysis.result;
                        if (result && "response" in result)
                          onDraft(result.response);
                      }}
                    >
                      Use in reply editor
                    </button>
                    <p className="field-help">
                      Review and edit before sending.
                    </p>
                  </>
                )}
              </>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
