/** Mirrors the serde-camelCase payloads emitted by src-tauri/src/lib.rs. */

export type ImageFormat = "jpeg" | "png" | "webp" | "heic" | "video";

export interface MetadataBlock {
  label: string;
  bytes: number;
}

export interface ExifHighlights {
  gps: string | null;
  gpsMapsUrl: string | null;
  camera: string | null;
  dateTime: string | null;
  software: string | null;
  otherCount: number;
}

export interface Inspection {
  format: ImageFormat;
  totalBytes: number;
  metadataBytes: number;
  blocks: MetadataBlock[];
  highlights: ExifHighlights;
  hasMetadata: boolean;
  note: string | null;
  width: number | null;
  height: number | null;
}

export interface FileInspection {
  path: string;
  name: string;
  inspection: Inspection | null;
  error: string | null;
}

export interface ScrubResult {
  path: string;
  name: string;
  outputPath: string | null;
  outputName: string | null;
  removed: MetadataBlock[];
  bytesRemoved: number;
  originalBytes: number;
  cleanedBytes: number;
  error: string | null;
  note: string | null;
}

export interface Entry {
  path: string;
  name: string;
  inspection: Inspection | null;
  error: string | null;
  result?: ScrubResult;
}

export interface Progress {
  phase: "inspect" | "scrub" | "done";
  index: number;
  total: number;
  name: string;
}

export interface Capabilities {
  ffmpeg: boolean;
  sips: boolean;
}

/** How alarming a file is, which drives its colour everywhere in the UI. */
export type Risk = "exposed" | "traces" | "clean" | "error";
