import type { ReactNode } from 'react'
import { BottomSheet } from './BottomSheet'
import { TopControls } from './TopControls'
import type { NearbyOrder } from '../screens/LiveDispatchScreen'

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
  screenState?: 'heatmap' | 'optimizing' | 'list' | 'assigned'
  assignedOrder?: NearbyOrder | null
  nearbyOrders?: NearbyOrder[]
  selectedPathId?: number | null
  onGpsPress?: () => void
  onSearchOrders?: () => void
  onStartDelivery?: () => void
  onSelectOrder?: (order: NearbyOrder) => void
  onViewPath?: (id: number) => void
}

export function RiderChrome({
  children,
  screenState = 'heatmap',
  assignedOrder,
  nearbyOrders,
  selectedPathId,
  onGpsPress,
  onSearchOrders,
  onStartDelivery,
  onSelectOrder,
  onViewPath,
}: RiderChromeProps) {
  return (
    <>
      <TopControls />
      {screenState === 'heatmap' && (
        <button
          className="absolute bottom-56 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg shadow-slate-900/20"
          aria-label="현재 위치로 이동"
          onClick={onGpsPress}
        >
          <GpsIcon />
        </button>
      )}
      {children}
      <BottomSheet
        screenState={screenState}
        assignedOrder={assignedOrder}
        nearbyOrders={nearbyOrders}
        selectedPathId={selectedPathId}
        onStartDelivery={onStartDelivery}
        onSelectOrder={onSelectOrder}
        onSearchOrders={onSearchOrders}
        onViewPath={onViewPath}
      />
    </>
  )
}