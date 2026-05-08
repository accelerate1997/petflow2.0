import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: string
  trendPositive?: boolean
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = '#89A894',
  iconBg = 'rgba(137,168,148,0.12)',
  trend,
  trendPositive = true,
}: StatCardProps) {
  return (
    <div className="card p-4 md:p-6 flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[0.7rem] md:text-[0.8rem] text-gray-400 font-500 mb-1 truncate">
          {label}
        </p>
        <p className="text-xl md:text-3xl font-bold text-gray-900 leading-tight truncate">
          {value}
        </p>
        {trend && (
          <p className={`text-[0.65rem] md:text-[0.75rem] mt-1.5 font-500 ${trendPositive ? 'text-emerald-500' : 'text-amber-500'}`}>
            {trend}
          </p>
        )}
      </div>
      <div
        className="flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ width: 36, height: 36, background: iconBg }}
      >
        <Icon size={18} color={iconColor} className="md:w-[22px] md:h-[22px]" />
      </div>
    </div>
  )
}
