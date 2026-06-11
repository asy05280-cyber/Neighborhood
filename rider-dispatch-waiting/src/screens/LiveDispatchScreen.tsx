import { useEffect, useRef, useState } from 'react'
import { DispatchMap } from '../components/DispatchMap'
import { RiderChrome } from '../components/RiderChrome'
import { fetchOrderHeatPoints } from '../services/orderHeatmap'
import type { OrderHeatPoint } from '../services/orderHeatmap'

type RawOrder = {
  id: number
  shop_lat: number
  shop_lon: number
  dlv_lat: number
  dlv_lon: number
  deadline: number
}

export type NearbyOrder = RawOrder & {
  distance: number
  color: string
  eta: number
  reward: number
  path?: { lat: number; lng: number }[]
  bundleCount: number
  pickupPoints: { lat: number; lng: number }[]
  deliveryPoints: { lat: number; lng: number }[]
}

const ORDER_COLORS = ['#3B82F6', '#F97316', '#8B5CF6']

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

type Props = {
  onStartDelivery?: (order: RawOrder & { reward: number }) => void
}

// 화면 상태
type ScreenState = 'heatmap' | 'optimizing' | 'list' | 'assigned'

export function LiveDispatchScreen({ onStartDelivery }: Props) {
  const [points, setPoints] = useState<OrderHeatPoint[]>([])
  const [rawOrders, setRawOrders] = useState<RawOrder[]>([])
  const [nearbyOrders, setNearbyOrders] = useState<NearbyOrder[]>([])
  const [assignedOrder, setAssignedOrder] = useState<NearbyOrder | null>(null)
  const [screenState, setScreenState] = useState<ScreenState>('heatmap')
  const [centerTo, setCenterTo] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null)
  const [fixedPosition, setFixedPosition] = useState<{ lat: number; lng: number } | null>(null)
  const assignedIds = useRef<Set<number>>(new Set())
  const mapCenterRef = useRef<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    const load = async () => {
      const heatPoints = await fetchOrderHeatPoints()
      setPoints(heatPoints)

      const res = await fetch('/STAGE3_TEST_9.json')
      const data = await res.json()
      const orders: RawOrder[] = data.ORDERS.map((o: any) => ({
        id: o[0],
        shop_lat: o[2] + 1.5,
        shop_lon: o[3] + 1.5,
        dlv_lat: o[4] + 1.5,
        dlv_lon: o[5] + 1.5,
        deadline: o[8],
      }))
      setRawOrders(orders)
    }
    load()
  }, [])

  const handleCursorMove = (lat: number, lng: number) => {
    mapCenterRef.current = { lat, lng }
  }

  // GPS 버튼: 히트맵 내 랜덤 위치로 이동
  const handleGpsPress = () => {
    if (points.length === 0) return
    const sorted = [...points].sort((a, b) => b.count - a.count)
    const topPoints = sorted.slice(0, Math.ceil(sorted.length * 0.3))
    const target = topPoints[Math.floor(Math.random() * topPoints.length)]
    setCenterTo({ lat: target.lat, lng: target.lng })
    mapCenterRef.current = { lat: target.lat, lng: target.lng }
    setFixedPosition({ lat: target.lat, lng: target.lng })
  }

  // 주문 탐색하기 버튼: 최적화 진행 후 리스트 표시
  const handleSearchOrders = async () => {
    if (rawOrders.length === 0) return

    const center = mapCenterRef.current ?? (
      points.length > 0 ? { lat: points[0].lat, lng: points[0].lng } : null
    )
    if (!center) return

    // 탐색 시작 시 현재 위치 고정 (파란 점 움직임 방지)
    setFixedPosition(center)

    // 최적화 중 화면으로 전환
    setScreenState('optimizing')

    try {
      // 백엔드 최적화 API 호출
      const res = await fetch('/STAGE3_TEST_9.json')
      const data = await res.json()

      const apiRes = await fetch('http://localhost:8000/api/run-dms')
      const apiData = await apiRes.json()

      const unassigned = rawOrders.filter((o) => !assignedIds.current.has(o.id))
      const sorted = unassigned
        .map((o) => ({
          ...o,
          distance: distanceMeters(center.lat, center.lng, o.shop_lat, o.shop_lon),
          eta: randomBetween(10, 30),
          reward: randomBetween(70, 105) * 100,
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map((o, i) => {
          const bundle = apiData.bundles?.find((b: any) =>
            b.shop_seq.includes(o.id) || b.dlv_seq.includes(o.id)
          )
          const pickupPoints = bundle
            ? bundle.shops.map((s: any) => ({ lat: s.lat, lng: s.lon }))
            : [{ lat: o.shop_lat, lng: o.shop_lon }]
          const deliveryPoints = bundle
            ? bundle.dlvs.map((d: any) => ({ lat: d.lat, lng: d.lon }))
            : [{ lat: o.dlv_lat, lng: o.dlv_lon }]
          const path = [...pickupPoints, ...deliveryPoints]
          return {
            ...o,
            color: ORDER_COLORS[i],
            path,
            pickupPoints,
            deliveryPoints,
            bundleCount: bundle ? bundle.shops.length : 1,
          }
        })

      setNearbyOrders(sorted)
      setScreenState('list')
    } catch {
      // API 실패 시 기본 경로로 폴백
      const unassigned = rawOrders.filter((o) => !assignedIds.current.has(o.id))
      const sorted = unassigned
        .map((o) => ({
          ...o,
          distance: distanceMeters(center.lat, center.lng, o.shop_lat, o.shop_lon),
          eta: randomBetween(10, 30),
          reward: randomBetween(70, 105) * 100,
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 3)
        .map((o, i) => ({
          ...o,
          color: ORDER_COLORS[i],
          path: [
            { lat: o.shop_lat, lng: o.shop_lon },
            { lat: o.dlv_lat, lng: o.dlv_lon },
          ],
          pickupPoints: [{ lat: o.shop_lat, lng: o.shop_lon }],
          deliveryPoints: [{ lat: o.dlv_lat, lng: o.dlv_lon }],
          bundleCount: 1,
        }))
      setNearbyOrders(sorted)
      setScreenState('list')
    }
  }

  // 주문 선택
  const handleSelectOrder = (order: NearbyOrder) => {
    assignedIds.current.add(order.id)
    setAssignedOrder(order)
    setScreenState('assigned')
  }

  // 픽업 시작
  const handleStartDelivery = () => {
    if (!assignedOrder) return
    onStartDelivery?.({ ...assignedOrder })
  }

  const showHeatmap = screenState === 'heatmap'

  // 경로보기 버튼을 누른 주문만 표시, 없으면 전체 숨김
  // assigned 상태에서는 배정된 주문의 경로 표시
  const paths = screenState === 'list'
    ? nearbyOrders
        .filter((o) => selectedPathId === null ? false : o.id === selectedPathId)
        .map((o) => ({
          points: o.path ?? [
            { lat: o.shop_lat, lng: o.shop_lon },
            { lat: o.dlv_lat, lng: o.dlv_lon },
          ],
          color: o.color,
          pickupPoints: o.pickupPoints,
          deliveryPoints: o.deliveryPoints,
        }))
    : screenState === 'assigned' && assignedOrder
    ? [{
        points: assignedOrder.path ?? [
          { lat: assignedOrder.shop_lat, lng: assignedOrder.shop_lon },
          { lat: assignedOrder.dlv_lat, lng: assignedOrder.dlv_lon },
        ],
        color: assignedOrder.color,
        pickupPoints: assignedOrder.pickupPoints,
        deliveryPoints: assignedOrder.deliveryPoints,
      }]
    : []

  return (
    <div className="relative h-screen w-full">
      {/* 최적화 중 화면 */}
      {screenState === 'optimizing' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white">
          <style>{`
            @keyframes bounce-dot {
              0%, 80%, 100% { transform: translateY(0); }
              40% { transform: translateY(-12px); }
            }
          `}</style>
          <div className="mb-4 flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-3 w-3 rounded-full bg-emerald-400"
                style={{ animation: `bounce-dot 1.2s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
          <p className="text-base font-bold text-slate-800">경로 최적화 중...</p>
          <p className="mt-1 text-sm text-slate-400">잠시만 기다려주세요</p>
        </div>
      )}

      {screenState === 'assigned' && assignedOrder ? (
        <DispatchMap
          mode="delivery"
          pickupMarkers={assignedOrder.pickupPoints ?? [{ lat: assignedOrder.shop_lat, lng: assignedOrder.shop_lon }]}
          deliveryMarkers={assignedOrder.deliveryPoints ?? [{ lat: assignedOrder.dlv_lat, lng: assignedOrder.dlv_lon }]}
          path={assignedOrder.path ?? [
            { lat: assignedOrder.shop_lat, lng: assignedOrder.shop_lon },
            { lat: assignedOrder.dlv_lat, lng: assignedOrder.dlv_lon },
          ]}
          fixedPosition={fixedPosition}
        />
      ) : (
        <DispatchMap
          mode="heatmap"
          points={showHeatmap ? points : []}
          paths={paths}
          centerTo={centerTo}
          fixedPosition={fixedPosition}
          onCursorMove={handleCursorMove}
        />
      )}
      <RiderChrome
        screenState={screenState}
        assignedOrder={assignedOrder}
        nearbyOrders={nearbyOrders}
        selectedPathId={selectedPathId}
        onSelectOrder={handleSelectOrder}
        onStartDelivery={handleStartDelivery}
        onGpsPress={handleGpsPress}
        onSearchOrders={handleSearchOrders}
        onViewPath={(id) => {
          const newId = selectedPathId === id ? null : id
          setSelectedPathId(newId)
          if (newId !== null) {
            const order = nearbyOrders.find((o) => o.id === newId)
            if (order?.path && order.path.length > 0) {
              const lats = order.path.map((p) => p.lat)
              const lngs = order.path.map((p) => p.lng)
              const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
              const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
              setCenterTo({ lat: midLat, lng: midLng })
            }
          }
        }}
      />
    </div>
  )
}