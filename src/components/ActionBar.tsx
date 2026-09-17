import { DrawnCheck, Plus, Spinner } from "./Icons";
import { Segmented } from "./Segmented";
import { formatBytes, plural } from "../lib/format";

export type OutputMode = "copy" | "overwrite";

export function ActionBar({
  mode,
  onModeChange,
  count,
  bytes,
  busy,
  phase,
  progress,
  allDone,
  onScrub,
  onCancel,
  onAdd,
}: {
  mode: OutputMode;
  onModeChange: (m: OutputMode) => void;
  count: number;
  bytes: number;
  busy: boolean;
  phase: "idle" | "inspecting" | "scrubbing";
  /** 0–1, or null when there is nothing measurable in flight. */
  progress: number | null;
  allDone: boolean;
  onScrub: () => void;
  onCancel: () => void;
  onAdd: () => void;
}) {
  const scrubbing = phase === "scrubbing";
  const nothingToDo = count === 0;

  return (
    <footer className="actionbar">
      <span
        className="actionbar__progress"
        data-on={progress !== null}
        style={{ transform: `scaleX(${progress ?? 0})` }}
        aria-hidden="true"
      />

      <div className="actionbar__inner">
        <button className="btn btn--secondary btn--sm" onClick={onAdd} disabled={busy}>
          <Plus size={14} />
          Add
        </button>

        {!allDone && (
          <Segmented
            value={mode}
            onChange={onModeChange}
            disabled={busy}
            segments={[
              { value: "copy", label: "Save copies", hint: "Write alongside the original as “name-clean.ext”" },
              { value: "overwrite", label: "Overwrite", hint: "Replace the original file in place" },
            ]}
          />
        )}

        <span className="actionbar__spacer" />

        {!scrubbing && !nothingToDo && (
          <p className="actionbar__hint">
            <strong className="num">{count}</strong> {plural(count, "file")}
            {bytes > 0 && (
              <>
                {" · "}
                <span className="num">{formatBytes(bytes)}</span> of metadata
              </>
            )}
          </p>
        )}

        {scrubbing && (
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>
            Cancel
          </button>
        )}

        <button
          className={`btn btn--primary${scrubbing ? " btn--working" : allDone ? " btn--done" : ""}`}
          onClick={onScrub}
          disabled={busy || nothingToDo}
          title={mode === "overwrite" ? "Replaces the originals" : "Writes clean copies"}
        >
          {scrubbing ? (
            <>
              <Spinner size={15} />
              Scrubbing…
            </>
          ) : allDone ? (
            <>
              <DrawnCheck size={15} strokeWidth={2.4} />
              Done
            </>
          ) : (
            <>
              {mode === "overwrite" ? "Scrub in place" : "Scrub"}
              <kbd>⌘⏎</kbd>
            </>
          )}
        </button>
      </div>
    </footer>
  );
}
