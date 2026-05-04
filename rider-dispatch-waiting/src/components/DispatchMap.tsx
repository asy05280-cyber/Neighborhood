import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import type { OrderHeatPoint } from '../services/orderHeatmap'

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }
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
  path?: { lat: number; lng: number }[]
  badgeText?: string
  onCursorMove?: (lat: number, lng: number) => void
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

  const appKey = import.meta.env.VITE_KAKAO_MAP_APP_KEY
  console.log('KAKAO KEY:', appKey)

  if (!appKey || appKey.includes('${')) return false

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Kakao Map SDK'))
    document.head.appendChild(script)
  })

  return true
}

export function DispatchMap({
  mode = 'heatmap',
  points = [],
  markers,
  path,
  badgeText,
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
  const [isDragging, setIsDragging] = useState(false)

  const renderHeatmap = useCallback(() => {
    if (mode !== 'heatmap') return

    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root || points.length === 0) return

    const width = root.clientWidth
    const height = root.clientHeight
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

  useEffect(() => {
    const resizeHandler = () => {
      mapRef.current?.relayout()
      renderHeatmap()
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

          const center = new window.kakao.maps.LatLng(
            DEFAULT_CENTER.lat,
            DEFAULT_CENTER.lng
          )

          mapRef.current = new window.kakao.maps.Map(mapLayerRef.current, {
            center,
            level: 5,
          })
          
          let rafId: number | null = null

          const safeRender = () => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(renderHeatmap)
          }

          window.kakao.maps.event.addListener(mapRef.current, 'center_changed', safeRender)
          window.kakao.maps.event.addListener(mapRef.current, 'zoom_changed', safeRender)

          window.addEventListener('resize', resizeHandler)
          setReady(true)
          renderHeatmap()
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

  useEffect(() => {
  if (!ready || !mapRef.current || mode !== 'delivery') return

  markersRef.current.forEach((m) => m.setMap(null))
  markersRef.current = []

  if (polylineRef.current) {
    polylineRef.current.setMap(null)
    polylineRef.current = null
  }

  markers?.forEach((m) => {
    const marker = new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(m.lat, m.lng),
      map: mapRef.current,
    })
    markersRef.current.push(marker)
  })

  if (path && path.length > 0) {
    const linePath = path.map(
      (p) => new window.kakao.maps.LatLng(p.lat, p.lng)
    )

    const polyline = new window.kakao.maps.Polyline({
      path: linePath,
      strokeWeight: 5,
      strokeColor: '#FF0000',
      strokeOpacity: 1,
      strokeStyle: 'solid',
      zIndex: 10
    })

    polyline.setMap(mapRef.current)
    polylineRef.current = polyline
  }

  if (markers && markers.length > 0) {
    const bounds = new window.kakao.maps.LatLngBounds()
    markers.forEach((m) =>
      bounds.extend(new window.kakao.maps.LatLng(m.lat, m.lng))
    )
    mapRef.current.setBounds(bounds)
  }
}, [ready, mode, markers, path])

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!onCursorMove || !rootRef.current || !isDragging) return
    const rect = rootRef.current.getBoundingClientRect()
    const relX = (event.clientX - rect.left) / rect.width
    const relY = (event.clientY - rect.top) / rect.height
    const lng = DEFAULT_CENTER.lng + (relX - 0.5) * 0.035
    const lat = DEFAULT_CENTER.lat - (relY - 0.5) * 0.03
    onCursorMove(lat, lng)
  }

  return (
    <div
      ref={rootRef}
      className="relative h-full w-full overflow-hidden"
      onMouseDown={mode === 'heatmap' ? () => setIsDragging(true) : undefined}
      onMouseUp={mode === 'heatmap' ? () => setIsDragging(false) : undefined}
      onMouseLeave={mode === 'heatmap' ? () => setIsDragging(false) : undefined}
      onMouseMove={mode === 'heatmap' ? handleMouseMove : undefined}
    >

      <div ref={mapLayerRef} className="absolute inset-0 z-0" />
    {mode === 'heatmap' && (
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10" />
    )}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
        <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20" />
      </div>

      {badgeText && (
        <div className="absolute left-4 top-20 z-20 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow">
          {badgeText}
        </div>
      )}
    </div>
  )
}