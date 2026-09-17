import { useLayoutEffect, useRef, useState } from "react";

export interface Segment<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * Two-state control with a pill that travels to the active option. The
 * indicator is measured from the real button so it tracks label width instead
 * of assuming equal thirds.
 */
export function Segmented<T extends string>({
  segments,
  value,
  onChange,
  disabled,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ x: 0, w: 0 });

  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-v="${value}"]`);
    if (!el || !wrap.current) return;
    setBox({ x: el.offsetLeft, w: el.offsetWidth });
  }, [value, segments]);

  return (
    <div className="seg no-drag" ref={wrap} role="radiogroup" aria-disabled={disabled}>
      <span
        className="seg__pill"
        style={{ transform: `translateX(${box.x}px)`, width: box.w }}
        aria-hidden="true"
      />
      {segments.map((s) => (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={value === s.value}
          data-v={s.value}
          className="seg__btn"
          title={s.hint}
          disabled={disabled}
          onClick={() => onChange(s.value)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
