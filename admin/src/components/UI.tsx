import { useEffect, useRef, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
export function Loading({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={18} className="spin" />
      {text}
    </div>
  );
}
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={17} />
      <div>
        <p>{message}</p>
        {onRetry && (
          <button className="inline-button" onClick={onRetry}>
            Try again <RefreshCw size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="notice">
      <AlertCircle size={17} />
      <div>{children}</div>
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark" aria-hidden="true">
        [ &nbsp; ]
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRight size={13} />
    </a>
  );
}
export type Confirmation = {
  title: string;
  description: string;
  label: string;
  danger?: boolean;
  run: () => Promise<void>;
};
export function ConfirmDialog({
  value,
  onClose,
}: {
  value: Confirmation | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    busy = useRef(false);
  useEffect(() => {
    if (value) {
      ref.current?.showModal();
      busy.current = false;
    } else ref.current?.close();
  }, [value]);
  return (
    <dialog
      className="confirm-dialog"
      ref={ref}
      aria-labelledby="confirmation-title"
      onCancel={(event) => {
        if (busy.current) event.preventDefault();
        else onClose();
      }}
      onClose={onClose}
    >
      {value && (
        <>
          <div className="dialog-top">
            <span className="eyebrow">CONFIRM ACTION</span>
            <button
              className="icon-button"
              aria-label="Close confirmation"
              onClick={() => {
                if (!busy.current) onClose();
              }}
            >
              <X size={18} />
            </button>
          </div>
          <h2 id="confirmation-title">{value.title}</h2>
          <p>{value.description}</p>
          <form
            method="dialog"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy.current) return;
              busy.current = true;
              const button =
                event.currentTarget.querySelector<HTMLButtonElement>(
                  'button[type="submit"]',
                )!;
              button.disabled = true;
              button.textContent = "Working…";
              void value.run().finally(() => {
                busy.current = false;
                onClose();
              });
            }}
          >
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                if (!busy.current) onClose();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`button ${value.danger ? "danger" : "primary"}`}
            >
              {value.label}
            </button>
          </form>
        </>
      )}
    </dialog>
  );
}
export function Toast({
  value,
  onClose,
}: {
  value: { message: string; error?: boolean } | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(onClose, value.error ? 15000 : 7000);
    return () => clearTimeout(timer);
  }, [value, onClose]);
  return value ? (
    <div
      className={`toast ${value.error ? "error" : ""}`}
      role={value.error ? "alert" : "status"}
    >
      {value.error ? <AlertCircle size={18} /> : <Check size={18} />}
      <p>{value.message}</p>
      <button
        className="icon-button"
        aria-label="Dismiss notification"
        onClick={onClose}
      >
        <X size={15} />
      </button>
    </div>
  ) : null;
}
