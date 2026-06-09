'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BedDouble, Plus, Search, Trash2, Edit2, Calendar,
  CheckCircle, XCircle, Clock, RefreshCw, ChevronRight,
  Moon, PawPrint, Phone, FileText
} from 'lucide-react'
import AddRoomModal from '@/components/AddRoomModal'
import NewReservationModal from '@/components/NewReservationModal'
import EditReservationModal from '@/components/EditReservationModal'
import CheckoutModal from '@/components/CheckoutModal'
import CheckInModal from '@/components/CheckInModal'
import CheckInSheetModal from '@/components/CheckInSheetModal'
import CareLogModal from '@/components/CareLogModal'
import AddOnServiceModal from '@/components/AddOnServiceModal'
import type { BoardingRoom, BoardingReservation } from '@/types'
import {
  getBoardingRooms, getBoardingReservations,
  updateBoardingRoom, updateBoardingReservation,
  deleteBoardingRoom, deleteBoardingReservation,
  updateBoardingPaymentStatus, getSettings
} from '@/lib/actions'
import { getLocalDateString } from '@/lib/dateUtils'

export const dynamic = 'force-dynamic'

// ── Helpers ──────────────────────────────────────────────────────────────────

// fmt function is defined locally inside BoardingPage component

const SIZE_STYLE: Record<string, { bg: string; color: string; emoji: string }> = {
  Small:  { bg: '#f0fdf4', color: '#16a34a', emoji: '🐩' },
  Medium: { bg: '#fffbeb', color: '#d97706', emoji: '🐕' },
  Large:  { bg: '#fef2f2', color: '#dc2626', emoji: '🐕‍🦺' },
  Cat:    { bg: '#eff6ff', color: '#2563eb', emoji: '🐱' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  Reserved:   { bg: '#eff6ff', color: '#2563eb', label: 'Reserved' },
  CheckedIn:  { bg: '#f0fdf4', color: '#16a34a', label: 'Checked In' },
  CheckedOut: { bg: '#f9fafb', color: '#9ca3af', label: 'Checked Out' },
  Cancelled:  { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
}

const TYPE_COLOR: Record<string, string> = {
  Standard: '#6b7280', Deluxe: '#d97706', Suite: '#7c3aed'
}

function todayStr() { return getLocalDateString() }

function getRoomCurrentReservation(room: BoardingRoom): BoardingReservation | null {
  const today = todayStr()
  return (room.reservations || []).find(r =>
    r.status === 'CheckedIn' ||
    (r.status === 'Reserved' && r.check_in_date <= today && r.check_out_date > today)
  ) as BoardingReservation | null || null
}

function getRoomStatus(room: BoardingRoom): 'Available' | 'Occupied' | 'Reserved' | 'Maintenance' {
  if (room.status === 'Maintenance') return 'Maintenance'
  const today = todayStr()
  const active = (room.reservations || []).find(r => {
    if (['Cancelled', 'CheckedOut'].includes(r.status)) return false
    return r.check_in_date <= today && r.check_out_date > today
  })
  if (!active) return 'Available'
  return active.status === 'CheckedIn' ? 'Occupied' : 'Reserved'
}

const ROOM_STATUS_STYLE = {
  Available:   { dot: '#22c55e', bg: '#f0fdf4', color: '#16a34a', label: 'Available' },
  Occupied:    { dot: '#ef4444', bg: '#fef2f2', color: '#dc2626', label: 'Occupied' },
  Reserved:    { dot: '#f59e0b', bg: '#fffbeb', color: '#d97706', label: 'Reserved' },
  Maintenance: { dot: '#9ca3af', bg: '#f9fafb', color: '#6b7280', label: 'Maintenance' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'rooms' | 'calendar' | 'reservations'

export default function BoardingPage() {
  const [tab, setTab]                     = useState<Tab>('rooms')
  const [rooms, setRooms]                 = useState<BoardingRoom[]>([])
  const [reservations, setReservations]   = useState<BoardingReservation[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [showAddRoom, setShowAddRoom]     = useState(false)
  const [editRoom, setEditRoom]           = useState<BoardingRoom | null>(null)
  const [showNewRes, setShowNewRes]       = useState(false)
  const [editReservation, setEditReservation] = useState<BoardingReservation | null>(null)
  const [checkoutRes, setCheckoutRes]     = useState<BoardingReservation | null>(null)
  const [resFilter, setResFilter]         = useState<'upcoming' | 'active' | 'past' | 'all'>('upcoming')
  const [calendarOffset, setCalendarOffset] = useState(0) // days offset from today
  const [checkInRes, setCheckInRes]         = useState<BoardingReservation | null>(null)
  const [viewCheckInRes, setViewCheckInRes] = useState<BoardingReservation | null>(null)
  const [careLogRes, setCareLogRes]         = useState<BoardingReservation | null>(null)
  const [daysRange, setDaysRange]           = useState<7 | 14 | 30>(7)
  const [calendarNewResRoomId, setCalendarNewResRoomId] = useState<string | null>(null)
  const [calendarNewResDate, setCalendarNewResDate] = useState<string | null>(null)
  const [addOnRes, setAddOnRes]             = useState<BoardingReservation | null>(null)
  const [currencyCode, setCurrencyCode] = useState('INR')
  const [currencySymbol, setCurrencySymbol] = useState('₹')
  const [spaSettings, setSpaSettings] = useState<any>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [r, res, settings] = await Promise.all([
        getBoardingRooms(),
        getBoardingReservations(resFilter),
        getSettings()
      ])
      setRooms(r as unknown as BoardingRoom[])
      setReservations(res as unknown as BoardingReservation[])
      if (settings) {
        setSpaSettings(settings)
        setCurrencyCode(settings.currency_code || 'INR')
        setCurrencySymbol(settings.currency_symbol || '₹')
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [resFilter])

  const fmt = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(n)
    } catch {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
    }
  }

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Delete this room? All future reservations will be cancelled.')) return
    await deleteBoardingRoom(id)
    fetchAll()
  }

  const handleStatusChange = async (res: BoardingReservation, newStatus: string) => {
    await updateBoardingReservation(res.id, { status: newStatus })
    fetchAll()
  }

  const handleToggleMaintenance = async (room: BoardingRoom) => {
    const newStatus = room.status === 'Maintenance' ? 'Available' : 'Maintenance'
    await updateBoardingRoom(room.id, { status: newStatus })
    fetchAll()
  }

  // ── Stats ──
  const totalRooms     = rooms.length
  const occupiedRooms  = rooms.filter(r => getRoomStatus(r) === 'Occupied').length
  const availableRooms = rooms.filter(r => getRoomStatus(r) === 'Available').length
  const occupancyRate  = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0

  // ── Calendar data (dynamic range grid) ──
  const calDays = Array.from({ length: daysRange }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + calendarOffset)
    return getLocalDateString(d)
  })

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.room_type.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 md:p-8 max-w-[1200px] pb-24 md:pb-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">🏠 Pet Boarding</h1>
          <p className="text-gray-400 text-sm">Manage kennels, rooms, and boarding reservations</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => { setShowAddRoom(true); setEditRoom(null) }}>
            <BedDouble size={16} /> Add Room
          </button>
          <button className="btn-sage" onClick={() => setShowNewRes(true)}>
            <Plus size={16} /> New Reservation
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Rooms', value: totalRooms,     icon: '🏠', color: '#6366f1' },
          { label: 'Occupied',    value: occupiedRooms,  icon: '🔴', color: '#ef4444' },
          { label: 'Available',   value: availableRooms, icon: '🟢', color: '#22c55e' },
          { label: 'Occupancy',   value: `${occupancyRate}%`, icon: '📊', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400 font-600">{s.label}</span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <p className="text-2xl font-800" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b overflow-x-auto hide-scrollbar" style={{ borderColor: '#f3f4f6' }}>
        {(['rooms', 'calendar', 'reservations'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
              textTransform: 'capitalize', whiteSpace: 'nowrap',
              color: tab === t ? 'var(--sage-dark)' : '#9ca3af',
              borderBottom: tab === t ? '2px solid var(--sage)' : '2px solid transparent',
              transition: 'all 0.2s', cursor: 'pointer',
            }}>
            {t === 'rooms' ? '🛏️ Rooms' : t === 'calendar' ? '📅 Calendar' : '📋 Reservations'}
          </button>
        ))}
      </div>

      {/* ═══════════════ ROOMS TAB ═══════════════ */}
      {tab === 'rooms' && (
        <>
          <div className="flex items-center gap-3 mb-5">
            <div className="card flex-1 px-4 py-2.5 flex items-center gap-2">
              <Search size={16} className="text-gray-400" />
              <input placeholder="Search rooms..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '0.875rem', color: 'var(--text)', width: '100%', background: 'transparent' }} />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="card h-40 animate-pulse" style={{ background: '#f3f4f6' }} />)}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="card h-64 flex flex-col items-center justify-center text-center text-gray-400">
              <BedDouble size={48} className="mb-4 opacity-20" />
              <p className="font-600">No rooms found</p>
              <p className="text-sm">Add your first kennel or room to get started!</p>
              <button className="btn-sage mt-4" onClick={() => setShowAddRoom(true)}>
                <Plus size={16} /> Add Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map(room => {
                const status   = getRoomStatus(room)
                const ss       = ROOM_STATUS_STYLE[status]
                const sz       = SIZE_STYLE[room.size_category] || SIZE_STYLE.Medium
                const currRes  = getRoomCurrentReservation(room)
                return (
                  <div key={room.id} className="card p-5 group flex flex-col hover:border-[#89A894] transition-all">
                    {/* Top row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center rounded-2xl text-2xl w-12 h-12" style={{ background: sz.bg }}>
                          {sz.emoji}
                        </div>
                        <div>
                          <h3 className="font-700 text-[1rem]">{room.name}</h3>
                          <p className="text-xs font-600" style={{ color: TYPE_COLOR[room.room_type] || '#6b7280' }}>
                            {room.room_type} · {room.size_category}
                          </p>
                        </div>
                      </div>
                      {/* Status dot */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.65rem] font-700"
                        style={{ background: ss.bg, color: ss.color }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: ss.dot }} />
                        {ss.label}
                      </div>
                    </div>

                    {/* Current pet */}
                    {currRes ? (
                      <div className="rounded-lg p-2.5 mb-3 flex items-center justify-between gap-2"
                        style={{ background: 'var(--sage-muted)', border: '1px solid rgba(137,168,148,0.2)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <PawPrint size={14} style={{ color: 'var(--sage-dark)', flexShrink: 0 }} />
                          <div className="min-w-0">
                            <p className="text-[0.75rem] font-700 truncate">{currRes.pet?.pet_name}</p>
                            <p className="text-[0.65rem] text-gray-400 truncate">
                              Until {currRes.check_out_date}
                            </p>
                          </div>
                        </div>
                        {currRes.status === 'CheckedIn' && (
                          <button 
                            type="button"
                            title="Check-in Sheet"
                            onClick={(e) => {
                              e.stopPropagation()
                              setViewCheckInRes(currRes)
                            }}
                            className="p-1 rounded bg-white hover:bg-gray-100 text-gray-500 hover:text-sage-dark border border-gray-100 transition-colors cursor-pointer flex items-center justify-center"
                          >
                            <FileText size={12} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg p-2.5 mb-3 flex items-center gap-2" style={{ background: '#f9fafb' }}>
                        <Moon size={13} className="text-gray-300" />
                        <p className="text-[0.72rem] text-gray-400 italic">No current guest</p>
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#f3f4f6' }}>
                      <span className="text-xs text-gray-400 font-600">RATE</span>
                      <span className="font-800 text-[1rem]">{fmt(room.price_per_night)}<span className="text-xs text-gray-400 font-500">/night</span></span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditRoom(room); setShowAddRoom(true) }}
                        className="flex-1 py-1.5 rounded-lg text-xs font-700 border hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={() => handleToggleMaintenance(room)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-700 border transition-colors flex items-center justify-center gap-1"
                        style={{ color: room.status === 'Maintenance' ? '#22c55e' : '#f59e0b',
                                 borderColor: room.status === 'Maintenance' ? '#bbf7d0' : '#fde68a',
                                 background: room.status === 'Maintenance' ? '#f0fdf4' : '#fffbeb' }}>
                        <RefreshCw size={12} /> {room.status === 'Maintenance' ? 'Activate' : 'Maintenance'}
                      </button>
                      <button onClick={() => handleDeleteRoom(room.id)}
                        className="p-1.5 rounded-lg border hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════════════ CALENDAR TAB ═══════════════ */}
      {tab === 'calendar' && (
        <div>
          {/* Navigation & Range Select */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <button className="btn-outline py-1.5 px-3 text-sm" onClick={() => setCalendarOffset(o => o - daysRange)}>← Prev</button>
              <button className="btn-outline py-1.5 px-3 text-sm" onClick={() => setCalendarOffset(0)}>Today</button>
              <button className="btn-outline py-1.5 px-3 text-sm" onClick={() => setCalendarOffset(o => o + daysRange)}>Next →</button>
              <span className="text-sm text-gray-500 ml-2">
                {new Date(calDays[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} –{' '}
                {new Date(calDays[calDays.length - 1]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="flex gap-1.5 bg-gray-100 p-0.5 rounded-lg border border-gray-200">
              {([7, 14, 30] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setDaysRange(r); setCalendarOffset(0) }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    daysRange === r ? 'bg-white text-sage-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {r === 7 ? '7 Days' : r === 14 ? '14 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <th className="text-left py-3 px-4 text-[0.72rem] font-700 text-gray-500 uppercase w-32">Room</th>
                    {calDays.map(d => {
                      const dt = new Date(d + 'T00:00:00')
                      const isToday = d === todayStr()
                      return (
                        <th key={d} className="py-3 px-2 text-center text-[0.72rem] font-700" style={{ color: isToday ? 'var(--sage-dark)' : '#9ca3af' }}>
                          <div>{dt.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
                          <div className={`text-[1rem] font-800 ${isToday ? 'text-sage-dark' : 'text-gray-700'}`}
                            style={{ color: isToday ? 'var(--sage-dark)' : '#374151' }}>
                            {dt.getDate()}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room, idx) => (
                    <tr key={room.id} style={{ borderBottom: idx < rooms.length - 1 ? '1px solid #f9fafb' : 'none' }}>
                      <td className="py-2.5 px-4">
                        <div>
                          <p className="font-700 text-sm">{room.name}</p>
                          <p className="text-[0.65rem] text-gray-400">{room.room_type} · {SIZE_STYLE[room.size_category]?.emoji}</p>
                        </div>
                      </td>
                      {calDays.map(day => {
                        const res = (room.reservations || []).find(r => {
                          if (['Cancelled'].includes(r.status)) return false
                          return r.check_in_date <= day && r.check_out_date > day
                        })
                        const isToday = day === todayStr()
                        if (room.status === 'Maintenance') {
                          return (
                            <td key={day} className="py-2 px-1 text-center">
                              <div className="mx-auto w-full rounded-lg py-1.5 text-[0.6rem] font-700 text-center"
                                style={{ background: '#f9fafb', color: '#9ca3af' }}>🔧</div>
                            </td>
                          )
                        }
                        if (res) {
                          const isCheckIn  = res.check_in_date  === day
                          const isCheckOut = res.check_out_date === day
                          return (
                            <td key={day} className="py-2 px-1">
                              <div 
                                onClick={() => {
                                  if (['CheckedIn', 'CheckedOut'].includes(res.status)) {
                                    setViewCheckInRes(res)
                                  } else {
                                    setEditReservation(res)
                                  }
                                }}
                                className="mx-auto w-full rounded-lg py-1.5 px-1 text-center text-[0.6rem] font-700 truncate cursor-pointer hover:opacity-95 active:scale-95 transition-all shadow-sm"
                                style={{
                                  background: res.status === 'CheckedIn' ? '#f0fdf4' : '#eff6ff',
                                  color:      res.status === 'CheckedIn' ? '#16a34a' : '#2563eb',
                                  border:     res.status === 'CheckedIn' ? '1px solid #bbf7d0' : '1px solid #dbeafe',
                                  borderRadius: isCheckIn ? '8px 8px 8px 8px' : isCheckOut ? '0 8px 8px 0' : '0',
                                }}
                                title={`${res.pet?.pet_name} (${res.status})\nOwner: ${res.pet?.owner?.name}\nDates: ${res.check_in_date} to ${res.check_out_date}\nClick to view sheet or edit.`}
                              >
                                {isCheckIn ? '📥 ' : ''}{res.pet?.pet_name || '●'}
                              </div>
                            </td>
                          )
                        }
                        return (
                          <td key={day} className="py-2 px-1">
                            <div 
                              onClick={() => {
                                setCalendarNewResRoomId(room.id)
                                setCalendarNewResDate(day)
                                setShowNewRes(true)
                              }}
                              className="mx-auto w-full rounded-lg py-3 text-center cursor-pointer hover:bg-sage-muted/40 hover:border-sage/40 transition-all border border-dashed border-transparent flex items-center justify-center text-[9px] font-bold text-gray-300 hover:text-sage-dark"
                              style={{ background: isToday ? '#f0fdf4' : '#f9fafb' }}
                              title={`Click to book ${room.name} on ${day}`}
                            >
                              +
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 px-4 py-3 border-t text-[0.7rem] text-gray-400 font-600" style={{ borderColor: '#f3f4f6' }}>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: '#f0fdf4' }} /> Checked In</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: '#eff6ff' }} /> Reserved</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: '#f9fafb' }} /> Available</span>
              <span className="flex items-center gap-1">🔧 Maintenance</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ RESERVATIONS TAB ═══════════════ */}
      {tab === 'reservations' && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2 mb-5 flex-wrap">
            {(['upcoming', 'active', 'past', 'all'] as const).map(f => (
              <button key={f} onClick={() => setResFilter(f)}
                className="px-4 py-1.5 rounded-full text-xs font-700 transition-all capitalize"
                style={{
                  background: resFilter === f ? 'var(--sage-dark)' : '#f3f4f6',
                  color:      resFilter === f ? 'white' : '#6b7280',
                }}>
                {f === 'active' ? '✅ Active' : f === 'upcoming' ? '📅 Upcoming' : f === 'past' ? '🕐 Past' : '📋 All'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse" style={{ background: '#f3f4f6' }} />)}
            </div>
          ) : reservations.length === 0 ? (
            <div className="card h-64 flex flex-col items-center justify-center text-center text-gray-400">
              <Calendar size={48} className="mb-4 opacity-20" />
              <p className="font-600">No reservations found</p>
              <button className="btn-sage mt-4" onClick={() => setShowNewRes(true)}>
                <Plus size={16} /> New Reservation
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reservations.map(res => {
                const ss = STATUS_STYLE[res.status] || STATUS_STYLE.Reserved
                const sz = SIZE_STYLE[res.room?.size_category || 'Medium'] || SIZE_STYLE.Medium
                return (
                  <div key={res.id} className="card p-4 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-3">
                      {/* Pet info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: sz.bg }}>
                          {sz.emoji}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-700 text-[0.95rem]">{res.pet?.pet_name}</h3>
                            <span className="text-[0.65rem] px-2 py-0.5 rounded-full font-700"
                              style={{ background: ss.bg, color: ss.color }}>{ss.label}</span>
                            
                            <button 
                              type="button"
                              disabled={['Cancelled', 'CheckedOut'].includes(res.status)}
                              onClick={() => {
                                const statuses = ['Pending', 'Paid', 'Cash', 'UPI'];
                                const currentStatus = res.payment_status || 'Pending';
                                const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length;
                                updateBoardingPaymentStatus(res.id, statuses[nextIdx]).then(() => {
                                  fetchAll()
                                })
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.5rem] font-900 border transition-all active:scale-95 disabled:opacity-80 disabled:pointer-events-none"
                              style={{ 
                                backgroundColor: res.payment_status === 'Pending' ? '#f9fafb' : 
                                                 ['Paid', 'Cash'].includes(res.payment_status) ? '#ecfdf5' : '#eff6ff',
                                color: res.payment_status === 'Pending' ? '#9ca3af' : 
                                       ['Paid', 'Cash'].includes(res.payment_status) ? '#059669' : '#2563eb',
                                borderColor: res.payment_status === 'Pending' ? '#f3f4f6' : 
                                             ['Paid', 'Cash'].includes(res.payment_status) ? '#d1fae5' : '#dbeafe',
                              }}
                            >
                              <span>{['Paid', 'Cash'].includes(res.payment_status) ? '💵' : res.payment_status === 'UPI' ? '📱' : '🕒'}</span>
                              <span className="uppercase">{res.payment_status || 'Pending'}</span>
                            </button>
                          </div>
                          <p className="text-xs text-gray-500">{res.pet?.owner?.name} · {res.pet?.owner?.whatsapp_number}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            🏠 {res.room?.name} ({res.room?.room_type}) · 📅 {res.check_in_date} → {res.check_out_date} · 🌙 {res.total_nights} nights
                          </p>
                        </div>
                      </div>

                      {/* Amount + actions */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <p className="font-800 text-[1.1rem]" style={{ color: 'var(--sage-dark)' }}>{fmt(res.total_amount)}</p>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                          {/* Edit — always visible for non-final statuses */}
                          {['Reserved', 'CheckedIn'].includes(res.status) && (
                            <button onClick={() => setEditReservation(res)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-700 flex items-center gap-1 transition-all"
                              style={{ background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}>
                              <Edit2 size={12} /> Edit
                            </button>
                          )}
                          {res.status === 'Reserved' && (
                            <button onClick={() => setCheckInRes(res)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-700 flex items-center gap-1 transition-all"
                              style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                              <CheckCircle size={12} /> Check In
                            </button>
                          )}
                          {res.status === 'CheckedIn' && (
                            <button onClick={() => setCheckoutRes(res)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-700 flex items-center gap-1 transition-all"
                              style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}>
                              <ChevronRight size={12} /> Check Out
                            </button>
                          )}
                          {res.status === 'CheckedIn' && (
                            <button onClick={() => setCareLogRes(res)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-700 flex items-center gap-1 transition-all"
                              style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                              📋 Log Care
                            </button>
                          )}
                          {res.status === 'CheckedIn' && (
                            <button onClick={() => setAddOnRes(res)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-700 flex items-center gap-1 transition-all"
                              style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                              ➕ Add-on
                            </button>
                          )}
                          {['CheckedIn', 'CheckedOut'].includes(res.status) && (
                            <button onClick={() => setViewCheckInRes(res)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-700 flex items-center gap-1 transition-all"
                              style={{ background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb' }}>
                              <FileText size={12} /> Check-in Sheet
                            </button>
                          )}
                          {['Reserved', 'CheckedIn'].includes(res.status) && (
                            <button onClick={() => handleStatusChange(res, 'Cancelled')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-700 flex items-center gap-1 transition-all"
                              style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                              <XCircle size={12} /> Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes section */}
                    {(res.feeding_notes || res.medication_notes || res.special_notes || res.emergency_contact) && (
                      <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2" style={{ borderColor: '#f3f4f6' }}>
                        {res.feeding_notes && (
                          <p className="text-[0.7rem] text-gray-500"><span className="font-700">🍖 Feeding:</span> {res.feeding_notes}</p>
                        )}
                        {res.medication_notes && (
                          <p className="text-[0.7rem] text-gray-500"><span className="font-700">💊 Meds:</span> {res.medication_notes}</p>
                        )}
                        {res.special_notes && (
                          <p className="text-[0.7rem] text-gray-500"><span className="font-700">📝 Notes:</span> {res.special_notes}</p>
                        )}
                        {res.emergency_contact && (
                          <p className="text-[0.7rem] text-gray-500 flex items-center gap-1">
                            <Phone size={10} /> {res.emergency_contact}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {showAddRoom && (
        <AddRoomModal
          room={editRoom}
          currencySymbol={currencySymbol}
          onClose={() => { setShowAddRoom(false); setEditRoom(null) }}
          onSuccess={fetchAll}
        />
      )}
      {showNewRes && (
        <NewReservationModal
          rooms={rooms}
          currencySymbol={currencySymbol}
          defaultRoomId={calendarNewResRoomId || undefined}
          defaultCheckInDate={calendarNewResDate || undefined}
          onClose={() => {
            setShowNewRes(false)
            setCalendarNewResRoomId(null)
            setCalendarNewResDate(null)
          }}
          onSuccess={() => {
            fetchAll()
            setShowNewRes(false)
            setCalendarNewResRoomId(null)
            setCalendarNewResDate(null)
          }}
        />
      )}
      {editReservation && (
        <EditReservationModal
          reservation={editReservation}
          rooms={rooms}
          currencySymbol={currencySymbol}
          onClose={() => setEditReservation(null)}
          onSuccess={() => { fetchAll(); setEditReservation(null) }}
        />
      )}
      {checkoutRes && (
        <CheckoutModal
          boardingReservation={checkoutRes}
          onClose={() => setCheckoutRes(null)}
          onSuccess={() => { fetchAll(); setCheckoutRes(null) }}
        />
      )}
      {checkInRes && (
        <CheckInModal
          reservation={checkInRes}
          onClose={() => setCheckInRes(null)}
          onSuccess={() => { fetchAll(); setCheckInRes(null) }}
        />
      )}
      {viewCheckInRes && (
        <CheckInSheetModal
          reservation={viewCheckInRes}
          currencyCode={currencyCode}
          onClose={() => setViewCheckInRes(null)}
        />
      )}
      {careLogRes && (
        <CareLogModal
          reservation={careLogRes}
          onClose={() => setCareLogRes(null)}
          onSuccess={() => { fetchAll(); setCareLogRes(null) }}
        />
      )}
      {addOnRes && (
        <AddOnServiceModal
          reservation={addOnRes}
          currencySymbol={currencySymbol}
          onClose={() => setAddOnRes(null)}
          onSuccess={() => { fetchAll(); setAddOnRes(null) }}
        />
      )}
    </div>
  )
}
