import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Send,
  Bot,
  Siren,
  CheckCircle2,
  Radio,
  CalendarClock,
  Grid3x3,
  Gauge,
  Target,
  Droplets,
  Route,
  Info,
  TriangleAlert,
  Satellite,
} from "lucide-react";

/* ----------------------------------------------------------------------- */
/* Deterministic pseudo-random helper (seeded) so each region's simulated  */
/* raster + zone data is stable across renders instead of re-rolling.      */
/* ----------------------------------------------------------------------- */
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h;
}

/* ----------------------------------------------------------------------- */
/* Region + zone dataset                                                    */
/* ----------------------------------------------------------------------- */
const REGIONS = [
  {
    id: "pune",
    name: "Pune–PCMC Corridor",
    short: "Pune-PCMC",
    coords: "18.62° N, 73.80° E",
    basin: "Mula-Mutha Alluvial Aquifer",
    zones: [
      { id: "PC-04", name: "Chikhali Industrial Belt", rate: 34.2, r: 0.91, assets: ["Water pipeline", "MIDC road network"], pop: 48200 },
      { id: "PC-11", name: "Moshi Informal Settlement", rate: 41.7, r: 0.89, assets: ["Informal housing", "Storm drain"], pop: 22750 },
      { id: "PC-07", name: "Ravet Borewell Cluster", rate: 27.9, r: 0.86, assets: ["Borewell field", "Overhead tank"], pop: 15600 },
      { id: "PC-02", name: "Hinjawadi IT Corridor", rate: 18.4, r: 0.9, assets: ["Fiber trunk line", "Flyover piers"], pop: 61200 },
    ],
  },
  {
    id: "latur",
    name: "Latur Basin",
    short: "Latur Basin",
    coords: "18.40° N, 76.58° E",
    basin: "Deccan Basalt Fractured Aquifer",
    zones: [
      { id: "LT-01", name: "Manjara Left Bank Farms", rate: 52.6, r: 0.93, assets: ["Irrigation canal", "Farm access roads"], pop: 9100 },
      { id: "LT-06", name: "Latur City Core", rate: 29.1, r: 0.88, assets: ["Municipal water main", "Rail spur"], pop: 84300 },
      { id: "LT-09", name: "Ausa Road Tanker Belt", rate: 46.3, r: 0.87, assets: ["Tanker fill point", "Rural housing"], pop: 13400 },
    ],
  },
  {
    id: "mumbai",
    name: "Mumbai Coastal Pocket",
    short: "Mumbai Coastal",
    coords: "19.04° N, 72.87° E",
    basin: "Coastal Reclaimed Fill Zone",
    zones: [
      { id: "MC-03", name: "Mahul Reclaimed Flats", rate: 23.5, r: 0.85, assets: ["Seawall", "LPG terminal access"], pop: 71500 },
      { id: "MC-08", name: "Kurla Rail Underpass", rate: 31.8, r: 0.9, assets: ["Suburban rail bed", "Underpass drainage"], pop: 56900 },
      { id: "MC-12", name: "Bandra Kurla Fringe", rate: 12.6, r: 0.88, assets: ["Commercial towers", "Metro viaduct"], pop: 38200 },
      { id: "MC-05", name: "Dharavi Creek Edge", rate: 44.9, r: 0.91, assets: ["Informal housing", "Sewage pumping station"], pop: 93700 },
    ],
  },
  {
    id: "sjv",
    name: "San Joaquin Valley",
    short: "San Joaquin",
    coords: "36.75° N, 119.77° W",
    basin: "Central Valley Alluvial Aquifer",
    zones: [
      { id: "SJ-14", name: "Corcoran Ag Belt", rate: 58.3, r: 0.95, assets: ["Friant-Kern Canal", "County levee"], pop: 6700 },
      { id: "SJ-22", name: "Fresno Well Field South", rate: 33.9, r: 0.9, assets: ["Municipal well field", "Irrigation pivots"], pop: 41800 },
      { id: "SJ-31", name: "Tulare Lakebed Fringe", rate: 49.5, r: 0.92, assets: ["Rail line", "Flood-control channel"], pop: 5200 },
    ],
  },
];

