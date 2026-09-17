import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/app.css";

import { TitleBar } from "./components/TitleBar";
import { EmptyState } from "./components/EmptyState";
import { DropOverlay } from "./components/DropOverlay";
import { SummaryPanel, type Stats } from "./components/SummaryPanel";
import { FileRow } from "./components/FileRow";
import { ActionBar, type OutputMode } from "./components/ActionBar";
import { Toast, type ToastData } from "./components/Toast";
import { Spinner } from "./components/Icons";

import { useTheme } from "./lib/theme";
import { formatBytes, plural, riskOf } from "./lib/format";
import type {
  Capabilities,
  Entry,
  FileInspection,
  Progress,
  ScrubResult,
} from "./lib/types";

const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif"];
const VIDEO_EXTS = ["mov", "mp4", "m4v", "qt"];

type Phase = "idle" | "inspecting" | "scrubbing";

export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<OutputMode>("copy");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [caps, setCaps] = useState<Capabilities>({ ffmpeg: true, sips: true });
  const [toast, setToast] = useState<ToastData | null>(null);
  /** Drives the hairline under the title bar: only once content is behind it. */
  const [scrolled, setScrolled] = useState(false);

  const theme = useTheme();
  const busy = phase !== "idle";
  /** Paths handed to the current scrub, so a progress index maps to a row. */
  const batch = useRef<string[]>([]);

  // -- backend wiring ------------------------------------------------------

  useEffect(() => {
    invoke<Capabilities>("capabilities").then(setCaps).catch(() => {});
  }, []);

  useEffect(() => {
    const p = listen<Progress>("scrub://progress", (e) => setProgress(e.payload));
    return () => {
      void p.then((un) => un());
    };
  }, []);

  const addPaths = useCallback(async (paths: string[]) => {
    if (!paths.length) return;
    setPhase("inspecting");
    setProgress(null);
    try {
      const results = await invoke<FileInspection[]>("inspect_files", { paths });
      setEntries((prev) => {
        // Keyed by path so re-dropping a file refreshes it instead of duplicating.
        const byPath = new Map(prev.map((e) => [e.path, e]));
        for (const r of results) {
          byPath.set(r.path, {
            path: r.path,
            name: r.name,
            inspection: r.inspection,
            error: r.error,
          });
        }
        return [...byPath.values()];
      });
    } catch (err) {
      setToast({
        id: Date.now(),
        tone: "error",
        title: "Couldn't read those files",
        detail: String(err),
      });
    } finally {
      setPhase("idle");
      setProgress(null);
    }
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
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

  // -- actions -------------------------------------------------------------

  const browseFiles = useCallback(async () => {
    const picked = await open({
      multiple: true,
      filters: [{ name: "Images & video", extensions: [...IMAGE_EXTS, ...VIDEO_EXTS] }],
    });
    if (!picked) return;
    void addPaths(Array.isArray(picked) ? picked : [picked]);
  }, [addPaths]);

  const browseFolder = useCallback(async () => {
    const picked = await open({ directory: true, multiple: false });
    if (!picked) return;
    void addPaths([picked as string]);
  }, [addPaths]);

  const scrubbable = useMemo(
    () => entries.filter((e) => e.inspection?.hasMetadata && !e.result),
    [entries],
  );

  const scrub = useCallback(async () => {
    const paths = scrubbable.map((e) => e.path);
    if (!paths.length) return;
    batch.current = paths;
    setPhase("scrubbing");
    setProgress({ phase: "scrub", index: 0, total: paths.length, name: "" });
    try {
      const results = await invoke<ScrubResult[]>("scrub_files", {
        paths,
        overwrite: mode === "overwrite",
      });
      setEntries((prev) => {
        const byPath = new Map(prev.map((e) => [e.path, e]));
        for (const r of results) {
          const existing = byPath.get(r.path);
          if (existing) byPath.set(r.path, { ...existing, result: r });
        }
        return [...byPath.values()];
      });

      const ok = results.filter((r) => !r.error);
      const failed = results.length - ok.length;
      const removed = ok.reduce((n, r) => n + r.bytesRemoved, 0);
      const firstOut = ok.find((r) => r.outputPath)?.outputPath;

      setToast({
        id: Date.now(),
        tone: failed ? "error" : "ok",
        title: failed
          ? `${failed} of ${results.length} ${plural(results.length, "file")} failed`
          : `Scrubbed ${ok.length} ${plural(ok.length, "file")}`,
        detail: failed
          ? "Open the list to see what went wrong."
          : removed > 0
            ? `${formatBytes(removed, true)} of metadata removed · pixels untouched`
            : "Metadata removed · pixels untouched",
        action: firstOut
          ? { label: "Show", run: () => void invoke("reveal_in_finder", { path: firstOut }) }
          : undefined,
      });
    } catch (err) {
      setToast({ id: Date.now(), tone: "error", title: "Scrub failed", detail: String(err) });
    } finally {
      setPhase("idle");
      setProgress(null);
      batch.current = [];
    }
  }, [scrubbable, mode]);

  const cancel = useCallback(() => {
    void invoke("cancel_batch").catch(() => {});
  }, []);

  const reveal = useCallback((path: string) => {
    void invoke("reveal_in_finder", { path }).catch(() => {});
  }, []);

  const openMap = useCallback((url: string) => {
    void invoke("open_url", { url }).catch(() => {});
  }, []);

  const removeEntry = useCallback((path: string) => {
    setEntries((prev) => prev.filter((e) => e.path !== path));
  }, []);

  const clear = useCallback(() => {
    setEntries([]);
    setToast(null);
  }, []);

  const revealAll = useCallback(() => {
    const out = entries.find((e) => e.result?.outputPath)?.result?.outputPath;
    if (out) reveal(out);
  }, [entries, reveal]);

  // -- keyboard ------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void (e.shiftKey ? browseFolder() : browseFiles());
      } else if (cmd && e.key === "Enter") {
        e.preventDefault();
        if (!busy) void scrub();
      } else if (cmd && (e.key === "Backspace" || e.key === "Delete")) {
        e.preventDefault();
        if (!busy) clear();
      } else if (e.key === "Escape" && phase === "scrubbing") {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [browseFiles, browseFolder, scrub, clear, cancel, busy, phase]);

  // -- derived -------------------------------------------------------------

  const stats: Stats = useMemo(() => {
    const s: Stats = {
      total: entries.length,
      exposed: 0,
      traces: 0,
      clean: 0,
      errors: 0,
      metadataBytes: 0,
      withLocation: 0,
      withDevice: 0,
      withTime: 0,
      scrubbed: 0,
      bytesRemoved: 0,
    };
    for (const e of entries) {
      const risk = riskOf(e);
      if (risk === "exposed") s.exposed++;
      else if (risk === "traces") s.traces++;
      else if (risk === "clean") s.clean++;
      else s.errors++;

      const h = e.inspection?.highlights;
      if (h?.gps) s.withLocation++;
      if (h?.camera) s.withDevice++;
      if (h?.dateTime) s.withTime++;
      if (!e.result) s.metadataBytes += e.inspection?.metadataBytes ?? 0;
      if (e.result && !e.result.error) {
        s.scrubbed++;
        s.bytesRemoved += e.result.bytesRemoved;
      }
    }
    return s;
  }, [entries]);

  const pendingBytes = scrubbable.reduce(
    (n, e) => n + (e.inspection?.metadataBytes ?? 0),
    0,
  );
  const allDone = entries.length > 0 && scrubbable.length === 0 && stats.scrubbed > 0;
  const activePath =
    phase === "scrubbing" && progress ? (batch.current[progress.index] ?? null) : null;
  const ratio =
    progress && progress.total > 0 ? Math.min(1, progress.index / progress.total) : null;

  return (
    <div className="shell" data-scrolled={scrolled}>
      <TitleBar
        theme={theme.choice}
        onCycleTheme={theme.cycle}
        count={entries.length}
        onClear={clear}
      />

      <main
        className="content scroll"
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 4)}
      >
        {entries.length === 0 ? (
          phase === "inspecting" ? (
            <div className="scanning pop">
              <Spinner size={22} />
              <p className="scanning__title shimmer">
                Reading {progress?.name || "files"}…
              </p>
              {progress && progress.total > 1 && (
                <p className="scanning__count mono">
                  {progress.index + 1} of {progress.total}
                </p>
              )}
            </div>
          ) : (
            <EmptyState
              onBrowseFiles={browseFiles}
              onBrowseFolder={browseFolder}
              busy={busy}
              ffmpegMissing={!caps.ffmpeg}
            />
          )
        ) : (
          <div className="stack">
            <SummaryPanel stats={stats} allDone={allDone} onRevealAll={revealAll} />
            <ul className="rows">
              {entries.map((e, i) => (
                <FileRow
                  key={e.path}
                  entry={e}
                  index={i}
                  active={e.path === activePath}
                  onReveal={reveal}
                  onMap={openMap}
                  onRemove={removeEntry}
                />
              ))}
            </ul>
          </div>
        )}
      </main>

      {entries.length > 0 && (
        <ActionBar
          mode={mode}
          onModeChange={setMode}
          count={scrubbable.length}
          bytes={pendingBytes}
          busy={busy}
          phase={phase}
          progress={ratio}
          allDone={allDone}
          onScrub={scrub}
          onCancel={cancel}
          onAdd={browseFiles}
        />
      )}

      <DropOverlay show={dragging} />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
