'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, Coins, Receipt, BarChart2, Award, Loader2, Users, ShoppingBag, CheckCircle, AlertTriangle } from 'lucide-react'
import { getFinancialStats, getSettings } from '@/lib/actions'

export const dynamic = 'force-dynamic'

type FinancialStats = Awaited<ReturnType<typeof getFinancialStats>>

const PIE_COLORS = ['#89A894', '#6d8f7a', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']

// fmt function will be defined locally inside AnalyticsPage component to access state

function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string; icon: any; color: string; sub?: string
}) {
  return (
    <div className="card p-3 md:p-5 flex items-center gap-3 md:gap-4">
      <div style={{ 
        width: 40, height: 40, 
        background: `${color}18`, borderRadius: 12, 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        flexShrink: 0 
      }} className="md:w-12 md:h-12 md:rounded-xl">
        <Icon size={20} style={{ color }} className="md:w-[22px] md:h-[22px]" />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }} className="md:text-[0.68rem] md:mb-1">{label}</p>
        <p style={{ fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.1, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="md:text-[1.4rem]">{value}</p>
        {sub && <p style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: 1 }} className="hidden md:block md:text-[0.72rem] md:mt-2">{sub}</p>}
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'7days' | '30days' | 'thismonth' | '6months' | 'all'>('6months')
  const [currencyCode, setCurrencyCode] = useState('INR')
  const [currencySymbol, setCurrencySymbol] = useState('₹')
  const [stats, setStats] = useState<FinancialStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(n)
    } catch {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
    }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getFinancialStats(timeRange),
      getSettings()
    ])
      .then(([d, settings]) => {
        setStats(d)
        if (settings) {
          setCurrencyCode(settings.currency_code || 'INR')
          setCurrencySymbol(settings.currency_symbol || '₹')
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [timeRange])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 12, color: '#9ca3af' }}>
        <Loader2 size={36} className="animate-spin text-sage-dark" />
        <p style={{ fontSize: '0.875rem' }}>Loading analytics...</p>
      </div>
    )
  }

  if (!stats) return null

  const totalPayments = stats.paymentBreakdown.Cash + stats.paymentBreakdown.UPI + stats.paymentBreakdown.Split

  return (
    <div className="p-3 md:p-8 max-w-[1200px] pb-24 md:pb-8">
      {/* Header & Date Range Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 4 }}>Analytics 📊</h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Financial performance and operational insights for your spa</p>
        </div>
        <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200 self-start sm:self-center">
          {([
            { key: '7days', label: '7 Days' },
            { key: '30days', label: '30 Days' },
            { key: 'thismonth', label: 'This Month' },
            { key: '6months', label: '6 Months' },
            { key: 'all', label: 'All Time' }
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTimeRange(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeRange === t.key ? 'bg-white text-sage-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
        <KpiCard label="Gross Revenue" value={fmt(stats.totalRevenue)} icon={Coins} color="#10b981" />
        <KpiCard label="Grooming Revenue" value={fmt(stats.totalServiceRevenue || 0)} icon={Award} color="#8b5cf6" sub="Spa treatments" />
        <KpiCard label="Boarding Revenue" value={fmt(stats.totalBoardingRevenue || 0)} icon={Receipt} color="#3b82f6" sub="Lodging stay rates" />
        <KpiCard label="Product Revenue" value={fmt(stats.totalProductRevenue || 0)} icon={ShoppingBag} color="#f59e0b" sub="Retail sales" />
      </div>

      {/* Revenue Chart */}
      <div className="card p-4 md:p-5 mb-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Revenue Breakdown</h2>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 20 }}>Comparing Grooming vs Boarding vs Product revenue trends</p>
        {stats.monthlyRevenue.length === 0 || stats.monthlyRevenue.every(d => d.revenue === 0) ? (
          <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', flexDirection: 'column', gap: 8 }}>
            <TrendingUp size={40} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '0.875rem' }}>No invoices yet — complete a checkout to see data here.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={stats.monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="serviceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="boardingGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="productGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => `${currencySymbol}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip 
                content={({ active, payload, label }: any) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-800">
                        <p className="text-[0.65rem] text-slate-400 font-800 uppercase mb-2">{label} Report</p>
                        {payload.map((p: any, i: number) => (
                          <div key={i} className="flex items-center justify-between gap-6 mb-1 last:mb-0">
                            <span className="text-[0.75rem] font-600" style={{ color: p.color }}>{p.name}:</span>
                            <span className="text-[0.85rem] font-800">{fmt(p.value)}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area type="monotone" name="Grooming" dataKey="service" stackId="1" stroke="#8b5cf6" strokeWidth={2} fill="url(#serviceGrad)" />
              <Area type="monotone" name="Boarding" dataKey="boarding" stackId="1" stroke="#3b82f6" strokeWidth={2} fill="url(#boardingGrad)" />
              <Area type="monotone" name="Product" dataKey="product" stackId="1" stroke="#f59e0b" strokeWidth={2} fill="url(#productGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column row: Service Mix + Groomer Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Service Mix */}
        <div className="card p-5">
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Service Mix</h2>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 16 }}>Revenue by service type</p>
          {stats.serviceMix.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', flexDirection: 'column', gap: 8 }}>
              <Award size={36} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '0.8rem' }}>No completed appointments yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={stats.serviceMix}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={85}
                  paddingAngle={3} dataKey="value"
                >
                  {stats.serviceMix.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Groomer Performance */}
        <div className="card p-5">
          <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Staff Performance</h2>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 16 }}>Revenue generated per groomer</p>
          {stats.groomerPerformance.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', flexDirection: 'column', gap: 8 }}>
              <Users size={36} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '0.8rem' }}>Assign groomers to appointments to see data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.groomerPerformance} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `${currencySymbol}${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="revenue" fill="#89A894" radius={[0, 6, 6, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Boarding Occupancy & Low Stock Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Boarding Occupancy & Stays Metrics */}
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>🏨 Boarding Occupancy</h2>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 16 }}>Stay statistics and kennel utilization rates</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 my-auto">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Stay Checkouts</p>
              <p className="text-xl font-bold text-slate-800">{stats.boardingMetrics?.totalStays || 0}</p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Total Nights</p>
              <p className="text-xl font-bold text-slate-800">{stats.boardingMetrics?.totalNights || 0} nights</p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Avg Stay Duration</p>
              <p className="text-xl font-bold text-slate-800">{stats.boardingMetrics?.avgStayDuration || 0} nights</p>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wide text-sage-dark">Active Occupancy</p>
              <p className="text-xl font-extrabold text-sage-dark">{stats.boardingMetrics?.occupancyRate || 0}%</p>
              <p className="text-[9px] text-gray-400 font-medium">{stats.boardingMetrics?.occupiedRooms || 0} / {stats.boardingMetrics?.totalRooms || 0} rooms active</p>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>⚠️ Low Stock Warnings</h2>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Items that need replenishment soon</p>
            </div>
            {stats.lowStockProducts?.length > 0 && (
              <span className="bg-red-50 text-red-600 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                {stats.lowStockProducts.length} ALERTS
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center min-h-[140px]">
            {stats.lowStockProducts?.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 text-center py-6">
                <CheckCircle size={32} className="text-[#10b981] opacity-70" />
                <p style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700 }}>All items fully stocked</p>
                <p className="text-[10px] text-gray-400">All inventory levels are above their configured low-stock thresholds.</p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[160px] pr-1 space-y-2">
                {stats.lowStockProducts?.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-red-50/40 border border-red-100 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{p.name}</p>
                      <p className="text-[10px] text-gray-400">Category: {p.category || 'Retail'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-red-600">Stock: {p.stock} {p.unit || 'pcs'}</p>
                      <p className="text-[9px] text-gray-400 font-semibold">Threshold: {p.low_stock_threshold}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      <div className="card p-5">
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Payment Methods</h2>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 20 }}>How clients prefer to pay</p>
        {totalPayments === 0 ? (
          <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', gap: 8 }}>
            <Receipt size={28} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '0.8rem' }}>No payments recorded yet</p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Cash 💵', count: stats.paymentBreakdown.Cash, color: '#10b981' },
              { label: 'UPI 📱', count: stats.paymentBreakdown.UPI, color: '#3b82f6' },
              { label: 'Split 💳', count: stats.paymentBreakdown.Split, color: '#8b5cf6' },
            ].map(({ label, count, color }) => {
              const pct = totalPayments > 0 ? Math.round((count / totalPayments) * 100) : 0
              return (
                <div key={label} style={{ flex: 1, minWidth: 120, background: `${color}08`, border: `1px solid ${color}22`, borderRadius: 12, padding: '16px 20px' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>{label}</p>
                  <p style={{ fontSize: '1.8rem', fontWeight: 900, color, lineHeight: 1 }}>{count}</p>
                  <div style={{ marginTop: 8, height: 4, background: `${color}22`, borderRadius: 99 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 4 }}>{pct}% of payments</p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recent Product Purchases */}
      <div className="card p-5 mt-6">
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Recent Product Purchases</h2>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 20 }}>Track which pet owners are buying which products</p>
        
        {stats.recentSales.length === 0 ? (
          <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', flexDirection: 'column', gap: 8 }}>
            <ShoppingBag size={32} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: '0.8rem' }}>No product sales recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Owner</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Product</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Total</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', borderBottom: '1px solid #f1f5f9' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentSales.map((sale: any) => (
                  <tr key={sale.id} className="hover:bg-gray-50/50 transition-colors">
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{sale.client?.name || 'Walk-in Client'}</p>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>{sale.client?.whatsapp_number || 'N/A'}</p>
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', margin: 0 }}>{sale.product.name}</p>
                      <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: 0 }}>{sale.product.category}</p>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
                      {sale.quantity}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', fontWeight: 800, color: '#10b981' }}>
                      {fmt(sale.total_price)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(sale.created).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
