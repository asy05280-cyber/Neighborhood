import { useState } from 'react'
import { LiveDispatchScreen } from './screens/LiveDispatchScreen'
import { DeliveryScreen } from './screens/DeliveryScreen'
import { NavigationScreen } from './screens/NavigationScreen'

type AssignedOrder = {
  id: number
  shop_lat: number
  shop_lon: number
  dlv_lat: number
  dlv_lon: number
  deadline: number
  reward: number
  path?: { lat: number; lng: number }[]
  bundleCount?: number
  pickupPoints?: { lat: number; lng: number }[]
  deliveryPoints?: { lat: number; lng: number }[]
}

function App() {
  const [mode, setMode] = useState<'live' | 'delivery' | 'navigation'>('live')
  const [assignedOrder, setAssignedOrder] = useState<AssignedOrder | null>(null)

  const handleStartDelivery = (order: AssignedOrder) => {
    setAssignedOrder(order)
    setMode('delivery')
  }

  const handleStartNavigation = () => {
    setMode('navigation')
  }

  const handleComplete = () => {
    setAssignedOrder(null)
    setMode('live')
  }

  const navWaypoints = assignedOrder
    ? [
        ...(assignedOrder.pickupPoints ?? [{ lat: assignedOrder.shop_lat, lng: assignedOrder.shop_lon }])
          .map((p) => ({ ...p, label: '픽업 위치', type: 'pickup' as const })),
        ...(assignedOrder.deliveryPoints ?? [{ lat: assignedOrder.dlv_lat, lng: assignedOrder.dlv_lon }])
          .map((p) => ({ ...p, label: '배달 위치', type: 'delivery' as const })),
      ]
    : []

  return (
    <main className="h-full w-full bg-gradient-to-b from-emerald-50 to-slate-100">
      <section className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white shadow-2xl shadow-slate-900/20">
        {mode === 'live' && (
          <LiveDispatchScreen onStartDelivery={handleStartDelivery} />
        )}
        {mode === 'delivery' && (
          <DeliveryScreen
            assignedOrder={assignedOrder}
            onStartNavigation={handleStartNavigation}
          />
        )}
        {mode === 'navigation' && (
          <NavigationScreen
            waypoints={navWaypoints}
            onComplete={handleComplete}
          />
        )}
      </section>
    </main>
  )
}

export default App