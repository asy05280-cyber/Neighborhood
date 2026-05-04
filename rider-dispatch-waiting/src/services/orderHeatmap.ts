export type OrderHeatPoint = {
  lat: number
  lng: number
  count: number
}

export const DEFAULT_REAL_POINTS: OrderHeatPoint[] = [
  { lat: 37.5665, lng: 126.978, count: 12 },
  { lat: 37.5651, lng: 126.9895, count: 30 },
  { lat: 37.5702, lng: 126.9822, count: 22 },
  { lat: 37.5639, lng: 126.9742, count: 18 },
  { lat: 37.5622, lng: 126.9865, count: 28 },
  { lat: 37.5688, lng: 126.9925, count: 34 },
  { lat: 37.5712, lng: 126.9764, count: 15 },
]

export async function fetchOrderHeatPoints(): Promise<OrderHeatPoint[]> {
  // Swap this with real API call later (FastAPI, etc.)
  // const response = await fetch("/api/orders/heat-points")
  // return (await response.json()) as OrderHeatPoint[]
  return Promise.resolve(DEFAULT_REAL_POINTS)
}

export function createDemoHeatPoints(centerLat: number, centerLng: number, size = 18): OrderHeatPoint[] {
  return Array.from({ length: size }).map(() => {
    const latOffset = (Math.random() - 0.5) * 0.03
    const lngOffset = (Math.random() - 0.5) * 0.03
    return {
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset,
      count: Math.floor(8 + Math.random() * 45),
    }
  })
}
