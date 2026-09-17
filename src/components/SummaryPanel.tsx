import { Camera, Clock, DrawnCheck, MapPin, ShieldAlert, ShieldCheck } from "./Icons";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatBytes, plural } from "../lib/format";

export interface Stats {
  total: number;
  exposed: number;
  traces: number;
  clean: number;
  errors: number;
  metadataBytes: number;
  withLocation: number;
  withDevice: number;
  withTime: number;
  scrubbed: number;
  bytesRemoved: number;
}

/**
 * The tally at the top of the list. It answers one question before any row is
 * read: how much of what I just dropped in is carrying something.
 */
export function SummaryPanel({
  stats,
  allDone,
  onRevealAll,
}: {
  stats: Stats;
  allDone: boolean;
  onRevealAll: () => void;
}) {
  const atRisk = stats.exposed + stats.traces;

  if (allDone && stats.scrubbed > 0) {
    return (
      <section className="summary summary--done pop">
        <span className="summary__seal summary__seal--ok">
          <DrawnCheck size={20} strokeWidth={2.4} />
        </span>
        <div className="summary__copy">
          <h2 className="summary__head">
            Scrubbed {stats.scrubbed} {plural(stats.scrubbed, "file")}
          </h2>
          <p className="summary__sub">
            {stats.bytesRemoved > 0
              ? `${formatBytes(stats.bytesRemoved, true)} of metadata removed. Pixels untouched.`
              : "Metadata removed. Pixels untouched."}
          </p>
        </div>
        <button className="btn btn--secondary btn--sm" onClick={onRevealAll}>
          Show in Finder
        </button>
      </section>
    );
  }

  if (atRisk === 0) {
    return (
      <section className="summary summary--clean pop">
        <span className="summary__seal summary__seal--ok">
          <ShieldCheck size={20} />
        </span>
        <div className="summary__copy">
          <h2 className="summary__head">
            {stats.total === 1 ? "This file is clean" : `All ${stats.total} files are clean`}
          </h2>
          <p className="summary__sub">No location, device or timestamp data inside.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="summary pop">
      <div className="summary__top">
        <div className="summary__copy">
          <p className="eyebrow">Hidden data found</p>
          <h2 className="summary__head">
            <AnimatedNumber value={atRisk} duration={420} />
            <span className="summary__of"> of {stats.total}</span>{" "}
            {plural(stats.total, "file")} {atRisk === 1 ? "carries" : "carry"} a trail
          </h2>
        </div>

        {stats.metadataBytes > 0 && (
          <div className="summary__weight">
            <AnimatedNumber
              className="summary__weight-n"
              value={stats.metadataBytes}
              format={(n) => formatBytes(n)}
            />
            <span className="eyebrow">to remove</span>
          </div>
        )}
      </div>

      {/* Proportion bar: the exposed share reads at a glance, like a disk gauge. */}
      <div
        className="meter"
        role="img"
        aria-label={`${stats.exposed} with location, ${stats.traces} with other metadata, ${stats.clean} clean`}
      >
        {stats.exposed > 0 && (
          <span
            className="meter__seg meter__seg--exposed"
            style={{ flexGrow: stats.exposed }}
          />
        )}
        {stats.traces > 0 && (
          <span className="meter__seg meter__seg--traces" style={{ flexGrow: stats.traces }} />
        )}
        {stats.clean > 0 && (
          <span className="meter__seg meter__seg--clean" style={{ flexGrow: stats.clean }} />
        )}
        {stats.errors > 0 && (
          <span className="meter__seg meter__seg--error" style={{ flexGrow: stats.errors }} />
        )}
      </div>

      <ul className="tally">
        {stats.withLocation > 0 && (
          <li className="tally__item tally__item--danger">
            <MapPin size={13} />
            <strong className="num">{stats.withLocation}</strong> with location
          </li>
        )}
        {stats.withDevice > 0 && (
          <li className="tally__item">
            <Camera size={13} />
            <strong className="num">{stats.withDevice}</strong> with device
          </li>
        )}
        {stats.withTime > 0 && (
          <li className="tally__item">
            <Clock size={13} />
            <strong className="num">{stats.withTime}</strong> timestamped
          </li>
        )}
        {stats.clean > 0 && (
          <li className="tally__item tally__item--ok">
            <ShieldCheck size={13} />
            <strong className="num">{stats.clean}</strong> already clean
          </li>
        )}
        {stats.errors > 0 && (
          <li className="tally__item tally__item--muted">
            <ShieldAlert size={13} />
            <strong className="num">{stats.errors}</strong> unreadable
          </li>
        )}
      </ul>
    </section>
  );
}
