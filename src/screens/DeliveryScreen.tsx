import { DispatchMap } from "../components/DispatchMap";
import { DeliveryChrome } from "../components/DeliveryChrome";

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

type DeliveryScreenProps = {
  assignedOrder?: AssignedOrder | null
  onStartNavigation?: () => void
}

export function DeliveryScreen({ assignedOrder, onStartNavigation }: DeliveryScreenProps) {
  const path = assignedOrder?.path ?? (
    assignedOrder
      ? [
          { lat: assignedOrder.shop_lat, lng: assignedOrder.shop_lon },
          { lat: assignedOrder.dlv_lat, lng: assignedOrder.dlv_lon },
        ]
      : undefined
  )

  const pickupMarkers = assignedOrder?.pickupPoints ?? (
    assignedOrder ? [{ lat: assignedOrder.shop_lat, lng: assignedOrder.shop_lon }] : undefined
  )

  const deliveryMarkers = assignedOrder?.deliveryPoints ?? (
    assignedOrder ? [{ lat: assignedOrder.dlv_lat, lng: assignedOrder.dlv_lon }] : undefined
  )

  const bundleCount = assignedOrder?.bundleCount ?? 1
  const badgeText = assignedOrder ? `${bundleCount}건 묶음배송` : undefined

  const fixedPosition = pickupMarkers && pickupMarkers.length > 0
    ? { lat: pickupMarkers[0].lat, lng: pickupMarkers[0].lng }
    : null

  return (
    <div className="relative h-screen w-full">
      <DispatchMap
        mode="delivery"
        pickupMarkers={pickupMarkers}
        deliveryMarkers={deliveryMarkers}
        path={path}
        badgeText={badgeText}
        fixedPosition={fixedPosition}
      />
      <DeliveryChrome
        onStartNavigation={onStartNavigation}
        reward={assignedOrder?.reward}
      />
    </div>
  )
}