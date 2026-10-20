import type { ReactNode } from "react";
import { label } from "../../lib/format";

export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value.toLowerCase()}`}>
      <span className="status-dot" />
      {label(value)}
    </span>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="notice notice-error" role="alert">
      <span>{message}</span>
      {retry && (
        <button className="button button-small" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">
        ◇
      </span>
      <h3>{title}</h3>
      <div className="muted">{children}</div>
    </div>
  );
}
export function Loading({ text = "Loading workspace" }: { text?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {text}
      <div className="skeleton" />
      <div className="skeleton short" />
    </div>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </header>
  );
}