const LAYERS = [
  { id: "risk", label: "12-Month Subsidence Risk Surface", icon: Grid3x3 },
  { id: "extraction", label: "Groundwater Extraction Heatmap", icon: Droplets },
  { id: "infra", label: "Critical Infrastructure Overlay", icon: Route },
];

function riskBand(rate) {
  if (rate < 20) return "stable";
  if (rate < 40) return "moderate";
  return "severe";
}
const BAND_COLOR = {
  stable: "#3FA796",
  moderate: "#E0A63E",
  severe: "#C1452E",
};
const BAND_LABEL = {
  stable: "Stable",
  moderate: "Moderate Risk",
  severe: "Severe Subsidence",
};

/* ----------------------------------------------------------------------- */
/* NeuGen AI — lightweight intent matcher over the active region's data    */
/* ----------------------------------------------------------------------- */
function neuGenRespond(query, region) {
  const q = query.toLowerCase();
  const sorted = [...region.zones].sort((a, b) => b.rate - a.rate);
  const top = sorted[0];
  const severe = region.zones.filter((z) => riskBand(z.rate) === "severe");
  const stable = region.zones.filter((z) => riskBand(z.rate) === "stable");

  if (/(highest|worst|top).*(risk|zone|subsidence)|risk.*(next|quarter)/.test(q)) {
    return `In ${region.name}, ${top.name} (${top.id}) leads with a forecast rate of ${top.rate.toFixed(
      1
    )} mm/yr at r=${top.r.toFixed(2)} confidence. ${
      severe.length > 1
        ? `${severe.length - 1} other zone(s) also cross the severe threshold (>40 mm/yr): ${severe
            .filter((z) => z.id !== top.id)
            .map((z) => z.name)
            .join(", ")}.`
        : "It is currently the only zone in the severe band for this region."
    } Recommend prioritizing a field verification pass within the next reporting cycle.`;
  }
  if (/infrastructure|pipeline|road|asset|impact/.test(q)) {
    const assetSet = new Set();
    region.zones.forEach((z) => z.assets.forEach((a) => assetSet.add(a)));
    return `Cross-referencing the Critical Infrastructure Overlay for ${region.name}: ${assetSet.size} distinct asset classes intersect active risk polygons, including ${[...assetSet]
      .slice(0, 3)
      .join(", ")}. ${top.name} shows the highest combined exposure — ${top.assets.join(
      " and "
    )} — at a displacement rate of ${top.rate.toFixed(1)} mm/yr. Suggest routing an inspection crew before the next monitoring pass.`;
  }
  if (/housing|informal|population|people|residents/.test(q)) {
    const totalPop = region.zones.reduce((s, z) => s + z.pop, 0);
    return `Estimated population exposure across ${region.name} is ${totalPop.toLocaleString()} residents across ${region.zones.length} monitored zones. The largest single exposure is ${sorted.reduce((a, b) => (a.pop > b.pop ? a : b)).name} with ${sorted.reduce((a, b) => (a.pop > b.pop ? a : b)).pop.toLocaleString()} residents in the catchment.`;
  }
  if (/safe|stable|low.?risk|okay|fine/.test(q)) {
    return stable.length
      ? `${stable.length} zone(s) in ${region.name} currently sit in the stable band (<20 mm/yr): ${stable
          .map((z) => z.name)
          .join(", ")}. No dispatch action is recommended for these at this time.`
      : `No zones in ${region.name} currently fall in the stable band — every monitored zone is trending at moderate risk or above this forecast cycle.`;
  }
  if (/basin|aquifer|geology|why|cause/.test(q)) {
    return `${region.name} overlies the ${region.basin}. Subsidence here is primarily attributed to sustained groundwater drawdown outpacing aquifer recharge, consistent with the InSAR displacement trend feeding this forecast.`;
  }
  if (/report|export|summary|brief/.test(q)) {
    return `Summary for ${region.name}: ${region.zones.length} zones monitored, ${severe.length} in severe band, average forecast rate ${(
      region.zones.reduce((s, z) => s + z.rate, 0) / region.zones.length
    ).toFixed(1)} mm/yr. A full 10m GeoTIFF export and PDF briefing can be generated from the Municipal Action table below.`;
  }
  return `I track InSAR-derived displacement, groundwater extraction trends, and infrastructure exposure for ${region.name}. Try asking which zones carry the highest risk next quarter, how infrastructure is affected, or which areas remain stable.`;
}

