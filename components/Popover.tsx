'use client'

// Mali meni ispod dugmeta (FON strane, filter na Rokovima). Roditelj je
// `relative`; klik van menija ga zatvara.
export default function Popover({ open, onClose, children }: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="anim-up absolute right-0 top-full z-50 mt-2 min-w-52 rounded-xl bg-white/95 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-xl dark:bg-gray-900/95 dark:ring-white/10">
        {children}
      </div>
    </>
  )
}

export const POPOVER_STAVKA =
  'flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-gray-800 transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800'
