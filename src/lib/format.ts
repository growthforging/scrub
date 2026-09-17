import type { Entry, ImageFormat, MetadataBlock, Risk } from "./types";

export function formatBytes(n: number, precise = false): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(precise ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Splits a size so the number and its unit can be styled independently. */
export function splitBytes(n: number): [string, string] {
  if (n < 1024) return [`${n}`, "B"];
  if (n < 1024 * 1024) return [`${Math.round(n / 1024)}`, "KB"];
  return [(n / (1024 * 1024)).toFixed(1), "MB"];
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toUpperCase() : "";
}

const VIDEO_EXT = new Set(["MOV", "MP4", "M4V", "QT"]);

export function isVideo(entry: Entry): boolean {
  return (
    entry.inspection?.format === "video" || VIDEO_EXT.has(extOf(entry.name))
  );
}

/** What to print in the format slot — the real extension beats "video". */
export function formatLabel(entry: Entry): string {
  const fmt = entry.inspection?.format;
  if (!fmt || fmt === "video") return extOf(entry.name) || "FILE";
  return fmt.toUpperCase();
}

export function dimensions(entry: Entry): string | null {
  const w = entry.inspection?.width;
  const h = entry.inspection?.height;
  return w && h ? `${w} × ${h}` : null;
}

export function riskOf(entry: Entry): Risk {
  if (entry.error) return "error";
  if (entry.result) return entry.result.error ? "error" : "clean";
  if (!entry.inspection?.hasMetadata) return "clean";
  return entry.inspection.highlights.gps ? "exposed" : "traces";
}

/** Long filenames truncate in the middle so the extension stays readable. */
export function middleTruncate(name: string, max = 42): string {
  if (name.length <= max) return name;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${name.slice(0, head)}…${name.slice(-tail)}`;
}

/**
 * EXIF writes dates as "2024:03:11 14:22:07"; ffprobe writes ISO-8601. Render
 * whichever we got in the user's own locale, and fall back to the raw string
 * rather than guessing.
 */
export function prettyDate(raw: string): string {
  const m = /^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)(.*)$/.exec(raw);
  const iso = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}${m[5]}` : raw;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const FORMAT_NAMES: Record<ImageFormat, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  heic: "HEIC",
  video: "Video",
};

// ---------------------------------------------------------------------------
// Metadata blocks
// ---------------------------------------------------------------------------

/** Colour families for block chips. Five, deliberately — more reads as noise. */
export type BlockTone = "danger" | "brand" | "warning" | "info" | "neutral";

export interface BlockChip {
  /** Short name for the chip. */
  label: string;
  /** The backend's own label, kept for the tooltip and the expanded view. */
  full: string;
  tone: BlockTone;
}

function short(s: string, max = 16): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/**
 * Map a raw block label to something a person can read, and to a tone.
 * Red is reserved for the blocks that actually identify you — EXIF carries the
 * GPS, the device and the capture time; everything else is quieter.
 */
export function classifyBlock(block: MetadataBlock): BlockChip {
  const raw = block.label;
  const l = raw.toLowerCase();

  // PNG text chunks arrive as "Text: <keyword>"; the keyword is the useful part.
  const text = /^text:\s*(.*)$/i.exec(raw);
  if (text) {
    const kw = text[1].trim();
    const k = kw.toLowerCase();
    if (k.includes("xmp")) return { label: "XMP", full: raw, tone: "brand" };
    if (k.includes("iptc")) return { label: "IPTC", full: raw, tone: "warning" };
    if (k.includes("exif")) return { label: "EXIF", full: raw, tone: "danger" };
    return { label: short(kw) || "Text", full: raw, tone: "warning" };
  }

  if (l === "exif") return { label: "EXIF", full: raw, tone: "danger" };
  if (l === "location") return { label: "Location", full: raw, tone: "danger" };
  if (l === "xmp") return { label: "XMP", full: raw, tone: "brand" };
  if (l.startsWith("iptc")) return { label: "IPTC", full: raw, tone: "warning" };
  if (l === "comment") return { label: "Comment", full: raw, tone: "warning" };
  if (l === "timestamp") return { label: "Timestamp", full: raw, tone: "info" };
  if (l === "creation date") return { label: "Created", full: raw, tone: "info" };
  if (l === "device") return { label: "Device", full: raw, tone: "info" };

  // "APP13 metadata" → "APP13"
  const app = /^app(\d+)\s+metadata$/i.exec(raw);
  if (app) return { label: `APP${app[1]}`, full: raw, tone: "neutral" };

  return { label: short(raw), full: raw, tone: "neutral" };
}
