import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";
import scrubIcon from "./assets/scrub-icon.png";

type ImageFormat = "jpeg" | "png";

interface MetadataBlock {
  label: string;
  bytes: number;
}
interface ExifHighlights {
  gps: string | null;
  gpsMapsUrl: string | null;
  camera: string | null;
  dateTime: string | null;
  software: string | null;
  otherCount: number;
}
interface Inspection {
  format: ImageFormat;
  totalBytes: number;
  metadataBytes: number;
  blocks: MetadataBlock[];
  highlights: ExifHighlights;
  hasMetadata: boolean;
}
interface FileInspection {
  path: string;
  name: string;
  inspection: Inspection | null;
  error: string | null;
}
interface ScrubResult {
  path: string;
  name: string;
  outputPath: string | null;
  outputName: string | null;
  removed: MetadataBlock[];
  bytesRemoved: number;
  originalBytes: number;
  cleanedBytes: number;
  error: string | null;
}
interface Entry {
  path: string;
  name: string;
  inspection: Inspection | null;
  error: string | null;
  result?: ScrubResult;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  const addPaths = useCallback(async (paths: string[]) => {
    if (!paths.length) return;
    setBusy(true);
    try {
      const results = await invoke<FileInspection[]>("inspect_files", { paths });
      setEntries((prev) => {
        const byPath = new Map(prev.map((e) => [e.path, e]));
        for (const r of results) {
          byPath.set(r.path, {
            path: r.path,
            name: r.name,
            inspection: r.inspection,
            error: r.error,
          });
        }
        return Array.from(byPath.values());
      });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "enter" || event.payload.type === "over") {
          setDragging(true);
        } else if (event.payload.type === "drop") {
          setDragging(false);
          void addPaths(event.payload.paths);
        } else {
          setDragging(false);
        }
      })
      .then((u) => {
        unlisten = u;
      });
    return () => unlisten?.();
  }, [addPaths]);

  const browse = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png"] }],
    });
    if (!selected) return;
    void addPaths(Array.isArray(selected) ? selected : [selected]);
  }, [addPaths]);

  const scrubbable = useMemo(
    () => entries.filter((e) => e.inspection?.hasMetadata && !e.result),
    [entries]
  );

  const scrub = useCallback(async () => {
    const paths = scrubbable.map((e) => e.path);
    if (!paths.length) return;
    setBusy(true);
    try {
      const results = await invoke<ScrubResult[]>("scrub_files", { paths, overwrite });
      setEntries((prev) => {
        const byPath = new Map(prev.map((e) => [e.path, e]));
        for (const r of results) {
          const existing = byPath.get(r.path);
          if (existing) byPath.set(r.path, { ...existing, result: r });
        }
        return Array.from(byPath.values());
      });
    } finally {
      setBusy(false);
    }
  }, [scrubbable, overwrite]);

  const reveal = useCallback((path: string) => {
    void invoke("reveal_in_finder", { path }).catch(() => {});
  }, []);

  const totalToRemove = scrubbable.reduce(
    (sum, e) => sum + (e.inspection?.metadataBytes ?? 0),
    0
  );

  return (
    <main className="app">
      <header className="header">
        <div className="brand">
          <img src={scrubIcon} className="logo" alt="Scrub icon" />
          <div className="brand-text">
            <h1>Scrub</h1>
            <p>Strip hidden metadata from images — locally &amp; losslessly.</p>
          </div>
        </div>
        {entries.length > 0 && (
          <button className="ghost" onClick={() => setEntries([])}>
            Clear
          </button>
        )}
      </header>

      <section className={`dropzone ${dragging ? "dragging" : ""} ${entries.length ? "compact" : ""}`}>
        <div className="dropzone-inner">
          <p className="dz-title">{dragging ? "Drop to add" : "Drop images here"}</p>
          <p className="dz-sub">JPEG &amp; PNG · or</p>
          <button className="primary" onClick={browse} disabled={busy}>
            Browse…
          </button>
        </div>
      </section>

      <section className="list">
        {entries.map((e) => (
          <FileCard key={e.path} entry={e} onReveal={reveal} />
        ))}
      </section>

      {scrubbable.length > 0 && (
        <footer className="actionbar">
          <label className="overwrite">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(ev) => setOverwrite(ev.target.checked)}
            />
            Overwrite originals
          </label>
          <span className="spacer" />
          <span className="hint">
            {scrubbable.length} image{scrubbable.length > 1 ? "s" : ""} ·{" "}
            {formatBytes(totalToRemove)} of metadata
          </span>
          <button className="primary scrub" onClick={scrub} disabled={busy}>
            {busy ? "Scrubbing…" : overwrite ? "Scrub & overwrite" : "Scrub → copies"}
          </button>
        </footer>
      )}
    </main>
  );
}

function FileCard({ entry, onReveal }: { entry: Entry; onReveal: (p: string) => void }) {
  const { inspection, error, result } = entry;
  const h = inspection?.highlights;

  return (
    <div className="card">
      <div className="card-head">
        <span className="fname" title={entry.path}>
          {entry.name}
        </span>
        {inspection && (
          <span className="badge">
            {inspection.format.toUpperCase()} · {formatBytes(inspection.totalBytes)}
          </span>
        )}
      </div>

      {error && <div className="error">⚠ {error}</div>}

      {inspection && !result && (
        inspection.hasMetadata ? (
          <div className="meta">
            {h?.gps && (
              <div className="gps">
                📍 Location embedded: <strong>{h.gps}</strong>
              </div>
            )}
            {(h?.camera || h?.dateTime || h?.software) && (
              <div className="chips">
                {h?.camera && <span className="chip">📷 {h.camera}</span>}
                {h?.dateTime && <span className="chip">🕑 {h.dateTime}</span>}
                {h?.software && <span className="chip">🛠 {h.software}</span>}
              </div>
            )}
            <div className="blocks">
              {inspection.blocks.map((b, i) => (
                <span className="block" key={i}>
                  {b.label} <em>{formatBytes(b.bytes)}</em>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="clean">✓ No metadata found — already clean.</div>
        )
      )}

      {result &&
        (result.error ? (
          <div className="error">⚠ {result.error}</div>
        ) : result.outputName ? (
          <div className="done">
            <span className="done-line">
              ✓ Scrubbed · removed {formatBytes(result.bytesRemoved)} → {result.outputName}
            </span>
            {result.outputPath && (
              <button className="ghost sm" onClick={() => onReveal(result.outputPath!)}>
                Show in Finder
              </button>
            )}
          </div>
        ) : (
          <div className="clean">✓ Already clean — nothing to remove.</div>
        ))}
    </div>
  );
}

export default App;
