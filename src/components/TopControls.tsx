type TopControlsProps = {
  status?: 'searching' | 'assigned'
}

export function TopControls({ status = 'searching' }: TopControlsProps) {
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-40 flex w-full items-center justify-center px-4 pt-5">
      <div className="pointer-events-none rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20">
        업무 중
      </div>
    </div>
  )
}