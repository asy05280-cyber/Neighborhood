import { useCallback, useEffect, useRef, useState } from 'react'
import type { OrderHeatPoint } from '../services/orderHeatmap'

declare global {
  interface Window {
    kakao: any
  }
}

const DEFAULT_CENTER = { lat: 37.5, lng: 127.0 }
const HEX_RADIUS = 12
const HEAT_SPREAD = 100
const FALLBACK_LAT_SCALE = 110000
const FALLBACK_LNG_SCALE = 82000

type Marker = {
  lat: number
  lng: number
}

type DispatchMapProps = {
  mode?: 'heatmap' | 'delivery'
  points?: OrderHeatPoint[]
  markers?: Marker[]
  pickupMarkers?: Marker[]
  deliveryMarkers?: Marker[]
  path?: { lat: number; lng: number }[]
  paths?: { points: { lat: number; lng: number }[]; color: string; pickupPoints?: { lat: number; lng: number }[]; deliveryPoints?: { lat: number; lng: number }[] }[]
  pathColor?: string
  badgeText?: string
  centerTo?: { lat: number; lng: number } | null
  fixedPosition?: { lat: number; lng: number } | null
  onCursorMove?: (lat: number, lng: number) => void
}

function getCenter(points: { lat: number; lng: number }[]) {
  if (!points || points.length === 0) return DEFAULT_CENTER

  let minLat = Infinity, maxLat = -Infinity
  let minLng = Infinity, maxLng = -Infinity

  points.forEach(p => {
    minLat = Math.min(minLat, p.lat)
    maxLat = Math.max(maxLat, p.lat)
    minLng = Math.min(minLng, p.lng)
    maxLng = Math.max(maxLng, p.lng)
  })

  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
}

function drawHex(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const angle = Math.PI / 3
  const startAngle = Math.PI / 6
  ctx.beginPath()
  for (let i = 0; i < 6; i += 1) {
    const px = x + radius * Math.cos(startAngle + angle * i)
    const py = y + radius * Math.sin(startAngle + angle * i)
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function densityAt(x: number, y: number, points: { x: number; y: number; count: number }[]) {
  let density = 0
  for (const point of points) {
    const dx = x - point.x
    const dy = y - point.y
    density += point.count * Math.exp(-(dx * dx + dy * dy) / (2 * HEAT_SPREAD * HEAT_SPREAD))
  }
  return density
}

function hexColor(normalized: number) {
  if (normalized > 0.82) return 'rgba(153, 27, 27, 0.92)'
  if (normalized > 0.62) return 'rgba(220, 38, 38, 0.82)'
  if (normalized > 0.42) return 'rgba(239, 68, 68, 0.68)'
  if (normalized > 0.22) return 'rgba(248, 113, 113, 0.5)'
  return 'rgba(252, 165, 165, 0.3)'
}

async function ensureKakaoLoaded() {
  if (window.kakao?.maps) return true

  const script = document.createElement('script')
  script.src = '//dapi.kakao.com/v2/maps/sdk.js?appkey=bcf7eb5c746613f012fdf704d51e6b38&autoload=false'
  script.async = true
  document.head.appendChild(script)

  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Kakao SDK load 실패'))
  })

  return true
}

