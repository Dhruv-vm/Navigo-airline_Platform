"use client";

import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import FlightDetailsModal from "@/components/FlightDetailsModal"

type Flight = {
  airline: string;
  origin: string;
  destination: string;
  departure_time: string;
  arrival_time: string;
  price: number;
  duration: string;
  aircraft: string;
  stops?: number;
  tag?: string;
  passengers?: number;
};

const airlineLogos: Record<string, string> = {
  "IndiGo": "/airlines/indigo.png",
  "Air India": "/airlines/airindia.png",
  "Vistara": "/airlines/vistara.png",
  "Akasa Air": "/airlines/akasa.png",
  "Emirates": "/airlines/emirates.png",
  "Qatar Airways": "/airlines/qatar.png",
  "Japan Airlines": "/airlines/jal.png",
  "Singapore Airlines": "/airlines/singapore.png",
  "Singapore": "/airlines/singapore.png",
  "SIA": "/airlines/singapore.png",
  "Navigo Airlines": "/logo.png",
  "Navigo": "/logo.png",
};

// Premium jewel-tone tag treatment — each tag reads as a small emblem
// rather than a flat sticker.
const tagStyles: Record<string, string> = {
  best: "from-amber-300 via-yellow-400 to-amber-500 text-black shadow-[0_0_16px_rgba(251,191,36,0.45)]",
  cheapest: "from-emerald-300 via-emerald-400 to-teal-500 text-black shadow-[0_0_16px_rgba(52,211,153,0.4)]",
  fastest: "from-sky-300 via-cyan-400 to-blue-500 text-black shadow-[0_0_16px_rgba(56,189,248,0.4)]",
  value: "from-fuchsia-300 via-purple-400 to-violet-500 text-black shadow-[0_0_16px_rgba(192,132,252,0.4)]",
};

