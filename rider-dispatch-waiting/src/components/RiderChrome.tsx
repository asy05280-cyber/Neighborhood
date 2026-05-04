import type { ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'
import { TopControls } from './TopControls'

function GpsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-teal-700" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2V5M12 19V22M2 12H5M19 12H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

type RiderChromeProps = {
  children?: ReactNode
}

export function RiderChrome({ children }: RiderChromeProps) {
  return (
    <>
      <TopControls />
      <button
        className="absolute bottom-44 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg shadow-slate-900/20"
        aria-label="현재 위치로 이동"
      >
        <GpsIcon />
      </button>
      {children}
      <BottomSheet />
    </>
  )
}
