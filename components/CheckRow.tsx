'use client'

// Red sa checkboxom za listu predmeta. Pravi <input> je sakriven (i dalje
// radi tastatura i čitač ekrana), a vidljiva kućica je nacrtana da bi imala
// istu boju i zaobljenje kao ostatak aplikacije i animiranu kvačicu.
export default function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: () => void
  label: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors ${
        checked
          ? 'bg-[#024c7d]/6 dark:bg-[#60c3ad]/10'
          : 'hover:bg-white/70 dark:hover:bg-gray-800/60'
      }`}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[#024c7d] peer-focus-visible:ring-offset-1 dark:peer-focus-visible:ring-[#60c3ad] ${
          checked
            ? 'border-[#024c7d] bg-[#024c7d] text-white dark:border-[#60c3ad] dark:bg-[#60c3ad] dark:text-[#024c7d]'
            : 'border-gray-300 bg-white/80 dark:border-gray-600 dark:bg-gray-900/60'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-3 transition-transform duration-200 ease-out ${checked ? 'scale-100' : 'scale-0'}`}
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      </span>
      <span
        className={`text-[13px] leading-snug transition-colors ${
          checked ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'
        }`}
      >
        {label}
      </span>
    </label>
  )
}
