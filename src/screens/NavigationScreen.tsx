import { useState, useEffect } from 'react'
import { DispatchMap } from '../components/DispatchMap'

type Waypoint = {
  lat: number
  lng: number
  label: string
  type: 'pickup' | 'delivery'
}

type NavigationScreenProps = {
  waypoints?: Waypoint[]
  onComplete?: () => void
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8 text-white" fill="none">
      <path d="M12 3l9 18-9-5-9 5 9-18z" fill="currentColor" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none">
      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const MOCK_STEPS = [
  { direction: '직진', road: '', distance: '350m' },
  { direction: '좌회전', road: '', distance: '200m' },
  { direction: '직진', road: '', distance: '150m' },
  { direction: '우회전', road: '', distance: '80m' },
  { direction: '도착', road: '목적지', distance: '' },
]

export function NavigationScreen({ waypoints = [], onComplete }: NavigationScreenProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [currentWaypoint, setCurrentWaypoint] = useState(0)
  const [eta, setEta] = useState(12)

  useEffect(() => {
    if (eta <= 0) return
    const timer = setInterval(() => setEta((v) => Math.max(0, v - 1)), 60000)
    return () => clearInterval(timer)
  }, [])

  const step = MOCK_STEPS[currentStep]
  const waypoint = waypoints[currentWaypoint] ?? {
    label: currentWaypoint === 0 ? '픽업 위치' : '배달 위치',
    type: currentWaypoint === 0 ? 'pickup' : 'delivery',
  }

  const isLastStep = currentStep === MOCK_STEPS.length - 1
  const isLastWaypoint = currentWaypoint === Math.max(0, waypoints.length - 1)

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep((s) => s + 1)
    } else if (!isLastWaypoint) {
      setCurrentWaypoint((w) => w + 1)
      setCurrentStep(0)
      setEta(8)
    } else {
      onComplete?.()
    }
  }

  const isDelivery = waypoint.type === 'delivery'
  const directionColor = isDelivery ? 'bg-orange-400' : 'bg-emerald-500'
  const buttonColor = isDelivery ? 'bg-orange-400 shadow-orange-400/30' : 'bg-emerald-500 shadow-emerald-500/30'
  const pathColor = isDelivery ? '#FB923C' : '#10B981'

  // 전체 경로 — 현재 waypoint 기준으로 픽업/배달 분리해서 색상 적용
  const path = waypoints.map((w) => ({ lat: w.lat, lng: w.lng }))
  const pickupMarkers = waypoints
    .filter((w) => w.type === 'pickup')
    .map((w) => ({ lat: w.lat, lng: w.lng }))
  const deliveryMarkers = waypoints
    .filter((w) => w.type === 'delivery')
    .map((w) => ({ lat: w.lat, lng: w.lng }))

  // 6번: 첫 번째 waypoint를 초기 중심으로 고정
  const centerTo = waypoints[currentWaypoint]
    ? { lat: waypoints[currentWaypoint].lat, lng: waypoints[currentWaypoint].lng }
    : null

  return (
    <div className="relative flex h-screen w-full flex-col bg-slate-900">

      {/* 상단 방향 안내 */}
      <div className={`${directionColor} px-6 pb-6 pt-7`}>
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <ArrowIcon />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{step.direction}</p>
            <p className="text-sm font-medium text-white/80">{step.road} {step.distance}</p>
          </div>
        </div>
      </div>

      {/* 지도 영역 */}
      <div className="relative flex-1 overflow-hidden">
        <DispatchMap
          mode="delivery"
          pickupMarkers={pickupMarkers}
          deliveryMarkers={deliveryMarkers}
          path={path}
          centerTo={centerTo}
          pathColor={pathColor}
        />

        {/* ETA 카드 */}
        <div className="absolute right-4 top-4 z-30 rounded-2xl bg-white px-4 py-3 shadow-lg">
          <p className="text-xs text-slate-400">도착까지</p>
          <p className="text-lg font-bold text-slate-800">{eta}분</p>
        </div>

        {/* 현재 목적지 카드 */}
        <div className="absolute bottom-4 left-4 right-4 z-30 rounded-2xl bg-white p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-10 items-center justify-center rounded-xl ${directionColor}`}>
              <span className="text-lg">{waypoint.type === 'pickup' ? '🍔' : '🏠'}</span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400">{waypoint.type === 'pickup' ? '픽업 위치' : '배달 위치'}</p>
              <p className="text-sm font-bold text-slate-800">
                {waypoint.label ?? (waypoint.type === 'pickup' ? '음식점' : '배달지')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">남은 거리</p>
              <p className="text-sm font-bold text-slate-800">
                {MOCK_STEPS.slice(currentStep).reduce((acc, s) => {
                  const m = parseInt(s.distance)
                  return acc + (isNaN(m) ? 0 : m)
                }, 0)}m
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 컨트롤 */}
      <div className="bg-white px-5 pb-8 pt-4 shadow-2xl">
        <div className="mb-3 flex justify-center gap-1.5">
          {MOCK_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep
                  ? `w-6 ${isDelivery ? 'bg-orange-400' : 'bg-emerald-500'}`
                  : i < currentStep
                  ? `w-3 ${isDelivery ? 'bg-orange-200' : 'bg-emerald-200'}`
                  : 'w-3 bg-slate-200'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-md ${buttonColor}`}
        >
          {isLastStep && isLastWaypoint ? (
            <>
              <CheckIcon />
              배달 완료
            </>
          ) : isLastStep ? (
            <>
              <CheckIcon />
              {waypoint.type === 'pickup' ? '픽업 완료 · 배달지로 출발' : '다음 목적지로'}
            </>
          ) : (
            '다음 안내'
          )}
        </button>
      </div>
    </div>
  )
}