import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "scrub.theme";
const media = () => window.matchMedia("(prefers-color-scheme: dark)");

export function readChoice(): ThemeChoice {
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function resolve(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  return media().matches ? "dark" : "light";
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolve(choice);
}

/**
 * Three-way theme with the system option kept live: picking "system" keeps
 * following the OS rather than freezing whatever it happened to be.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);

  useEffect(() => {
    applyTheme(choice);
    localStorage.setItem(KEY, choice);
    if (choice !== "system") return;
    const mq = media();
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const cycle = useCallback(() => {
    setChoice((c) => (c === "system" ? "light" : c === "light" ? "dark" : "system"));
  }, []);

  return { choice, setChoice, cycle, resolved: resolve(choice) };
}
