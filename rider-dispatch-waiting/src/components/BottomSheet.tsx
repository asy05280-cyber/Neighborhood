export function BottomSheet() {
  return (
    <div className="absolute bottom-0 left-0 z-40 w-full p-4 pb-6">
      <div className="rounded-3xl bg-white/95 p-5 shadow-2xl shadow-slate-900/20 backdrop-blur">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-slate-200" />
        <p className="text-lg font-bold text-slate-900">주문건을 찾고 있습니다</p>
        <p className="mt-1 text-sm font-medium text-slate-900">붉은 지역으로 이동하면 배차 가능</p>
      </div>
    </div>
  )
}
