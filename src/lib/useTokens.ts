// Recharts/SVG attributes can't read CSS variables, so resolve the colour tokens for the current theme.
import { useMemo } from "react";
import { useUi } from "../store/ui";

const NAMES = ["bg", "surface", "surface-2", "border", "text", "text-2", "accent", "accent-soft", "good", "warn", "bad", "info"] as const;
export type Tokens = Record<(typeof NAMES)[number], string>;

export function useTokens(): Tokens {
  const theme = useUi((s) => s.theme);
  return useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(NAMES.map((n) => [n, `rgb(${cs.getPropertyValue(`--${n}`).trim().replace(/ /g, ",")})`])) as Tokens;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}
export const alpha = (rgb: string, a: number) => rgb.replace("rgb(", "rgba(").replace(")", `,${a})`);
