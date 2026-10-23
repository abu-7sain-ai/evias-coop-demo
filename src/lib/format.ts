// Numbers are always Latin digits (0-9) in both languages; money has 3 decimals (spec/01-SPEC.md §1).
import i18n from "../i18n";
import type { Named } from "./types";

const nf = (dp: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const fmtNum = (n: number | null | undefined, dp = 0) => (n == null || Number.isNaN(n) ? "—" : nf(dp).format(n));
export const fmtKd = (n: number | null | undefined, lang: string) => (n == null ? "—" : `${nf(3).format(n)} ${i18n.t("common.kd", { lng: lang })}`);
export const fmtPct = (n: number | null | undefined, dp = 1) => (n == null ? "—" : `${nf(dp).format(n)}%`);
export const nameOf = (x: Partial<Named> | undefined | null, lang: string) => (x ? (lang === "ar" ? x.name_ar : x.name_en) ?? x.name_en ?? "" : "");
export const pick = <T extends Record<string, unknown>>(x: T, base: string, lang: string) => String(x[`${base}_${lang}`] ?? x[`${base}_en`] ?? "");
const ARABIC = new RegExp(`[${String.fromCharCode(0x600)}-${String.fromCharCode(0x6ff)}]`);
export const isArabic = (s: string) => ARABIC.test(s);
