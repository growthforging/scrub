import { Inbox } from "./Icons";

/**
 * The whole window is the drop target, so the cue is a full-bleed overlay
 * rather than a box you have to aim at.
 */
export function DropOverlay({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="dropover" role="presentation">
      <div className="dropover__ring" />
      <div className="dropover__card">
        <span className="dropover__glyph">
          <Inbox size={26} />
        </span>
        <p className="dropover__title">Drop to scan</p>
        <p className="dropover__sub">Files are read in place. Nothing is changed yet.</p>
      </div>
    </div>
  );
}
