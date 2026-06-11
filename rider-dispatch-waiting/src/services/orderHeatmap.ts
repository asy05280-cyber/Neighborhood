export type OrderHeatPoint = {
  lat: number
  lng: number
  count: number
}

export function convertOrdersToHeatPoints(orders: any[]): OrderHeatPoint[] {
  const map = new Map<string, OrderHeatPoint>()

  orders.forEach((o) => {
    const lat = o[2] + 1.5  // shop_lat
    const lng = o[3] + 1.5  // shop_lng

    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`

    if (map.has(key)) {
      map.get(key)!.count += 1
    } else {
      map.set(key, { lat, lng, count: 1 })
    }
  })

  return Array.from(map.values())
}

export async function fetchOrderHeatPoints(): Promise<OrderHeatPoint[]> {
  const res = await fetch("/STAGE3_TEST_9.json", {
    headers: {
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();

  if (!data || !data.ORDERS) {
    console.error("ORDERS 없음", data);
    return [];
  }

  return convertOrdersToHeatPoints(data.ORDERS)
}
