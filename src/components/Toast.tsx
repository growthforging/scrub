import { useEffect } from "react";
import { DrawnCheck, ShieldAlert, X } from "./Icons";

export interface ToastData {
  id: number;
  tone: "ok" | "error";
  title: string;
  detail?: string;
  action?: { label: string; run: () => void };
}

export function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="toast" role="status" data-tone={toast.tone} key={toast.id}>
      <span className="toast__glyph">
        {toast.tone === "ok" ? (
          <DrawnCheck size={15} strokeWidth={2.4} />
        ) : (
          <ShieldAlert size={15} />
        )}
      </span>
      <div className="toast__copy">
        <p className="toast__title">{toast.title}</p>
        {toast.detail && <p className="toast__detail">{toast.detail}</p>}
      </div>
      {toast.action && (
        <button className="btn btn--secondary btn--sm" onClick={toast.action.run}>
          {toast.action.label}
        </button>
      )}
      <button className="btn btn--icon toast__close" onClick={onDismiss} aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  );
}
