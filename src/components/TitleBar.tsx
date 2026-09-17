import scrubIcon from "../assets/scrub-icon.png";
import { Lock, Monitor, Moon, Sun, Trash } from "./Icons";
import type { ThemeChoice } from "../lib/theme";

const THEME_ICON: Record<ThemeChoice, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const THEME_LABEL: Record<ThemeChoice, string> = {
  system: "Following system appearance",
  light: "Light appearance",
  dark: "Dark appearance",
};

/**
 * The window has no system title bar (titleBarStyle: Overlay), so this strip
 * is both the chrome and the drag handle. It leaves room for the traffic
 * lights on the left and keeps its controls out of the drag region.
 */
export function TitleBar({
  theme,
  onCycleTheme,
  count,
  onClear,
}: {
  theme: ThemeChoice;
  onCycleTheme: () => void;
  count: number;
  onClear: () => void;
}) {
  const ThemeIcon = THEME_ICON[theme];

  return (
    <header className="titlebar drag">
      <div className="titlebar__brand">
        <img src={scrubIcon} className="titlebar__mark" alt="" />
        <span className="titlebar__name">Scrub</span>
        <span className="titlebar__trust" title="No network access. Files never leave this Mac.">
          <Lock size={10} />
          On-device
        </span>
      </div>

      <div className="titlebar__actions no-drag">
        {count > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={onClear} title="Clear the list  ⌘⌫">
            <Trash size={13} />
            Clear
          </button>
        )}
        <button
          className="btn btn--icon"
          onClick={onCycleTheme}
          title={THEME_LABEL[theme]}
          aria-label={THEME_LABEL[theme]}
        >
          {/* Keyed so React swaps the element and the icon animates in. */}
          <span key={theme} className="icon-swap">
            <ThemeIcon size={15} />
          </span>
        </button>
      </div>
    </header>
  );
}
