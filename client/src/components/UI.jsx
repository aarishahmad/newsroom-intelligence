import { useState } from "react";
import { errorMessage } from "../services/api";
export const label = (s) =>
  s
    ?.replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function Badge({ value }) {
  return (
    <span className={`badge ${value?.toLowerCase()}`}>{label(value)}</span>
  );
}
export function Field({ label: caption, children, ...props }) {
  return (
    <label className="field">
      <span>{caption}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Action({ children, onClick, className = "", ...props }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className={className}
        disabled={busy || props.disabled}
        {...props}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await onClick();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Working…" : children}
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
export function Empty({ children = "No stories match these filters." }) {
  return (
    <div className="empty">
      <span>◎</span>
      <h3>Nothing here yet</h3>
      <p>{children}</p>
    </div>
  );
}
