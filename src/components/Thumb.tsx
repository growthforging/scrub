import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Film, ImageIcon } from "./Icons";
import type { Entry } from "../lib/types";
import { isVideo } from "../lib/format";

/**
 * Thumbnail with a pulsing placeholder underneath. The two layers share a
 * cell, so the swap when the decode finishes is a cross-fade with no reflow —
 * and a format that the webview can't decode falls back to a glyph instead of
 * a broken-image box.
 */
export function Thumb({ entry, size = 46 }: { entry: Entry; size?: number }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const video = isVideo(entry);
  const src = convertFileSrc(entry.path);

  return (
    <div
      className="thumb"
      data-state={state}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="thumb__skeleton" />

      {state !== "failed" &&
        (video ? (
          <video
            className="thumb__media"
            src={src}
            muted
            playsInline
            preload="metadata"
            onLoadedData={() => setState("ready")}
            onError={() => setState("failed")}
          />
        ) : (
          <img
            className="thumb__media"
            src={src}
            alt=""
            decoding="async"
            /* A dropped folder can hold hundreds of files; without this every
               full-resolution image would decode at once for a 46px preview. */
            loading="lazy"
            onLoad={() => setState("ready")}
            onError={() => setState("failed")}
          />
        ))}

      {state === "failed" && (
        <span className="thumb__fallback">
          {video ? <Film size={18} /> : <ImageIcon size={18} />}
        </span>
      )}

      {video && state === "ready" && <span className="thumb__badge">
        <Film size={11} />
      </span>}
    </div>
  );
}
