function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-700" fill="none" aria-hidden="true">
      <path d="M4 7H20M4 12H20M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function TopControls() {
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-40 flex w-full items-center justify-between px-4 pt-5">
      <button
        className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 shadow-lg shadow-slate-900/15"
        aria-label="메뉴 열기"
      >
        <HamburgerIcon />
      </button>
      <div className="pointer-events-none rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20">
        업무 중
      </div>
      <div className="h-11 w-11" />
    </div>
  )
}