export function DispatchMap({
  mode = 'heatmap',
  points = [],
  markers,
  pickupMarkers,
  deliveryMarkers,
  path,
  paths,
  pathColor = '#10B981',
  badgeText,
  centerTo,
  fixedPosition,
  onCursorMove,
}: DispatchMapProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)
  const mapLayerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const markersRef = useRef<any[]>([])
  const polylineRef = useRef<any>(null)
  const [isFallbackMap, setIsFallbackMap] = useState(false)
  const [ready, setReady] = useState(false)

  const renderHeatmap = useCallback(() => {
    if (mode !== 'heatmap') {
      // delivery 모드에서는 캔버스 즉시 클리어
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) return

    const width = root.clientWidth
    const height = root.clientHeight
    if (width === 0 || height === 0) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const projected = isFallbackMap
      ? points.map((point) => ({
          x: width / 2 + (point.lng - DEFAULT_CENTER.lng) * FALLBACK_LNG_SCALE,
          y: height / 2 - (point.lat - DEFAULT_CENTER.lat) * FALLBACK_LAT_SCALE,
          count: point.count,
        }))
      : (() => {
          if (!window.kakao?.maps || !mapRef.current) return []
          const projection = mapRef.current.getProjection()
          return points.map((point) => {
            const latLng = new window.kakao.maps.LatLng(point.lat, point.lng)
            const pixel = projection.containerPointFromCoords(latLng)
            return { x: pixel.x, y: pixel.y, count: point.count }
          })
        })()

    if (projected.length === 0) return

    const xStep = Math.sqrt(3) * HEX_RADIUS
    const yStep = HEX_RADIUS * 1.5
    const cells: { x: number; y: number; density: number }[] = []
    let maxDensity = 0

    for (let y = -HEX_RADIUS, row = 0; y <= height + HEX_RADIUS; y += yStep, row += 1) {
      const rowOffset = row % 2 === 0 ? 0 : xStep * 0.5
      for (let x = -HEX_RADIUS; x <= width + HEX_RADIUS; x += xStep) {
        const gx = x + rowOffset
        const d = densityAt(gx, y, projected)
        if (d > 10) {
          cells.push({ x: gx, y, density: d })
          if (d > maxDensity) maxDensity = d
        }
      }
    }

    for (const cell of cells) {
      const normalized = maxDensity > 0 ? cell.density / maxDensity : 0
      const mixed = Math.max(0, Math.min(1, normalized * 0.9 + ((cell.x + cell.y) % 19) / 120))
      drawHex(ctx, cell.x, cell.y, HEX_RADIUS)
      ctx.fillStyle = hexColor(mixed)
      ctx.fill()
    }
  }, [mode, isFallbackMap, points])

  // 항상 최신 renderHeatmap을 ref로 유지 → 이벤트 리스너의 stale closure 방지
  const renderHeatmapRef = useRef(renderHeatmap)
  useEffect(() => {
    renderHeatmapRef.current = renderHeatmap
  }, [renderHeatmap])

  // Kakao 지도 초기화 (최초 1회) — ref를 통해 항상 최신 renderHeatmap 호출
  useEffect(() => {
    const resizeHandler = () => {
      mapRef.current?.relayout()
      renderHeatmapRef.current()
    }

    ensureKakaoLoaded()
      .then((ok) => {
        if (!ok) {
          setIsFallbackMap(true)
          setReady(true)
          return
        }

        window.kakao.maps.load(() => {
          if (!mapLayerRef.current) return

          mapRef.current = new window.kakao.maps.Map(mapLayerRef.current, {
            center: new window.kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
            level: 5,
          })

          let rafId: number | null = null
          const safeRender = () => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => renderHeatmapRef.current())
          }

          window.kakao.maps.event.addListener(mapRef.current, 'center_changed', safeRender)
          window.kakao.maps.event.addListener(mapRef.current, 'zoom_changed', safeRender)

          // 지도 중심(파란 점)이 바뀔 때마다 onCursorMove로 좌표 전달
          window.kakao.maps.event.addListener(mapRef.current, 'center_changed', () => {
            if (onCursorMove) {
              const center = mapRef.current.getCenter()
              onCursorMove(center.getLat(), center.getLng())
            }
          })
          window.addEventListener('resize', resizeHandler)

          setReady(true)
        })
      })
      .catch(() => {
        setIsFallbackMap(true)
        setReady(true)
      })

    return () => {
      window.removeEventListener('resize', resizeHandler)
    }
  }, [])

  // fixedPosition이 있으면 카카오 좌표 → 픽셀 변환해 React DOM에 렌더링 (canvas 위)
  const [fixedPixel, setFixedPixel] = useState<{ x: number; y: number } | null>(null)

  const updateFixedPixel = useCallback(() => {
    if (!ready || !fixedPosition || !mapRef.current || !window.kakao?.maps) return
    const projection = mapRef.current.getProjection()
    const latLng = new window.kakao.maps.LatLng(fixedPosition.lat, fixedPosition.lng)
    const pixel = projection.containerPointFromCoords(latLng)
    setFixedPixel({ x: pixel.x, y: pixel.y })
  }, [ready, fixedPosition])

  useEffect(() => {
    if (!ready || !fixedPosition || !mapRef.current || !window.kakao?.maps) {
      setFixedPixel(null)
      return
    }
    updateFixedPixel()
    window.kakao.maps.event.addListener(mapRef.current, 'center_changed', updateFixedPixel)
    window.kakao.maps.event.addListener(mapRef.current, 'zoom_changed', updateFixedPixel)
    return () => {
      if (mapRef.current && window.kakao?.maps) {
        window.kakao.maps.event.removeListener(mapRef.current, 'center_changed', updateFixedPixel)
        window.kakao.maps.event.removeListener(mapRef.current, 'zoom_changed', updateFixedPixel)
      }
    }
  }, [ready, fixedPosition, updateFixedPixel])

  // mode가 delivery로 바뀌면 캔버스 즉시 클리어
  useEffect(() => {
    if (mode !== 'delivery') return
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [mode])

  // centerTo가 바뀌면 지도 중심 이동 (delivery 모드일 때만 줌인)
  useEffect(() => {
    if (!ready || !mapRef.current || !centerTo || !window.kakao?.maps) return
    if (mode === 'delivery') mapRef.current.setLevel(3)
    mapRef.current.panTo(new window.kakao.maps.LatLng(centerTo.lat, centerTo.lng))
  }, [ready, centerTo, mode])

  const pathMarkersRef = useRef<any[]>([])
  const pathPolylinesRef = useRef<any[]>([])

  // heatmap 모드에서 여러 경로(paths) 표시
  useEffect(() => {
    if (!ready || !mapRef.current || mode !== 'heatmap') return

    // 기존 경로 제거
    pathMarkersRef.current.forEach((m) => m.setMap(null))
    pathMarkersRef.current = []
    pathPolylinesRef.current.forEach((p) => p.setMap(null))
    pathPolylinesRef.current = []

    if (!paths || paths.length === 0) return

    paths.forEach(({ points: pts, color, pickupPoints, deliveryPoints }) => {
      if (pts.length < 2) return
      const linePath = pts.map((p) => new window.kakao.maps.LatLng(p.lat, p.lng))
      const polyline = new window.kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 4,
        strokeColor: color,
        strokeOpacity: 0.85,
        strokeStyle: 'solid',
        zIndex: 10,
      })
      polyline.setMap(mapRef.current)
      pathPolylinesRef.current.push(polyline)

      // 픽업 마커 이미지 (Group_3.png)
      const pPoints = pickupPoints ?? [{ lat: pts[0].lat, lng: pts[0].lng }]
      pPoints.forEach((p) => {
        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(p.lat, p.lng),
          content: `<div style="width:36px;height:36px;"><img src="/Group_3.png" style="width:36px;height:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));" /></div>`,
          xAnchor: 0.5,
          yAnchor: 1.0,
          zIndex: 25,
          map: mapRef.current,
        })
        pathMarkersRef.current.push(overlay)
      })

      // 배달 마커 이미지 (Group_1.png)
      const dPoints = deliveryPoints ?? [{ lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lng }]
      dPoints.forEach((p) => {
        const overlay = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(p.lat, p.lng),
          content: `<div style="width:36px;height:36px;"><img src="/Group_1.png" style="width:36px;height:36px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));" /></div>`,
          xAnchor: 0.5,
          yAnchor: 1.0,
          zIndex: 25,
          map: mapRef.current,
        })
        pathMarkersRef.current.push(overlay)
      })

      // 화살표
      for (let i = 0; i < linePath.length - 1; i++) {
        const p1 = linePath[i]
        const p2 = linePath[i + 1]
        const midLat = (p1.getLat() + p2.getLat()) / 2
        const midLng = (p1.getLng() + p2.getLng()) / 2
        const dy = p2.getLat() - p1.getLat()
        const dx = p2.getLng() - p1.getLng()
        const angle = Math.atan2(dx, dy) * (180 / Math.PI)
        const arrow = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(midLat, midLng),
          content: `<div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;transform:rotate(${angle}deg);">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
              <polygon points="12,3 20,18 12,14 4,18" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </div>`,
          zIndex: 15,
          map: mapRef.current,
        })
        pathMarkersRef.current.push(arrow)
      }
    })
  }, [ready, mode, paths])
  useEffect(() => {
    if (!ready || !mapRef.current || mode !== 'heatmap' || points.length === 0) return

    const bounds = new window.kakao.maps.LatLngBounds()
    points.forEach((p) => bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng)))
    mapRef.current.setBounds(bounds, 80)

    const currentLevel = mapRef.current.getLevel()
    if (currentLevel > 5) mapRef.current.setLevel(5)
    requestAnimationFrame(() => renderHeatmapRef.current())

    const onIdle = () => {
      renderHeatmapRef.current()
      window.kakao.maps.event.removeListener(mapRef.current, 'idle', onIdle)
    }
    window.kakao.maps.event.addListener(mapRef.current, 'idle', onIdle)
  }, [ready, points, mode])

  // delivery 모드: markers & path
  useEffect(() => {
    if (!ready || !mapRef.current || mode !== 'delivery') return

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }

    const makeMarker = (lat: number, lng: number, iconSrc: string) => {
      const imageSize = new window.kakao.maps.Size(40, 40)
      const markerImage = new window.kakao.maps.MarkerImage(iconSrc, imageSize)
      const marker = new window.kakao.maps.Marker({
        position: new window.kakao.maps.LatLng(lat, lng),
        image: markerImage,
        map: mapRef.current,
      })
      return marker
    }

    // 픽업 마커 — Group_3.png (식당 아이콘)
    if (pickupMarkers && pickupMarkers.length > 0) {
      pickupMarkers.forEach((m) => {
        const marker = makeMarker(m.lat, m.lng, '/Group_3.png')
        markersRef.current.push(marker)
      })
    }

    // 배달 마커 — Group_1.png (집 아이콘)
    if (deliveryMarkers && deliveryMarkers.length > 0) {
      deliveryMarkers.forEach((m) => {
        const marker = makeMarker(m.lat, m.lng, '/Group_1.png')
        markersRef.current.push(marker)
      })
    }

    // 기존 markers prop 폴백 (일반 파란 마커)
    if (!pickupMarkers && !deliveryMarkers && markers) {
      markers.forEach((m) => {
        const marker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(m.lat, m.lng),
          map: mapRef.current,
        })
        markersRef.current.push(marker)
      })
    }

    if (path && path.length > 0) {
      const linePath = path.map((p) => new window.kakao.maps.LatLng(p.lat, p.lng))
      const polyline = new window.kakao.maps.Polyline({
        path: linePath,
        strokeWeight: 5,
        strokeColor: pathColor,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
        zIndex: 10,
      })
      polyline.setMap(mapRef.current)
      polylineRef.current = polyline

      // 경로 구간마다 화살표 방향 표시
      for (let i = 0; i < linePath.length - 1; i++) {
        const p1 = linePath[i]
        const p2 = linePath[i + 1]

        // 중간 지점
        const midLat = (p1.getLat() + p2.getLat()) / 2
        const midLng = (p1.getLng() + p2.getLng()) / 2

        // 두 점 사이 각도 계산 (북쪽 기준)
        const dy = p2.getLat() - p1.getLat()
        const dx = p2.getLng() - p1.getLng()
        const angle = Math.atan2(dx, dy) * (180 / Math.PI)

        const arrowContent = `
          <div style="
            width:24px;height:24px;
            display:flex;align-items:center;justify-content:center;
            transform:rotate(${angle}deg);
            filter:drop-shadow(0 1px 3px rgba(0,0,0,0.3));
          ">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <polygon points="12,3 20,18 12,14 4,18" fill="${pathColor}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </div>`

        const arrow = new window.kakao.maps.CustomOverlay({
          position: new window.kakao.maps.LatLng(midLat, midLng),
          content: arrowContent,
          zIndex: 15,
          map: mapRef.current,
        })
        markersRef.current.push(arrow)
      }
    }

    const allPoints = [
      ...(pickupMarkers ?? markers ?? []),
      ...(deliveryMarkers ?? []),
    ]
    // centerTo가 있으면 setBounds 생략 (출발점으로 가기 버튼이 zoom을 제어)
    if (allPoints.length > 0 && !centerTo) {
      const bounds = new window.kakao.maps.LatLngBounds()
      allPoints.forEach((m) => bounds.extend(new window.kakao.maps.LatLng(m.lat, m.lng)))
      mapRef.current.setBounds(bounds, 80)
      const currentLevel = mapRef.current.getLevel()
      if (currentLevel > 7) mapRef.current.setLevel(7)
    }
  }, [ready, mode, markers, pickupMarkers, deliveryMarkers, path, centerTo, pathColor])

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden"
    >
      <div ref={mapLayerRef} className="absolute inset-0 z-0" />
      {mode === 'heatmap' && (
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10" />
      )}
      {/* 파란 점 — heatmap 모드이고 fixedPosition 없을 때만 화면 중앙에 표시 */}
      {mode === 'heatmap' && !fixedPosition && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
          <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20" />
        </div>
      )}
      {/* fixedPosition 파란 점 — React DOM 오버레이 (canvas 위, z-40) */}
      {fixedPixel && (
        <div
          className="pointer-events-none absolute z-40"
          style={{ left: fixedPixel.x, top: fixedPixel.y, transform: 'translate(-50%, -50%)' }}
        >
          <div className="h-10 w-10 rounded-full bg-blue-500/20" />
          <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
        </div>
      )}
      {/* delivery 모드 파란 점 — 화면 중앙 고정 */}
      {mode === 'delivery' && !fixedPixel && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2">
          <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
          <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20" />
        </div>
      )}

      {badgeText && (
        <div className="absolute left-4 top-20 z-20 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow">
          {badgeText}
        </div>
      )}
    </div>
  )
}