import { useMemo, useState } from 'react'
import { DispatchMap } from '../components/DispatchMap'
import { RiderChrome } from '../components/RiderChrome'
import { DEFAULT_REAL_POINTS, type OrderHeatPoint } from '../services/orderHeatmap'

export function LiveDispatchScreen() {
  const [manualJson] = useState(JSON.stringify(DEFAULT_REAL_POINTS, null, 2))

  const points = useMemo<OrderHeatPoint[]>(() => {
    try {
      const parsed = JSON.parse(manualJson) as OrderHeatPoint[]
      if (!Array.isArray(parsed)) return []
      return parsed.filter(
        (item) =>
          typeof item?.lat === 'number' &&
          typeof item?.lng === 'number' &&
          typeof item?.count === 'number'
      )
    } catch {
      return []
    }
  }, [manualJson])

  return (
    <>
      <DispatchMap points={points} />
      <RiderChrome />
    </>
  )
}

