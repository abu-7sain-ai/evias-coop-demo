import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, Tabs, ViewHeader, cx } from "../../components/ui";
import { fmtNum, nameOf } from "../../lib/format";
import * as M from "../../lib/metrics";
import type { Day, Fixture } from "../../lib/types";
import { alpha, useTokens, type Tokens } from "../../lib/useTokens";
import { useD } from "../../store/data";
import { useUi } from "../../store/ui";
import { FixturePanel } from "./FixturePanel";

type Layer = "supplier" | "stock" | "expiry" | "traffic" | "contracts";
const LAYERS: Layer[] = ["supplier", "stock", "expiry", "traffic", "contracts"];
// supplier colours: distinct hues that read on both themes
const PALETTE = ["#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD", "#8C564B", "#E377C2", "#BCBD22", "#17BECF", "#6A3D9A", "#B15928", "#F4A6A6"];
const SHELF_TYPES = new Set(["gondola", "endcap", "chiller", "freezer"]);

export function StoreMap() {
  const { t } = useTranslation();
  const d = useD();
  const { lang } = useUi();
  const tok = useTokens();
  const [floor, setFloor] = useState<"G" | "M">("G");
  const [layer, setLayer] = useState<Layer>("supplier");
  const [day, setDay] = useState<Day>("Thu");
  const [hour, setHour] = useState(20);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<{ f: Fixture; x: number; y: number } | null>(null);
  const B1 = M.mappedBranch(d);

  const maps = useMemo(() => {
    const supplierOf = new Map(d.shelf_reservations.map((r) => [r.fixture_id, r.supplier_id]));
    const supColor = new Map([...new Set(d.shelf_reservations.map((r) => r.supplier_id))].map((s, i) => [s, PALETTE[i % PALETTE.length]]));
    const stock = new Map<string, "empty" | "low" | "ok">();
    for (const s of d.stock_locations.filter((x) => x.branch_id === B1)) {
      const cur = stock.get(s.fixture_id);
      const st = s.status as "empty" | "low" | "ok";
      if (!cur || st === "empty" || (st === "low" && cur === "ok")) stock.set(s.fixture_id, st);
    }
    const today = M.demoDate(d);
    const soon = new Map<string, number>(); // product → min days to expiry at B1
    for (const l of d.lots.filter((x) => x.branch_id === B1 && x.expiry >= today)) { const n = M.daysBetween(today, l.expiry); soon.set(l.product_id, Math.min(n, soon.get(l.product_id) ?? 999)); }
    const expiry = new Map<string, number>();
    for (const s of d.stock_locations.filter((x) => x.branch_id === B1)) { const n = soon.get(s.product_id); if (n != null) expiry.set(s.fixture_id, Math.min(n, expiry.get(s.fixture_id) ?? 999)); }
    const spaceStatus = new Map(d.spaces.map((s) => [s.id, s.status]));
    const tMax = Math.max(...d.traffic.map((x) => x.score));
    return { supplierOf, supColor, stock, expiry, spaceStatus, tMax };
  }, [d, B1]);
  const traffic = useMemo(() => M.trafficLayer(d, day, hour), [d, day, hour]);
  const queue = M.queuePerLane(d, day, hour, 6);

  const fixtures = d.floorplan.fixtures.filter((f) => f.floor === floor && !(f.type === "ad" && layer !== "contracts"));
  const fill = (f: Fixture): { fill: string; hatch?: boolean } => {
    const neutral = { fill: alpha(tok["text-2"], 0.12) };
    if (["warehouse", "office", "escalator", "service", "zone", "entrance"].includes(f.type) && layer !== "traffic") return { fill: alpha(tok["text-2"], f.type === "zone" || f.type === "entrance" ? 0.06 : 0.18) };
    switch (layer) {
      case "supplier": { if (!SHELF_TYPES.has(f.type)) return neutral; const s = maps.supplierOf.get(f.id); return { fill: s ? maps.supColor.get(s)! : alpha(tok["text-2"], 0.25) }; }
      case "stock": { const s = maps.stock.get(f.id); return s ? { fill: alpha(s === "empty" ? tok.bad : s === "low" ? tok.warn : tok.good, 0.75) } : neutral; }
      case "expiry": { const n = maps.expiry.get(f.id); return n == null || n > 14 ? (SHELF_TYPES.has(f.type) ? { fill: alpha(tok.good, 0.25) } : neutral) : { fill: alpha(n <= 7 ? tok.bad : tok.warn, 0.8) }; }
      case "traffic": { const v = traffic.get(f.id); if (v == null) return { fill: alpha(tok["text-2"], 0.06) }; const r = v / maps.tMax; return { fill: alpha(r > 0.75 ? tok.bad : r > 0.45 ? tok.warn : tok.accent, 0.15 + 0.85 * r) }; }
      case "contracts": { const s = maps.spaceStatus.get(f.id) ?? f.status; if (!s) return neutral; return { fill: alpha(s === "leased" ? tok.good : s === "expiring" ? tok.warn : s === "arrears" ? tok.bad : tok.info, s === "available" ? 0.35 : 0.7), hatch: s === "reserved" }; }
    }
  };

  return (
    <div className="space-y-4">
      <ViewHeader title={t("nav.map")} subtitle={t("map.subtitle", { branch: nameOf(d.branches.find((b) => b.id === B1), lang) })}
        actions={<Tabs testId="floor-tabs" value={floor} onChange={(v) => { setFloor(v); if (v === "M" && layer !== "traffic") setLayer("contracts"); if (v === "G" && layer === "contracts") setLayer("supplier"); }} tabs={[{ key: "G", label: t("map.ground") }, { key: "M", label: t("map.mezzanine") }]} />} />
      <Card bodyClass="p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2" data-testid="layer-chips">
          <span className="text-xs text-text-2">{t("map.layers")}:</span>
          {LAYERS.map((l) => (
            <button key={l} data-testid={`layer-${l}`} onClick={() => setLayer(l)} aria-pressed={layer === l}
              className={cx("chip", layer === l ? "bg-accent text-white border-accent" : "hover:bg-surface-2")}>{t(`map.layer.${l}`)}</button>
          ))}
        </div>
        {layer === "traffic" && (
          <div className="flex flex-wrap items-center gap-3" data-testid="traffic-controls">
            <div className="flex flex-wrap gap-1">
              {M.DAYS.map((dd) => <button key={dd} data-testid={`day-${dd}`} onClick={() => setDay(dd)} className={cx("chip", day === dd && "bg-accent-soft text-accent border-accent")}>{t(`days.${dd}`)}</button>)}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-text-2">{t("map.hour")}</span>
              <input data-testid="hour-slider" type="range" min={8} max={23} value={hour} onChange={(e) => setHour(+e.target.value)} className="w-40 accent-[rgb(var(--accent))]" />
              <span className="num font-medium w-12" dir="ltr">{String(hour).padStart(2, "0")}:00</span>
            </label>
            <Badge tone={queue > M.QUEUE_ALERT ? "bad" : "muted"}>{t("map.queue", { n: fmtNum(queue, 1) })}</Badge>
          </div>
        )}
        <div className="relative" dir="ltr">
          <svg viewBox="-0.5 -0.5 61 31" className="w-full h-auto select-none" role="img" aria-label={t("map.svgLabel")} data-testid="floor-svg" data-floor={floor} data-layer={layer}>
            <defs>
              <pattern id="hatch" width="0.6" height="0.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="0.6" stroke={tok.info} strokeWidth="0.25" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="60" height="30" fill={tok.surface} stroke={tok["text-2"]} strokeWidth="0.15" />
            {floor === "M" && <rect x="24" y="9" width="12" height="12" fill={alpha(tok["text-2"], 0.05)} stroke={tok.border} strokeDasharray="0.4 0.3" strokeWidth="0.08" />}
            {[...fixtures].sort((a, b) => layerOrder(a) - layerOrder(b)).map((f) => {
              const st = fill(f);
              const clickable = f.type !== "zone";
              const lb = labelFor(f, floor);
              const pos = LABEL_POS[f.id];
              const vertical = !pos && f.h > f.w * 2.5;
              const len = vertical ? f.h : f.w;
              const fs = lb ? Math.min(pos ? 0.8 : f.type === "gondola" ? 0.6 : 0.85, (len * 0.85) / (lb.length * 0.62), (vertical ? f.w : f.h) * 0.7) : 0;
              const cx = pos ? pos[0] : f.x + f.w / 2, cy = pos ? pos[1] : f.y + f.h / 2;
              return (
                <g key={f.id} data-id={f.id} className={clickable ? "cursor-pointer" : undefined}
                  onClick={clickable ? () => setSelected(f.id) : undefined}
                  onMouseMove={(e) => { const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setHover({ f, x: e.clientX - r.left, y: e.clientY - r.top }); }}
                  onMouseLeave={() => setHover(null)}>
                  <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={0.12} fill={st.fill} stroke={selected === f.id ? tok.text : tok.border} strokeWidth={selected === f.id ? 0.18 : 0.06} />
                  {st.hatch && <rect x={f.x} y={f.y} width={f.w} height={f.h} fill="url(#hatch)" pointerEvents="none" />}
                  {lb && <text x={cx} y={cy} fontSize={fs} textAnchor="middle" dominantBaseline="central" fill={tok.text} pointerEvents="none" transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined} style={{ fontFamily: "IBM Plex Sans, sans-serif" }}>{lb}</text>}
                </g>
              );
            })}
          </svg>
          {hover && (
            <div className="pointer-events-none absolute z-10 rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-md" style={{ left: hover.x + 12, top: hover.y + 12 }} dir={lang === "ar" ? "rtl" : "ltr"} data-testid="map-tooltip">
              <span className="font-mono">{hover.f.id}</span> · {nameOf(hover.f, lang)}
              {layer === "traffic" && traffic.get(hover.f.id) != null && <span className="num"> · {traffic.get(hover.f.id)}</span>}
            </div>
          )}
        </div>
        <Legend layer={layer} tok={tok} supColor={maps.supColor} />
      </Card>
      <FixturePanel id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const labelFor = (f: Fixture, floor: "G" | "M") => {
  if (f.type === "zone" || f.type === "ad") return f.type === "zone" ? "" : f.id;
  if (floor === "M") return f.id;
  if (f.type === "endcap") return "";
  if (f.type === "gondola") return f.id;
  if (f.type === "entrance" && f.w < 2) return "";
  return f.id;
};
// Background areas are drawn first so shelves sit on top of them (the spec geometry overlaps WH-01 / DELI / BAK with gondola rows).
const BACKGROUND = new Set(["warehouse", "office", "counter", "zone"]);
const layerOrder = (f: Fixture) => (BACKGROUND.has(f.type) ? 0 : 1);
// Label positions inside the free part of areas that shelves overlap.
const LABEL_POS: Record<string, [number, number]> = { "WH-01": [2.6, 9.3], "OFF": [2.6, 15.3], "DELI": [48, 6.3], "BAK": [58.5, 6.3], "WH-COLD": [14, 2.2] };

function Legend({ layer, tok, supColor }: { layer: Layer; tok: Tokens; supColor: Map<string, string> }) {
  const { t } = useTranslation();
  const d = useD();
  const { lang } = useUi();
  const item = (color: string, label: string, hatch = false) => (
    <span key={label} className="inline-flex items-center gap-1.5 text-xs">
      <span className="inline-block h-3 w-3 rounded-sm border border-border" style={{ background: hatch ? `repeating-linear-gradient(45deg, ${color}, ${color} 2px, transparent 2px, transparent 4px)` : color }} />{label}
    </span>
  );
  let items: JSX.Element[] = [];
  if (layer === "supplier") items = [...[...supColor].map(([s, c]) => item(c, `${s} ${nameOf(d.suppliers.find((x) => x.id === s), lang)}`)), item(alpha(tok["text-2"], 0.25), t("map.legend.unreserved"))];
  if (layer === "stock") items = [item(tok.good, t("stock.ok")), item(tok.warn, t("stock.low")), item(tok.bad, t("stock.empty"))];
  if (layer === "expiry") items = [item(tok.bad, t("map.legend.le7")), item(tok.warn, t("map.legend.le14")), item(alpha(tok.good, 0.4), t("map.legend.gt14"))];
  if (layer === "traffic") items = [item(alpha(tok.accent, 0.4), t("map.legend.low")), item(tok.warn, t("map.legend.mid")), item(tok.bad, t("map.legend.high"))];
  if (layer === "contracts") items = [item(alpha(tok.info, 0.5), t("status.available")), item(tok.info, t("status.reserved"), true), item(tok.good, t("status.leased")), item(tok.warn, t("status.expiring")), item(tok.bad, t("status.arrears")), item(alpha(tok["text-2"], 0.18), t("map.legend.service"))];
  return <div className="flex flex-wrap gap-x-4 gap-y-1.5" data-testid="map-legend">{items}</div>;
}
