declare global {
  interface KakaoMap {
    relayout: () => void
    getProjection: () => {
      containerPointFromCoords: (coords: unknown) => { x: number; y: number }
    }
  }

  interface Window {
    kakao?: {
      maps: {
        load: (callback: () => void) => void
        LatLng: new (lat: number, lng: number) => unknown
        Map: new (container: HTMLElement, options: { center: unknown; level: number }) => KakaoMap
        event: {
          addListener: (target: unknown, type: string, handler: () => void) => void
          removeListener: (target: unknown, type: string, handler: () => void) => void
        }
      }
    }
  }
}

export {}
