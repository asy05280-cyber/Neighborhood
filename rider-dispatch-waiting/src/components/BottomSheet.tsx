import { useState } from 'react'
import type { NearbyOrder } from '../screens/LiveDispatchScreen'

type BottomSheetProps = {
  screenState?: 'heatmap' | 'optimizing' | 'list' | 'assigned'
  assignedOrder?: NearbyOrder | null
  nearbyOrders?: NearbyOrder[]
  selectedPathId?: number | null
  onStartDelivery?: () => void
  onSelectOrder?: (order: NearbyOrder) => void
  onSearchOrders?: () => void
  onViewPath?: (id: number) => void
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function WonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none">
      <path d="M4 7l4 10 4-10 4 10 4-10M3 13h18M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function BottomSheet({
  screenState = 'heatmap',
  assignedOrder,
  nearbyOrders = [],
  selectedPathId,
  onStartDelivery,
  onSelectOrder,
  onSearchOrders,
  onViewPath,
}: BottomSheetProps) {
  const [expanded, setExpanded] = useState(false)

  // 주문 배정 완료
  if (screenState === 'assigned' && assignedOrder) {
    return (
      <div className="absolute bottom-0 left-0 z-40 w-full p-4 pb-6">
        <div className="rounded-3xl bg-white/95 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur">
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />
          <p className="text-lg font-bold text-slate-900">주문이 배정되었습니다!</p>
          <p className="mt-1 text-sm font-medium text-slate-500">주문 #{assignedOrder.id}</p>
          <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">픽업 위치</span>
              <span className="font-medium text-slate-700">
                {assignedOrder.shop_lat.toFixed(4)}, {assignedOrder.shop_lon.toFixed(4)}
              </span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">배달 위치</span>
              <span className="font-medium text-slate-700">
                {assignedOrder.dlv_lat.toFixed(4)}, {assignedOrder.dlv_lon.toFixed(4)}
              </span>
            </div>
            <div className="h-px bg-slate-200" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">배달료</span>
              <span className="font-medium text-emerald-600">{assignedOrder.reward.toLocaleString()}원</span>
            </div>
          </div>
          <button
            className="mt-4 w-full rounded-2xl bg-teal-500 py-3.5 text-sm font-bold text-white shadow-md shadow-teal-500/30"
            onClick={onStartDelivery}
          >
            픽업 시작
          </button>
        </div>
      </div>
    )
  }

  // 주변 주문 리스트
  if (screenState === 'list' && nearbyOrders.length > 0) {
    return (
      <>
        {/* 딤 배경 — 확장 시에만 */}
        {expanded && (
          <div
            className="absolute inset-0 z-40 bg-black/20"
            onClick={() => setExpanded(false)}
          />
        )}

        <div
          className="absolute left-0 z-50 w-full transition-all duration-300 ease-out"
          style={{ bottom: 0 }}
        >
          {/* 축소 상태: 미니 카드 */}
          {!expanded && (
            <div
              className="mx-4 mb-4 cursor-pointer rounded-2xl bg-white/95 px-4 py-3 shadow-xl shadow-slate-900/20 backdrop-blur"
              onClick={() => setExpanded(true)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* 3색 도트 */}
                  <div className="flex gap-1">
                    {nearbyOrders.map((o) => (
                      <div
                        key={o.id}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: o.color }}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    주변 주문 {nearbyOrders.length}건
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPathId !== null && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      경로 표시 중
                    </span>
                  )}
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none">
                    <path d="M18 15l-6-6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* 확장 상태: 풀 시트 */}
          {expanded && (
            <div className="rounded-t-3xl bg-white px-5 pb-8 pt-4 shadow-2xl shadow-slate-900/25">
              {/* 핸들 */}
              <div
                className="mx-auto mb-4 h-1.5 w-14 cursor-pointer rounded-full bg-slate-200"
                onClick={() => setExpanded(false)}
              />
              <p className="text-base font-bold text-slate-900">주변 주문 {nearbyOrders.length}건</p>
              <p className="mt-0.5 text-xs text-slate-400 mb-3">경로를 확인 후 원하는 주문을 선택하세요</p>
              <div className="space-y-2">
                {nearbyOrders.map((order) => {
                  const isPreviewing = selectedPathId === order.id
                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border bg-white p-3.5 shadow-sm transition-all"
                      style={{
                        borderWidth: isPreviewing ? 2 : 1,
                        borderColor: isPreviewing ? order.color : '#f1f5f9',
                      }}
                    >
                      <div className="flex items-center gap-3 mb-2.5">
                        <div
                          className="h-10 w-1.5 flex-shrink-0 rounded-full"
                          style={{ background: order.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-slate-800">주문 #{order.id}</span>
                            <span className="text-xs text-slate-400">{(order.distance / 1000).toFixed(1)}km</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <ClockIcon />
                              {order.eta}분
                            </span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <WonIcon />
                              {order.reward.toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            onViewPath?.(order.id)
                            setExpanded(false) // 경로보기 누르면 축소해서 지도 보이게
                          }}
                          className="flex-1 rounded-xl py-2 text-xs font-semibold transition-all"
                          style={
                            isPreviewing
                              ? { background: order.color, color: 'white' }
                              : { background: '#f1f5f9', color: '#475569' }
                          }
                        >
                          {isPreviewing ? '경로 숨기기' : '경로 보기'}
                        </button>
                        <button
                          onClick={() => onSelectOrder?.(order)}
                          className="flex-1 rounded-xl py-2 text-xs font-semibold text-white"
                          style={{ background: order.color }}
                        >
                          선택하기
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  // 기본 히트맵 탐색 화면
  return (
    <div className="absolute bottom-0 left-0 z-40 w-full p-4 pb-6">
      <div className="rounded-3xl bg-white/95 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />
        <p className="text-lg font-bold text-slate-900">주문건을 찾고 있습니다</p>
        <p className="mt-1 text-sm text-slate-500 mb-4">붉은 지역으로 이동 후 주문을 탐색하세요</p>
        <button
          onClick={onSearchOrders}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-500/30"
        >
          <SearchIcon />
          주변 주문 탐색하기
        </button>
      </div>
    </div>
  )
}