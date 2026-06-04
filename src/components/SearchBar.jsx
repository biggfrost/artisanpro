import { Search, X } from 'lucide-react'

export default function SearchBar({ value, onChange, placeholder = 'Rechercher…' }) {
  return (
    <div className="relative mb-4">
      <Search
        size={16}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-primary-900 focus:ring-2 focus:ring-primary-900/10 transition-colors"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
