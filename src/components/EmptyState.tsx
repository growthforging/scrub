import scrubIcon from "../assets/scrub-icon.png";
import { FolderOpen, ImageIcon, Lock, ShieldAlert } from "./Icons";

const FORMATS = ["JPEG", "PNG", "WEBP", "HEIC", "MP4", "MOV"];

export function EmptyState({
  onBrowseFiles,
  onBrowseFolder,
  busy,
  ffmpegMissing,
}: {
  onBrowseFiles: () => void;
  onBrowseFolder: () => void;
  busy: boolean;
  ffmpegMissing: boolean;
}) {
  return (
    <div className="empty">
      <figure className="empty__mark">
        <span className="empty__aurora" aria-hidden="true" />
        <img src={scrubIcon} alt="" width={78} height={78} />
      </figure>

      <h1 className="empty__title rise" style={{ ["--i" as string]: 1 }}>
        Your photos know where you were.
      </h1>
      <p className="empty__lede rise" style={{ ["--i" as string]: 2 }}>
        Scrub reads the coordinates and camera records hidden inside them, then
        strips them out without re-encoding a single pixel.
      </p>

      <div className="empty__actions rise" style={{ ["--i" as string]: 3 }}>
        <button className="btn btn--primary btn--lg" onClick={onBrowseFiles} disabled={busy}>
          <ImageIcon size={15} />
          Choose files
          <kbd>⌘O</kbd>
        </button>
        <button className="btn btn--secondary btn--lg" onClick={onBrowseFolder} disabled={busy}>
          <FolderOpen size={15} />
          Choose folder
        </button>
      </div>

      <p className="empty__hint rise" style={{ ["--i" as string]: 4 }}>
        or drop them anywhere in this window
      </p>

      <ul className="empty__formats rise" style={{ ["--i" as string]: 5 }}>
        {FORMATS.map((f) => (
          <li key={f} className="mono">
            {f}
          </li>
        ))}
      </ul>

      <footer className="empty__foot rise" style={{ ["--i" as string]: 6 }}>
        <p className="empty__trust">
          <Lock size={12} />
          No network access. Every byte is read and written on this Mac.
        </p>
        {ffmpegMissing && (
          <p className="empty__warn">
            <ShieldAlert size={12} />
            Video needs ffmpeg. Install it with <code className="mono">brew install ffmpeg</code>
          </p>
        )}
      </footer>
    </div>
  );
}
