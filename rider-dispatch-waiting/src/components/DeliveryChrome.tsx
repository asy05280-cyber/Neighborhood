import type { ReactNode } from "react"
import { TopControls } from "./TopControls"

function GpsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-teal-700" fill="none">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2V5M12 19V22M2 12H5M19 12H22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

type DeliveryChromeProps = {
  children?: ReactNode;
};

export function DeliveryChrome({ children }: DeliveryChromeProps) {
  return (
    <>
      <TopControls />

      <button
        className="absolute bottom-44 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg shadow-slate-900/20"
        aria-label="현재 위치"
      >
        <GpsIcon />
      </button>

      {children}

      <div className="absolute bottom-0 z-40 w-full rounded-t-3xl bg-white p-5 shadow-2xl shadow-slate-900/20">
        <div className="mb-3 text-lg font-bold">총 배달료 9,940원</div>

        <div className="flex gap-3">
          <button className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold">
            모두 거절
          </button>

          <button className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white">
            2건 모두 수락
          </button>
        </div>
      </div>
    </>
  );
}