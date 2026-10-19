"use client";

import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { motion } from "framer-motion";
import FlightDetailsModal from "@/components/FlightDetailsModal";

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

const tagStyles: Record<string, string> = {
  best: "from-amber-300 via-yellow-400 to-amber-500 text-black shadow-[0_0_16px_rgba(251,191,36,0.45)]",
  cheapest: "from-emerald-300 via-emerald-400 to-teal-500 text-black shadow-[0_0_16px_rgba(52,211,153,0.4)]",
  fastest: "from-sky-300 via-cyan-400 to-blue-500 text-black shadow-[0_0_16px_rgba(56,189,248,0.4)]",
  value: "from-fuchsia-300 via-purple-400 to-violet-500 text-black shadow-[0_0_16px_rgba(192,132,252,0.4)]",
};

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

  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const spawnRipple = (e: ReactMouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 650);
  };

  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <>
    <motion.div
      onClick={onSelect}
      whileHover={{ y: -3, scale: 1.006 }}
      whileTap={{ scale: 0.995 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`
        relative overflow-hidden
        bg-gradient-to-br from-[#0F1D32]/95 via-[#0A1424]/98 to-[#060B14]/98
        border rounded-[24px] sm:rounded-[28px] px-4 sm:px-6 py-4 sm:py-5
        transition-colors duration-300 ease-out
        cursor-pointer group
        backdrop-blur-xl ticket-edge

        ${
          isSelected
            ? "border-amber-400/60 ring-2 ring-amber-400/30 shadow-[0_0_50px_rgba(251,191,36,0.22)] bg-gradient-to-br from-[#13233D] via-[#0C1729] to-[#070D18]"
            : "border-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.45)] hover:border-amber-400/35 hover:shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_25px_rgba(251,191,36,0.12)]"
        }
      `}
    >
      {/* Top dynamic accent hairline */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${
          isSelected ? "via-amber-300 to-amber-500" : "via-white/15 group-hover:via-amber-400/60"
        } to-transparent transition-all duration-300`}
      />

      {/* Ambient background glow blooms */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 bg-amber-400/0 group-hover:bg-amber-400/[0.07] blur-3xl rounded-full transition-all duration-500" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 w-56 h-56 bg-cyan-400/0 group-hover:bg-cyan-400/[0.06] blur-3xl rounded-full transition-all duration-500" />

      {/* TOP ROW: Aircraft badge + Telemetry + Details button */}
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] tracking-wide px-3 py-1 bg-white/[0.05] border border-white/[0.08] rounded-full text-slate-300 font-medium truncate max-w-[220px] shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-[10px] uppercase tracking-wider font-extrabold px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.45)] flex items-center gap-1"
            >
              <span>✓</span> Selected
            </motion.span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setDetailsOpen(true);
          }}
          className="group/details text-[11px] text-amber-300/90 hover:text-amber-200 tracking-wide font-medium transition-colors flex items-center gap-1.5 shrink-0 bg-white/[0.03] hover:bg-white/[0.06] px-2.5 py-1 rounded-full border border-white/[0.08]"
        >
          <span>Flight Details</span>
          <span className="inline-block transition-transform duration-200 group-hover/details:translate-x-1">→</span>
        </button>
      </div>

      {/* MAIN CONTENT: Flight Details (Left) + Vertical Divider + Fare & Action (Right) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0">

        {/* LEFT FLIGHT DETAILS: Airline Info + Schedule */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 lg:gap-4 flex-1 min-w-0 pr-0 md:pr-3">

          {/* Airline Info */}
          <div className="flex items-center gap-2.5 shrink-0 w-[115px] sm:w-[125px]">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.35)] ring-1 ring-white/10 overflow-hidden shrink-0 transition-transform duration-300 group-hover:scale-105">
              <img src={logo} className="w-6 h-6 object-contain" alt={flight.airline} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-xs sm:text-sm tracking-tight text-white leading-tight truncate group-hover:text-amber-200 transition-colors" title={flight.airline}>
                {flight.airline}
              </p>
              <p className="text-[10px] text-slate-400 tracking-wider whitespace-nowrap mt-0.5 font-medium">
                {flight.origin} <span className="text-amber-300/80">→</span> {flight.destination}
              </p>
            </div>
          </div>

          {/* Schedule / Timeline with ANIMATED BEAM & FLOATING JET */}
          <div className="flex items-center justify-between sm:justify-start md:justify-center gap-2 sm:gap-3 flex-1 min-w-0">

            {/* DEPARTURE */}
            <div className="text-right shrink-0">
              <p className="font-display text-base sm:text-lg lg:text-xl font-extrabold tabular-nums text-white whitespace-nowrap group-hover:text-amber-100 transition-colors">
                {formatTime(flight.departure_time)}
              </p>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                <p className="font-display text-xs text-slate-200 tracking-wider uppercase font-black">{flight.origin}</p>
              </div>
            </div>

            {/* ANIMATED TIMELINE BAR */}
            <div className="flex flex-col items-center flex-1 min-w-[40px] max-w-[110px] px-1">
              <p className="text-[10px] sm:text-[11px] text-slate-300 mb-1 font-semibold tracking-wide whitespace-nowrap">
                {flight.duration || "--"}
              </p>

              {/* Trajectory track with traveling pulse and floating jet */}
              <div className="relative w-full h-[3px] bg-white/10 rounded-full flex items-center overflow-visible">
                {/* Gradient background track */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/40 via-amber-400/40 to-emerald-400/40 rounded-full" />

                {/* Continuous moving beam of light */}
                <div className="timeline-comet absolute h-[3px] w-8 rounded-full bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.9)]" />

                {/* Left departure node */}
                <div className="absolute -left-1 w-2.5 h-2.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.9)] ring-2 ring-cyan-400/30" />

                {/* Center floating airplane */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-2 flex flex-col items-center">
                  <span className="plane-bob text-[11px] text-amber-300 select-none inline-block filter drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]">
                    ✈
                  </span>
                </div>

                {/* Right arrival node */}
                <div className="absolute -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.9)] ring-2 ring-emerald-400/30" />
              </div>

              <p className="text-[10px] text-slate-400 mt-1.5 tracking-wide whitespace-nowrap font-medium flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-slate-500" />
                {getStopsText(flight.stops)}
              </p>
            </div>

            {/* ARRIVAL */}
            <div className="shrink-0 text-left">
              <p className="font-display text-base sm:text-lg lg:text-xl font-extrabold tabular-nums text-white whitespace-nowrap group-hover:text-amber-100 transition-colors">
                {formatTime(flight.arrival_time)}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="font-display text-xs text-slate-200 tracking-wider uppercase font-black">{flight.destination}</p>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              </div>
            </div>

          </div>

        </div>

        {/* VERTICAL DIVIDER — desktop */}
        <div className="self-stretch w-px hidden md:block border-l border-dashed border-white/15 mx-3 lg:mx-4 shrink-0" aria-hidden="true" />

        {/* HORIZONTAL DIVIDER — mobile */}
        <div className="w-full h-px md:hidden border-t border-dashed border-white/15 my-3" aria-hidden="true" />

        {/* RIGHT: Fare & Action */}
        <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 w-full md:w-[165px] lg:w-[178px] pl-0 md:pl-2">

          <div className="text-left md:text-right min-w-0 pr-2 md:pr-0">
            <div className="flex flex-col items-start md:items-end gap-1 mb-1 justify-start md:justify-end">
              {isCheapest && (
                <span className="cheapest-shimmer text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 whitespace-nowrap inline-flex items-center gap-1 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Best Price
                </span>
              )}
              <p className="text-[10px] uppercase tracking-wider text-slate-400 whitespace-nowrap font-semibold">Total Fare</p>
            </div>

            <p className="font-display text-2xl lg:text-[1.85rem] leading-tight font-black text-amber-300 tabular-nums whitespace-nowrap filter drop-shadow-[0_2px_12px_rgba(251,191,36,0.25)] group-hover:scale-105 transition-transform duration-300 origin-right">
              ₹{totalPrice.toLocaleString("en-IN")}
            </p>

            <p className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">
              ₹{safePrice.toLocaleString("en-IN")} × {pax} {pax > 1 ? "passengers" : "passenger"}
            </p>

            <p className="text-[10px] sm:text-[11px] text-amber-300/90 font-semibold whitespace-nowrap mt-0.5 flex items-center gap-1 justify-start md:justify-end">
              <span className="inline-block animate-pulse">🪙</span> Earn +{Math.max(120, Math.round(safePrice * 0.04))} pts
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.();
            }}
            onMouseDown={spawnRipple}
            className={`select-btn relative overflow-hidden shrink-0 mt-0 md:mt-3 px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm tracking-wide whitespace-nowrap transition-all duration-300
            ${isSelected
              ? "bg-amber-400/20 text-amber-200 border border-amber-300/60 shadow-[0_0_20px_rgba(251,191,36,0.35)] ring-1 ring-amber-300/40"
              : "pill-cta hover:scale-105 hover:shadow-[0_0_25px_rgba(251,191,36,0.4)] active:scale-95"
            }`}
          >
            {ripples.map((rp) => (
              <span key={rp.id} className="btn-ripple absolute" style={{ left: rp.x, top: rp.y }} />
            ))}
            {!isSelected && <span className="cta-gleam-beam absolute inset-0 pointer-events-none" />}
            <span className="relative flex items-center gap-1.5">
              {isSelected ? (
                <>
                  <span className="inline-block text-amber-300">✓</span> Selected
                </>
              ) : (
                <>
                  <span>Select flight</span>
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
                </>
              )}
            </span>
          </button>
        </div>

      </div>

      {/* AMENITIES ROW with interactive micro-hover effects */}
      <div className="flex items-center gap-2 sm:gap-2.5 mt-4 sm:mt-5 pt-3.5 sm:pt-4 border-t border-white/[0.06] text-slate-300 text-[10.5px] sm:text-[11px] tracking-wide flex-wrap">
        <span className="amenity-chip flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-cyan-400/30 hover:text-cyan-200 transition-all cursor-default">
          📶 Free Wi-Fi
        </span>
        <span className="amenity-chip flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-amber-400/30 hover:text-amber-200 transition-all cursor-default">
          🧳 15kg Cabin & Check-in
        </span>
        <span className="amenity-chip flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-violet-400/30 hover:text-violet-200 transition-all cursor-default">
          💺 Seat Selection
        </span>
        <span className="amenity-chip flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-emerald-400/30 hover:text-emerald-200 transition-all cursor-default">
          🍽️ Meal Options
        </span>
        <span className="amenity-chip flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/25 font-semibold sm:ml-auto hover:bg-amber-400/20 hover:shadow-[0_0_15px_rgba(251,191,36,0.25)] transition-all cursor-default">
          🪙 Rewards Eligible
        </span>
      </div>

      <style jsx>{`
        /* Continuous traveling comet across timeline */
        @keyframes cometTravel {
          0% { left: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        .timeline-comet {
          animation: cometTravel 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        /* Gentle plane floating animation */
        @keyframes planeFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(1deg); }
        }
        .plane-bob {
          animation: planeFloat 2s ease-in-out infinite;
        }

        /* Diagonal gleaming beam over CTA button */
        .cta-gleam-beam::after {
          content: "";
          position: absolute;
          top: 0; bottom: 0; left: -100%;
          width: 50%;
          background: linear-gradient(100deg, transparent, rgba(255,255,255,0.45), transparent);
          transform: skewX(-20deg);
          animation: ctaBeamSweep 3s ease-in-out infinite;
        }
        @keyframes ctaBeamSweep {
          0% { left: -100%; }
          45%, 100% { left: 200%; }
        }

        /* Green shimmer for cheapest price badge */
        .cheapest-shimmer {
          position: relative;
          overflow: hidden;
        }
        .cheapest-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(100deg, transparent, rgba(52,211,153,0.5), transparent);
          transform: translateX(-100%);
          animation: cheapestShimmerSweep 2.2s ease-in-out infinite;
        }
        @keyframes cheapestShimmerSweep {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(100%); }
        }

        @media (prefers-reduced-motion: reduce) {
          .timeline-comet, .plane-bob, .cta-gleam-beam::after, .cheapest-shimmer::after {
            animation: none !important;
          }
        }
      `}</style>
    </motion.div>

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