// ✅ FIXED — DB stores departure_time / arrival_time as plain "HH:MM:SS"
// (Postgres `time` column), NOT as ISO datetime strings. `new Date("06:00:00")`
// is an Invalid Date, which silently produced "--:--" for every flight.
// We now parse the "HH:MM(:SS)?" shape directly, and only fall back to
// `Date` parsing for full ISO datetime strings (in case that format is
// used elsewhere / in the future).
function formatTime(timeStr?: string) {
  if (!timeStr) return "--:--";

  const timeOnlyMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeOnlyMatch) {
    const hours = Number(timeOnlyMatch[1]);
    const minutes = timeOnlyMatch[2];
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHour}:${minutes} ${period}`;
  }

  // Fallback: try parsing as a full ISO datetime string
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "--:--";

  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStopsText(stops?: number) {
  if (!stops || stops === 0) return "Non-stop";
  if (stops === 1) return "1 Stop • BOM";
  return `${stops} Stops`;
}

export default function FlightCard({
  flight,
  onSelect,
  isSelected,
  isCheapest,
}: {
  flight: Flight;
  onSelect?: () => void;
  isSelected?: boolean;
  isCheapest?: boolean;
}) {
  const logo = airlineLogos[flight.airline] || "/logo.png";

  const pax = flight.passengers || 1;

  const basePrice = Number(flight.price ?? 0);
  const safePrice = basePrice > 0 ? basePrice : 5000;

  const totalPrice = safePrice * pax;

  const tagKey = flight.tag?.toLowerCase().replace(/\s+/g, "");
  const tagGradient =
    (tagKey && tagStyles[tagKey]) || "from-blue-300 via-cyan-400 to-blue-400 text-black";

  // Drives the logo scale-in and the timeline "draw" on first mount.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Real click-position ripple on the Select button.
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const spawnRipple = (e: ReactMouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
  };

  // "Details" opens an info-only modal — doesn't select or navigate.
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
    <div
      onClick={onSelect}
      className={`
        relative overflow-hidden
        bg-[radial-gradient(140%_140%_at_0%_0%,#111a2e_0%,#0b1220_45%,#070b16_100%)]
        border rounded-[24px] sm:rounded-[28px] px-4 sm:px-6 py-4 sm:py-5
        transition-all duration-300 ease-out
        cursor-pointer group
        backdrop-blur-sm

        ${
          isSelected
            ? "border-amber-300/60 ring-1 ring-amber-300/40 scale-[1.01] shadow-[0_0_50px_rgba(251,191,36,0.18)]"
            : "border-white/[0.07] shadow-[0_10px_40px_rgba(0,0,0,0.35)] hover:border-amber-300/30 hover:-translate-y-[3px] hover:shadow-[0_16px_50px_rgba(0,0,0,0.45)]"
        }
      `}
    >
      {/* hairline top accent — the card's "trim" */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
          isSelected ? "via-amber-300/80" : "via-white/20 group-hover:via-amber-300/50"
        } to-transparent transition-colors duration-300`}
      />

      {/* soft ambient glow on hover */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 bg-amber-400/0 group-hover:bg-amber-400/[0.06] blur-3xl rounded-full transition-all duration-500" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-64 h-64 bg-cyan-400/0 group-hover:bg-cyan-400/[0.05] blur-3xl rounded-full transition-all duration-500" />

      {/* TOP ROW */}
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-[11px] tracking-wide px-3 py-0.5 bg-white/[0.06] border border-white/[0.06] rounded-full text-gray-300 font-medium truncate max-w-[220px]">
            {flight.aircraft}
          </span>

          {flight.tag && (
            <span
              className={`text-[10px] uppercase tracking-widest font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r ${tagGradient}`}
            >
              {flight.tag}
            </span>
          )}

          {isSelected && (
            <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-black shadow-[0_0_12px_rgba(251,191,36,0.35)] flex items-center gap-1">
              ✓ Selected
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setDetailsOpen(true);
          }}
          className="group/details text-[11px] text-amber-300/80 hover:text-amber-200 tracking-wide font-medium transition-colors flex items-center gap-1 shrink-0"
        >
          Details <span className="inline-block transition-transform duration-200 group-hover/details:translate-x-1">→</span>
        </button>
      </div>

      {/* MAIN CONTENT: Flight Details (Left) + Divider + Fare & Action (Right) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">

        {/* LEFT FLIGHT DETAILS: Airline Info + Schedule */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 lg:gap-5 flex-1 min-w-0 pr-0 md:pr-4">

          {/* Airline Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-[120px] sm:min-w-[130px] max-w-[145px]">
            <div className="w-10 h-10 rounded-xl bg-white/95 flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.3)] ring-1 ring-white/10 overflow-hidden shrink-0 transition-transform duration-300 group-hover:scale-105">
              <img src={logo} className="w-6 h-6 object-contain" alt={flight.airline} />
            </div>

            <div className="min-w-0">
              <p className="font-display font-bold text-sm tracking-tight text-white leading-tight truncate" title={flight.airline}>
                {flight.airline}
              </p>
              <p className="font-board text-[11px] text-gray-400 tracking-wider whitespace-nowrap mt-0.5">
                {flight.origin} <span className="text-amber-300/70">→</span> {flight.destination}
              </p>
            </div>
          </div>

          {/* Schedule / Timeline */}
          <div className="flex items-center justify-between sm:justify-start md:justify-center gap-2 sm:gap-3 flex-1 min-w-0">

            {/* DEPART */}
            <div className="text-right shrink-0">
              <p className="font-display text-base sm:text-lg lg:text-xl font-extrabold tabular-nums text-white whitespace-nowrap">
                {formatTime(flight.departure_time)}
              </p>
              <p className="font-board text-[11px] sm:text-xs text-slate-300 tracking-wider uppercase mt-0.5 font-bold">{flight.origin}</p>
            </div>

            {/* TIMELINE BAR */}
            <div className="flex flex-col items-center flex-1 min-w-[44px] max-w-[110px] px-1 sm:px-2">
              <p className="text-[10px] sm:text-[11px] text-gray-300 mb-1 font-semibold tracking-wide whitespace-nowrap">
                {flight.duration || "--"}
              </p>

              <div className="relative w-full h-[2px] bg-white/15 rounded-full flex items-center">
                <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-r from-amber-300/80 via-cyan-300/80 to-amber-300/80 rounded-full" />
                <div className="absolute -left-1 w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_8px_rgba(252,211,77,0.8)]" />
                <div className="absolute left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full ring-2 ring-cyan-400/50" />
                <div className="absolute -right-1 w-2 h-2 bg-amber-300 rounded-full shadow-[0_0_8px_rgba(252,211,77,0.8)]" />
              </div>

              <p className="text-[10px] text-gray-400 mt-1.5 tracking-wide whitespace-nowrap font-medium">
                {getStopsText(flight.stops)}
              </p>
            </div>

            {/* ARRIVAL */}
            <div className="shrink-0 text-left">
              <p className="font-display text-base sm:text-lg lg:text-xl font-extrabold tabular-nums text-white whitespace-nowrap">
                {formatTime(flight.arrival_time)}
              </p>
              <p className="font-board text-[11px] sm:text-xs text-slate-300 tracking-wider uppercase mt-0.5 font-bold">{flight.destination}</p>
            </div>

          </div>

        </div>

        {/* VERTICAL DIVIDER — desktop */}
        <div className="self-stretch w-px hidden md:block border-l border-dashed border-white/20 mx-3 lg:mx-4 shrink-0" aria-hidden="true" />

        {/* HORIZONTAL DIVIDER — mobile */}
        <div className="w-full h-px md:hidden border-t border-dashed border-white/15 my-3" aria-hidden="true" />

        {/* RIGHT: Fare & Action */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 w-full md:w-[150px] lg:w-[160px] pl-0 md:pl-2">

          <div className="text-left md:text-right min-w-0 pr-2 md:pr-0">
            <div className="flex items-center gap-1.5 mb-0.5 justify-start md:justify-end">
              {isCheapest && (
                <span className="cheapest-shimmer text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-emerald-400/15 text-emerald-300 border border-emerald-400/25">
                  Best price
                </span>
              )}
              <p className="text-[10px] uppercase tracking-widest text-gray-400 whitespace-nowrap font-semibold">Total fare</p>
            </div>

            <p className="price-glow font-display text-2xl lg:text-[1.75rem] leading-tight font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-400 tabular-nums whitespace-nowrap">
              ₹{totalPrice.toLocaleString()}
            </p>

            <p className="text-[11px] text-gray-400 whitespace-nowrap mt-0.5">
              ₹{safePrice.toLocaleString()} × {pax} {pax > 1 ? "passengers" : "passenger"}
            </p>

            <p className="text-[10px] sm:text-[11px] text-[#E8C766] font-semibold whitespace-nowrap mt-0.5 flex items-center gap-1 justify-start md:justify-end">
              <span>🪙</span> Earn +{Math.max(120, Math.round(safePrice * 0.04))} pts
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
            onMouseDown={spawnRipple}
            className={`select-btn relative overflow-hidden shrink-0 mt-0 md:mt-3 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-semibold text-xs sm:text-sm tracking-wide whitespace-nowrap transition-all duration-200
            ${isSelected
              ? "bg-white/[0.06] text-amber-300 border border-amber-300/40"
              : "pill-cta hover:scale-[1.03]"
            }`}
          >
            {ripples.map((rp) => (
              <span key={rp.id} className="btn-ripple absolute" style={{ left: rp.x, top: rp.y }} />
            ))}
            {!isSelected && <span className="select-shine absolute inset-0" aria-hidden />}
            <span className="relative">{isSelected ? "Selected ✓" : "Select flight"}</span>
          </button>
        </div>

      </div>

      {/* ICON ROW */}
      <div className="flex items-center gap-2 sm:gap-2.5 mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-white/[0.06] text-gray-400 text-[10.5px] sm:text-[11px] tracking-wide flex-wrap">
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03]">📶 Wifi</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03]">🧳 15kg Check-in</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03]">💺 Seat Select</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03]">🍽️ Meal Options</span>
        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20 font-semibold sm:ml-auto">
          🪙 Rewards Eligible
        </span>
      </div>

      <style jsx>{`
        .select-shine::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0; left: -60%;
          width: 40%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.35), transparent);
          transform: skewX(-20deg);
          animation: selectShineSweep 3.2s ease-in-out infinite;
        }
        @keyframes selectShineSweep {
          0% { left: -60%; }
          55%, 100% { left: 130%; }
        }

        /* Low-intensity glow pulse on every price */
        @keyframes priceGlowPulse {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(251,191,36,0.18)); }
          50% { filter: drop-shadow(0 0 20px rgba(251,191,36,0.32)); }
        }
        .price-glow { animation: priceGlowPulse 2.8s ease-in-out infinite; }

        /* Green shimmer specifically for the cheapest fare on screen */
        .cheapest-shimmer {
          position: relative;
          overflow: hidden;
        }
        .cheapest-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(100deg, transparent, rgba(52,211,153,0.4), transparent);
          transform: translateX(-100%);
          animation: cheapestShimmerSweep 2.4s ease-in-out infinite;
        }
        @keyframes cheapestShimmerSweep {
          0% { transform: translateX(-100%); }
          60%, 100% { transform: translateX(100%); }
        }

        /* Real click-position ripple on the Select button */
        .btn-ripple {
          width: 10px; height: 10px;
          border-radius: 50%;
          background: rgba(255,255,255,0.55);
          transform: translate(-50%, -50%) scale(0);
          pointer-events: none;
          animation: btnRippleExpand 600ms ease-out forwards;
        }
        @keyframes btnRippleExpand {
          to { transform: translate(-50%, -50%) scale(14); opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .select-shine::after, .price-glow, .cheapest-shimmer::after, .btn-ripple {
            animation: none !important;
          }
        }
      `}</style>
    </div>

    {detailsOpen && (
      <FlightDetailsModal
        flight={flight}
        totalPrice={totalPrice}
        safePrice={safePrice}
        pax={pax}
        onClose={() => setDetailsOpen(false)}
      />
    )}
    </>
  );
}