const SUGGESTED_PROMPTS = [
  "Which zones are at highest risk next quarter?",
  "Show infrastructure impact in this region",
  "Which zones are currently stable?",
];

/* ----------------------------------------------------------------------- */
/* Top navigation                                                          */
/* ----------------------------------------------------------------------- */
function TopNav({ region, setRegionId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="border-b border-ink-600 bg-ink-950/80 backdrop-blur sticky top-0 z-30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-ink-700 border border-ink-500 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
              <circle cx="12" cy="12" r="9.5" stroke="#2FB8AC" strokeWidth="1.1" opacity="0.5" />
              <circle cx="12" cy="12" r="6" stroke="#2FB8AC" strokeWidth="1.1" opacity="0.75" />
              <circle cx="12" cy="12" r="2.4" fill="#2FB8AC" />
            </svg>
          </div>
          <div className="leading-tight">
            <h1 className="font-semibold text-mist-100 text-[15px] sm:text-base tracking-tight">
              GeoSunk-AI <span className="text-mist-300 font-normal">· Bhu-Suraksha</span>
            </h1>
            <p className="text-[11px] text-mist-400 font-mono">Groundwater-Induced Subsidence Early Warning</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-survey-dim/50 bg-survey/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-survey opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-survey"></span>
            </span>
            <span className="text-xs font-mono text-survey-bright">Operational · 12-Month Forecast Horizon</span>
          </div>

          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md border border-ink-500 bg-ink-700 hover:bg-ink-600 transition-colors px-3 py-1.5 text-sm text-mist-100"
            >
              <Satellite className="w-3.5 h-3.5 text-survey" />
              {region.name}
              <ChevronDown className={`w-3.5 h-3.5 text-mist-300 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="absolute right-0 mt-1.5 w-64 rounded-md border border-ink-500 bg-ink-800 shadow-panel overflow-hidden z-40">
                {REGIONS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRegionId(r.id);
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm flex flex-col gap-0.5 hover:bg-ink-600 transition-colors ${
                      r.id === region.id ? "bg-ink-600/70" : ""
                    }`}
                  >
                    <span className="text-mist-100">{r.name}</span>
                    <span className="text-[11px] text-mist-400 font-mono">{r.coords}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------------------------------------------- */
/* Metric cards                                                            */
/* ----------------------------------------------------------------------- */
function MetricCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-ink-500 bg-ink-800/60 shadow-panel p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-md bg-ink-700 border border-ink-500 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5 text-survey" size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-mist-400 font-mono">{label}</p>
        <p className="text-lg font-semibold text-mist-100 leading-tight mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[11px] text-mist-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function MetricsRow() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <MetricCard icon={CalendarClock} label="Forecast Horizon" value="12 Months" sub="Rolling monthly refresh" />
      <MetricCard icon={Grid3x3} label="Pixel Resolution" value="10m GeoTIFF" sub="Sentinel-1 InSAR stack" />
      <MetricCard icon={Gauge} label="Speed Metric" value="mm / yr" sub="Vertical displacement rate" />
      <MetricCard icon={Target} label="Accuracy Target" value="0.88 Pearson r" sub="Validated vs. leveling data" />
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* GIS Map simulation                                                      */
/* ----------------------------------------------------------------------- */
function GISMap({ region, layers, toggleLayer }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  const cells = useMemo(() => {
    const rng = mulberry32(seedFromString(region.id + "-grid"));
    const cols = 14;
    const rows = 9;
    const out = [];
    // place zone "hotspots" so the grid visually relates to the risk table
    const hotspots = region.zones.map((z, i) => ({
      cx: 1.5 + rng() * (cols - 3),
      cy: 1 + rng() * (rows - 2),
      strength: z.rate,
      zone: z,
    }));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let val = 6 + rng() * 8; // baseline low noise
        hotspots.forEach((h) => {
          const d = Math.hypot(h.cx - x, h.cy - y);
          val += Math.max(0, h.strength - d * 9);
        });
        out.push({ x, y, val: Math.min(val, 62) });
      }
    }
    return { cells: out, cols, rows, hotspots };
  }, [region.id, region.zones]);

  const extractionBlobs = useMemo(() => {
    const rng = mulberry32(seedFromString(region.id + "-extraction"));
    return Array.from({ length: 6 }).map(() => ({
      cx: rng() * 100,
      cy: rng() * 100,
      r: 8 + rng() * 14,
    }));
  }, [region.id]);

  const infraLines = useMemo(() => {
    const rng = mulberry32(seedFromString(region.id + "-infra"));
    return Array.from({ length: 5 }).map(() => ({
      x1: rng() * 100,
      y1: rng() * 100,
      x2: rng() * 100,
      y2: rng() * 100,
    }));
  }, [region.id]);

  const cellW = 100 / cells.cols;
  const cellH = 100 / cells.rows;

  const onWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(2.4, Math.max(0.7, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  };

  const startDrag = (e) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: { ...pan } };
  };
  const onDrag = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.origin.x + dx, y: dragRef.current.origin.y + dy });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="rounded-lg border border-ink-500 bg-ink-800/60 shadow-panel overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-ink-600 flex-wrap">
        <div className="flex items-center gap-2 text-mist-200 text-sm font-medium">
          <Layers className="w-4 h-4 text-survey" />
          Raster View
          <span className="text-mist-400 font-mono text-[11px] ml-1">{region.coords}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LAYERS.map((l) => {
            const active = layers[l.id];
            const Icon = l.icon;
            return (
              <button
                key={l.id}
                onClick={() => toggleLayer(l.id)}
                className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border transition-colors ${
                  active
                    ? "border-survey-dim bg-survey/15 text-survey-bright"
                    : "border-ink-500 bg-ink-700/60 text-mist-400 hover:text-mist-200"
                }`}
              >
                <Icon className="w-3 h-3" />
                {l.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="relative bg-ink-900 h-[420px] select-none cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={startDrag}
        onMouseMove={onDrag}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        <div
          className="absolute inset-0 origin-center transition-transform duration-100 ease-out"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg viewBox="0 0 100 64" preserveAspectRatio="xMidYMid slice" className="w-full h-full">
            <defs>
              <pattern id="contourPattern" width="20" height="20" patternUnits="userSpaceOnUse">
                <path
                  d="M0 10 Q5 2 10 10 T20 10"
                  stroke="#1F2A3F"
                  strokeWidth="0.4"
                  fill="none"
                  opacity="0.6"
                />
              </pattern>
            </defs>
            <rect x="0" y="0" width="100" height="64" fill="#0B1220" />
            <rect x="0" y="0" width="100" height="64" fill="url(#contourPattern)" />

            {/* Risk raster layer */}
            {layers.risk &&
              cells.cells.map((c, i) => {
                const band = c.val < 20 ? "stable" : c.val < 40 ? "moderate" : "severe";
                const opacity = 0.18 + Math.min(c.val, 60) / 100;
                return (
                  <rect
                    key={i}
                    x={c.x * cellW}
                    y={c.y * (64 / cells.rows)}
                    width={cellW * 0.92}
                    height={(64 / cells.rows) * 0.92}
                    rx="0.6"
                    fill={BAND_COLOR[band]}
                    opacity={opacity}
                  />
                );
              })}

            {/* Groundwater extraction heatmap */}
            {layers.extraction &&
              extractionBlobs.map((b, i) => (
                <circle
                  key={i}
                  cx={(b.cx / 100) * 100}
                  cy={(b.cy / 100) * 64}
                  r={b.r * 0.4}
                  fill="#4AA3D9"
                  opacity="0.16"
                />
              ))}
            {layers.extraction &&
              extractionBlobs.map((b, i) => (
                <circle
                  key={"c" + i}
                  cx={(b.cx / 100) * 100}
                  cy={(b.cy / 100) * 64}
                  r="0.9"
                  fill="#4AA3D9"
                  opacity="0.85"
                />
              ))}

            {/* Critical infrastructure overlay */}
            {layers.infra &&
              infraLines.map((l, i) => (
                <line
                  key={i}
                  x1={(l.x1 / 100) * 100}
                  y1={(l.y1 / 100) * 64}
                  x2={(l.x2 / 100) * 100}
                  y2={(l.y2 / 100) * 64}
                  stroke="#E8ECF3"
                  strokeDasharray="1.4 1.2"
                  strokeWidth="0.35"
                  opacity="0.55"
                />
              ))}

            {/* Zone markers */}
            {cells.hotspots.map((h, i) => (
              <g key={i} transform={`translate(${(h.zone && h.cx * cellW) || 0}, ${h.cy * (64 / cells.rows)})`}>
                <circle r="1.1" fill={BAND_COLOR[riskBand(h.strength)]} stroke="#0B1220" strokeWidth="0.4" />
                <text x="1.8" y="0.5" fontSize="2.1" fill="#B7C0D1" fontFamily="IBM Plex Mono, monospace">
                  {h.zone.id}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Zoom / pan controls */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
          <button
            onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))}
            className="w-8 h-8 rounded-md bg-ink-800/90 border border-ink-500 flex items-center justify-center text-mist-200 hover:text-survey-bright hover:border-survey-dim transition-colors"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
            className="w-8 h-8 rounded-md bg-ink-800/90 border border-ink-500 flex items-center justify-center text-mist-200 hover:text-survey-bright hover:border-survey-dim transition-colors"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="w-8 h-8 rounded-md bg-ink-800/90 border border-ink-500 flex items-center justify-center text-mist-200 hover:text-survey-bright hover:border-survey-dim transition-colors"
            aria-label="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-[10px] text-mist-400 bg-ink-800/80 border border-ink-500 rounded-md px-2 py-1 font-mono">
          <Move className="w-3 h-3" /> drag to pan · scroll to zoom
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-ink-600 bg-ink-800/80 flex-wrap">
        {Object.entries(BAND_LABEL).map(([k, label]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs text-mist-300">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: BAND_COLOR[k] }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-mist-500 ml-auto font-mono">
          <Info className="w-3 h-3" /> zoom {zoom.toFixed(1)}x
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* NeuGen AI chat sidebar                                                   */
/* ----------------------------------------------------------------------- */
function ChatSidebar({ region }) {
  const [messages, setMessages] = useState(() => [
    {
      role: "assistant",
      text: `NeuGen AI online for ${region.name}. Ask about risk zones, infrastructure exposure, or stability outlook.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef(null);
  const prevRegion = useRef(region.id);

  useEffect(() => {
    if (prevRegion.current !== region.id) {
      prevRegion.current = region.id;
      setMessages((m) => [
        ...m,
        { role: "assistant", text: `Context switched to ${region.name}. Data reindexed — go ahead and ask a question.` },
      ]);
    }
  }, [region]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  const send = useCallback(
    (text) => {
      const q = (text ?? input).trim();
      if (!q) return;
      setMessages((m) => [...m, { role: "user", text: q }]);
      setInput("");
      setThinking(true);
      const delay = 450 + Math.random() * 500;
      setTimeout(() => {
        setMessages((m) => [...m, { role: "assistant", text: neuGenRespond(q, region) }]);
        setThinking(false);
      }, delay);
    },
    [input, region]
  );

  return (
    <div className="rounded-lg border border-ink-500 bg-ink-800/60 shadow-panel flex flex-col h-full min-h-[560px]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-600">
        <div className="w-7 h-7 rounded-md bg-survey/15 border border-survey-dim/60 flex items-center justify-center">
          <Bot className="w-4 h-4 text-survey-bright" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-medium text-mist-100">NeuGen AI</p>
          <p className="text-[11px] text-mist-400 font-mono">Spatial-language decision support</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto thin-scroll px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[88%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "bg-survey/20 border border-survey-dim/50 text-mist-100"
                  : "bg-ink-700 border border-ink-500 text-mist-200"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="bg-ink-700 border border-ink-500 rounded-lg px-3 py-2 flex items-center gap-1">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full bg-mist-400 animate-bounce"
                  style={{ animationDelay: `${d * 0.12}s` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {SUGGESTED_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            className="text-[11px] px-2 py-1 rounded-full border border-ink-500 text-mist-400 hover:text-survey-bright hover:border-survey-dim transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-center gap-2 p-3 border-t border-ink-600"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask NeuGen AI about this region…"
          className="flex-1 bg-ink-900 border border-ink-500 rounded-md px-3 py-2 text-sm text-mist-100 placeholder:text-mist-500 focus:outline-none focus:ring-1 focus:ring-survey-dim focus:border-survey-dim"
        />
        <button
          type="submit"
          className="w-9 h-9 shrink-0 rounded-md bg-survey/20 border border-survey-dim text-survey-bright hover:bg-survey/30 transition-colors flex items-center justify-center"
          aria-label="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* Municipal action / risk table                                           */
/* ----------------------------------------------------------------------- */
function RiskTable({ region }) {
  const [dispatched, setDispatched] = useState({});

  const toggle = (id) => {
    setDispatched((d) => ({
      ...d,
      [id]: d[id] ? null : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }));
  };

  const sorted = [...region.zones].sort((a, b) => b.rate - a.rate);

  return (
    <div className="rounded-lg border border-ink-500 bg-ink-800/60 shadow-panel overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-ink-600 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-mist-200">
          <TriangleAlert className="w-4 h-4 text-risk-moderate" />
          Municipal Action &amp; Risk Register — {region.short}
        </div>
        <p className="text-[11px] text-mist-400 font-mono">{sorted.length} zones monitored this cycle</p>
      </div>

      <div className="overflow-x-auto thin-scroll">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-mist-400 border-b border-ink-600">
              <th className="px-4 py-2.5 font-medium">Zone</th>
              <th className="px-4 py-2.5 font-medium">Predicted Rate</th>
              <th className="px-4 py-2.5 font-medium">Confidence</th>
              <th className="px-4 py-2.5 font-medium">Affected Assets</th>
              <th className="px-4 py-2.5 font-medium">Population</th>
              <th className="px-4 py-2.5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((z) => {
              const band = riskBand(z.rate);
              const isDispatched = Boolean(dispatched[z.id]);
              return (
                <tr key={z.id} className="border-b border-ink-700 last:border-b-0 hover:bg-ink-700/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BAND_COLOR[band] }} />
                      <div>
                        <p className="text-mist-100 font-medium leading-tight">{z.name}</p>
                        <p className="text-[11px] text-mist-500 font-mono">{z.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-mist-100">{z.rate.toFixed(1)}</span>
                    <span className="text-mist-500 text-[11px] ml-1">mm/yr</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-mist-300">r={z.r.toFixed(2)}</td>
                  <td className="px-4 py-3 text-mist-300">
                    <div className="flex flex-wrap gap-1">
                      {z.assets.map((a) => (
                        <span key={a} className="text-[11px] px-1.5 py-0.5 rounded bg-ink-700 border border-ink-500 text-mist-300">
                          {a}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-mist-300">{z.pop.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggle(z.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                        isDispatched
                          ? "border-survey-dim bg-survey/15 text-survey-bright"
                          : band === "severe"
                          ? "border-risk-severe/70 bg-risk-severe/15 text-risk-severe hover:bg-risk-severe/25"
                          : "border-ink-500 bg-ink-700 text-mist-300 hover:text-mist-100"
                      }`}
                    >
                      {isDispatched ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Dispatched {dispatched[z.id]}
                        </>
                      ) : (
                        <>
                          <Siren className="w-3.5 h-3.5" />
                          Trigger Alert
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/* App root                                                                 */
/* ----------------------------------------------------------------------- */
export default function App() {
  const [regionId, setRegionId] = useState(REGIONS[0].id);
  const [layers, setLayers] = useState({ risk: true, extraction: false, infra: false });
  const region = useMemo(() => REGIONS.find((r) => r.id === regionId), [regionId]);

  const toggleLayer = (id) => setLayers((l) => ({ ...l, [id]: !l[id] }));

  return (
    <div className="min-h-screen bg-contour">
      <TopNav region={region} setRegionId={setRegionId} />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 space-y-5">
        <MetricsRow />

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-stretch">
          <GISMap region={region} layers={layers} toggleLayer={toggleLayer} />
          <ChatSidebar region={region} />
        </div>

        <RiskTable region={region} />

        <footer className="text-center text-[11px] text-mist-500 font-mono py-4">
          GeoSunk-AI · Bhu-Suraksha — simulated InSAR-derived forecast for demonstration purposes. Not for operational
          decision-making.
        </footer>
      </main>
    </div>
  );
}
