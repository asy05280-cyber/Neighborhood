import { useState } from 'react'
import { LiveDispatchScreen } from './screens/LiveDispatchScreen'
import { DeliveryScreen } from './screens/DeliveryScreen'

function App() {
  const [mode, setMode] = useState<'live' | 'delivery'>('live')

  return (
    <main className="h-full w-full bg-gradient-to-b from-emerald-50 to-slate-100">
      <section className="relative mx-auto h-full w-full max-w-[430px] overflow-hidden bg-white shadow-2xl shadow-slate-900/20">
        <div className="absolute left-4 top-24 z-40 flex gap-2 rounded-2xl bg-white/95 p-1 shadow-lg shadow-slate-900/15">
          <button
            onClick={() => setMode('live')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${mode === 'live' ? 'bg-emerald-500 text-white' : 'text-slate-600'}`}
          >
            실데이터 버전
          </button>
          <button
            onClick={() => setMode('delivery')}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${mode === 'delivery' ? 'bg-emerald-500 text-white' : 'text-slate-600'}`}
          >
            배달 화면
          </button>
        </div>

        {mode === 'live' ? <LiveDispatchScreen /> : <DeliveryScreen />}
      </section>
    </main>
  )
}

export default App

