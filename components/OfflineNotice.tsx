'use client'

const GLASS = 'liquid-glass'

// Prikazuje se samo kad podaci NIKAD nisu keširani (nov korisnik koji je otišao
// offline pre prvog uspešnog učitavanja, ili godina koju nikad nije otvorio).
// Za sve ostale service worker servira keš i stranica se normalno iscrta.
export default function OfflineNotice({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className={`mx-auto mt-10 max-w-sm rounded-2xl p-8 text-center ${GLASS}`}>
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Nema interneta</p>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Podaci nisu sačuvani.</p>
      <button
        onClick={onRetry ?? (() => window.location.reload())}
        className="mt-4 inline-flex rounded-lg bg-[#024c7d] px-4 py-2 text-xs font-medium text-white
                   hover:bg-[#013d6a] dark:bg-[#60c3ad] dark:text-[#024c7d] dark:hover:bg-[#4db3a0] transition-colors"
      >
        Osveži
      </button>
    </div>
  )
}
