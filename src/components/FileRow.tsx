import { useState } from "react";
import { Thumb } from "./Thumb";
import {
  ArrowUpRight,
  Camera,
  ChevronDown,
  Clock,
  Copy,
  DrawnCheck,
  Layers,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  X,
} from "./Icons";
import type { Entry } from "../lib/types";
import {
  classifyBlock,
  dimensions,
  formatBytes,
  formatLabel,
  middleTruncate,
  prettyDate,
  riskOf,
} from "../lib/format";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be unavailable depending on how the webview is served.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn btn--ghost btn--sm"
      title="Copy coordinates"
      onClick={async (e) => {
        e.stopPropagation();
        if (await copyText(value)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }
      }}
    >
      <span key={String(copied)} className="icon-swap">
        {copied ? <DrawnCheck size={13} strokeWidth={2.2} /> : <Copy size={13} />}
      </span>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <span className="field__icon">{icon}</span>
      <span className="eyebrow field__label">{label}</span>
      <span className="field__value">{children}</span>
    </div>
  );
}

export function FileRow({
  entry,
  index,
  active,
  onReveal,
  onMap,
  onRemove,
}: {
  entry: Entry;
  index: number;
  /** True while this row is the file the backend is working on. */
  active: boolean;
  onReveal: (path: string) => void;
  onMap: (url: string) => void;
  onRemove: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { inspection, error, result } = entry;
  const h = inspection?.highlights;
  const risk = riskOf(entry);
  const dims = dimensions(entry);
  const done = Boolean(result && !result.error);
  const expandable = Boolean(inspection?.hasMetadata && !done);

  const blocks = inspection?.blocks ?? [];
  // A block literally called "Location" is the same fact as the GPS alarm above,
  // so drop it rather than saying it twice.
  const chips = blocks
    .filter((b) => !(h?.gps && b.label.toLowerCase() === "location"))
    .map((b) => ({ ...classifyBlock(b), bytes: b.bytes }));
  const MAX_CHIPS = 5;
  const shown = chips.slice(0, MAX_CHIPS);
  const hidden = chips.length - shown.length;
  const noBlocks = blocks.length === 0 && Boolean(inspection?.hasMetadata);

  const metaLine = [
    formatLabel(entry),
    dims,
    inspection ? formatBytes(inspection.totalBytes) : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <li
      className="row rise"
      data-risk={risk}
      data-open={open}
      data-active={active}
      style={{ ["--i" as string]: Math.min(index, 12) }}
    >
      <div
        className="row__head"
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? open : undefined}
        onClick={() => expandable && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (expandable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <Thumb entry={entry} />

        <div className="row__main">
          <div className="row__title">
            <span className="row__name" title={entry.path}>
              {middleTruncate(entry.name)}
            </span>
            {inspection?.format === "heic" && <span className="pill pill--brand">→ JPEG</span>}
          </div>

          <p className="row__meta mono">{metaLine}</p>

          {error && (
            <p className="row__error">
              <ShieldAlert size={13} />
              {error}
            </p>
          )}

          {!error && !done && inspection && (
            <div className="row__tags">
              {/* The one fact worth its own alarm: real coordinates are in here. */}
              {h?.gps && (
                <span className="pill pill--danger" title={`Coordinates embedded: ${h.gps}`}>
                  <span className="dot dot--live" />
                  Location
                </span>
              )}

              {shown.map((c, i) => (
                <span className="block-chip mono" data-tone={c.tone} key={`${c.full}-${i}`} title={c.full}>
                  {c.label}
                  {c.bytes > 0 && <em>{formatBytes(c.bytes)}</em>}
                </span>
              ))}
              {hidden > 0 && (
                <span className="block-chip mono" title="Expand the row to see them all">
                  +{hidden}
                </span>
              )}

              {/* HEIC reports metadata it can't enumerate as blocks, so fall back
                  to what we managed to decode out of it. */}
              {noBlocks && (
                <>
                  {h?.camera && (
                    <span className="pill">
                      <Camera size={11} />
                      Device
                    </span>
                  )}
                  {h?.dateTime && (
                    <span className="pill">
                      <Clock size={11} />
                      Timestamp
                    </span>
                  )}
                  {h?.software && (
                    <span className="pill">
                      <Wrench size={11} />
                      Software
                    </span>
                  )}
                  {!h?.gps && !h?.camera && !h?.dateTime && !h?.software && (
                    <span className="pill pill--warning">
                      <Layers size={11} />
                      Embedded metadata
                    </span>
                  )}
                </>
              )}

              {!inspection.hasMetadata && (
                <span className="pill pill--success">
                  <ShieldCheck size={11} />
                  Clean
                </span>
              )}
            </div>
          )}

          {result && !result.error && (
            <p className="row__done">
              <span className="row__done-check">
                <DrawnCheck size={13} strokeWidth={2.4} />
              </span>
              {result.outputName ? (
                <>
                  {result.bytesRemoved > 0
                    ? `Removed ${formatBytes(result.bytesRemoved, true)}`
                    : "Metadata removed"}
                  <span className="row__arrow">→</span>
                  <span className="mono row__out">{middleTruncate(result.outputName, 30)}</span>
                </>
              ) : (
                "Already clean, nothing to remove"
              )}
            </p>
          )}

          {result?.error && (
            <p className="row__error">
              <ShieldAlert size={13} />
              {result.error}
            </p>
          )}
        </div>

        <div className="row__side">
          {active && <span className="row__working shimmer">Working…</span>}

          {!active && result?.outputPath && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                onReveal(result.outputPath!);
              }}
            >
              Show
            </button>
          )}

          {!active && expandable && (
            <span className="row__chevron" aria-hidden="true">
              <ChevronDown size={16} />
            </span>
          )}

          {!active && !done && (
            <button
              className="btn btn--icon row__remove"
              title="Remove from list"
              aria-label={`Remove ${entry.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove(entry.path);
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Height animates through grid-template-rows so the panel can size to
          its own content without a measured pixel height. */}
      {expandable && (
        <div className="row__drawer">
          <div className="row__drawer-inner">
            <div className="detail">
              {h?.gps && (
                <Field icon={<MapPin size={13} />} label="Location">
                  <span className="mono selectable detail__gps">{h.gps}</span>
                  <span className="detail__tools">
                    {h.gpsMapsUrl && (
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMap(h.gpsMapsUrl!);
                        }}
                      >
                        Map
                        <ArrowUpRight size={13} />
                      </button>
                    )}
                    <CopyButton value={h.gps} />
                  </span>
                </Field>
              )}
              {h?.camera && (
                <Field icon={<Camera size={13} />} label="Device">
                  <span className="selectable">{h.camera}</span>
                </Field>
              )}
              {h?.dateTime && (
                <Field icon={<Clock size={13} />} label="Captured">
                  <span className="selectable">{prettyDate(h.dateTime)}</span>
                </Field>
              )}
              {h?.software && (
                <Field icon={<Wrench size={13} />} label="Software">
                  <span className="selectable">{h.software}</span>
                </Field>
              )}

              {/* The chips upstairs are shortened and rounded; here they're the
                  backend's own labels with exact byte counts. */}
              {blocks.length > 0 && (
                <Field icon={<Layers size={13} />} label="Blocks">
                  <span className="blocks">
                    {blocks.map((b, i) => (
                      <span
                        className="block-chip mono"
                        data-tone={classifyBlock(b).tone}
                        key={`${b.label}-${i}`}
                      >
                        {b.label}
                        {b.bytes > 0 && <em>{b.bytes.toLocaleString()} B</em>}
                      </span>
                    ))}
                  </span>
                </Field>
              )}

              {inspection?.note && <p className="detail__note">{inspection.note}</p>}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
