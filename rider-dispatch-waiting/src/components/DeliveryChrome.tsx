import type { ReactNode } from "react"
import { TopControls } from "./TopControls"

function NavigationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none">
      <path
        d="M12 2L19 21L12 17L5 21L12 2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type DeliveryChromeProps = {
  children?: ReactNode
  onStartNavigation?: () => void
  reward?: number
}

export function DeliveryChrome({ children, onStartNavigation, reward }: DeliveryChromeProps) {
  return (
    <>
      <TopControls />
      {children}
      <div className="absolute bottom-0 z-40 w-full rounded-t-3xl bg-white p-5 shadow-2xl shadow-slate-900/20">
        <div className="mb-3 text-lg font-bold">
          총 배달료 {reward ? reward.toLocaleString() : '0'}원
        </div>
        <button
          onClick={onStartNavigation}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-500/30"
        >
          <NavigationIcon />
          안내 시작하기
        </button>
      </div>
    </>
  )
}