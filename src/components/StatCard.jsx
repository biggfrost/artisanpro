export default function StatCard({ icon: Icon, label, value, iconColor, iconBg, onClick }) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={`bg-white rounded-2xl p-4 shadow-card border border-slate-100 flex items-center gap-3 w-full text-left transition-all duration-150 ${
        onClick
          ? 'cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 active:scale-[0.97] active:shadow-card'
          : ''
      }`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        <Icon size={20} className={iconColor} strokeWidth={2} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-slate-900 leading-none mb-1">{value}</p>
        <p className="text-xs text-slate-500 leading-tight">{label}</p>
      </div>
    </Tag>
  )
}
