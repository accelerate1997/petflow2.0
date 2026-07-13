'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  User, 
  CalendarClock, 
  Camera, 
  Receipt, 
  FileText, 
  Truck, 
  MapPin, 
  Trash2,
  Search,
  Filter,
  SlidersHorizontal,
  RefreshCw,
  LayoutList,
  Kanban,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Smile,
  Scissors
} from 'lucide-react'
import BookAppointmentModal from '@/components/BookAppointmentModal'
import RescheduleModal from '@/components/RescheduleModal'
import GroomingRecordModal from '@/components/GroomingRecordModal'
import CheckoutModal from '@/components/CheckoutModal'
import type { Appointment, AppointmentStatus, Staff, Service, Van } from '@/types'
import { getTemperamentStyle } from '@/types'
import { 
  getAppointments, 
  updateAppointmentStatus, 
  updatePaymentStatus, 
  getSettings, 
  deleteAppointment,
  getStaff,
  getServices,
  getVans
} from '@/lib/actions'
import { useRouter } from 'next/navigation'
import { getLocalDateString } from '@/lib/dateUtils'

export const dynamic = 'force-dynamic'

const statusOrder: AppointmentStatus[] = ['Lead', 'Booked', 'CheckedIn', 'InService', 'Done', 'CheckOut']

const boardColumns: { key: AppointmentStatus; label: string; icon: string; color: string }[] = [
  { key: 'Booked',     label: 'Booked',      icon: '📅', color: '#3b82f6' },
  { key: 'CheckedIn',  label: 'Checked In',  icon: '📍', color: '#6366f1' },
  { key: 'InService',  label: 'In Service',  icon: '✂️', color: '#8b5cf6' },
  { key: 'Done',       label: 'Service Done',icon: '✅', color: '#10b981' },
  { key: 'CheckOut',   label: 'Checked Out', icon: '🧾', color: '#64748b' },
  { key: 'Cancelled',  label: 'Cancelled',   icon: '❌', color: '#ef4444' },
]

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [view, setView] = useState<'today' | 'tomorrow' | 'week' | 'all'>('today')
  const [activeViewMode, setActiveViewMode] = useState<'list' | 'kanban' | 'calendar'>('list')
  const [loading, setLoading] = useState(true)
  
  // Data lists for filters
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [servicesList, setServicesList] = useState<Service[]>([])
  const [vansList, setVansList] = useState<Van[]>([])
  
  // Modals state
  const [showModal, setShowModal] = useState(false)
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null)
  const [groomingRecordAppt, setGroomingRecordAppt] = useState<Appointment | null>(null)
  const [checkoutAppt, setCheckoutAppt] = useState<Appointment | null>(null)
  const [currencyCode, setCurrencyCode] = useState('INR')
  const [currencySymbol, setCurrencySymbol] = useState('₹')
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [groomerFilter, setGroomerFilter] = useState<string>('all')
  const [vanFilter, setVanFilter] = useState<string>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  
  // Calendar specific state
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(getLocalDateString(new Date()))

  const router = useRouter()

  // Load configuration and filter option sources
  useEffect(() => {
    getSettings().then(settings => {
      if (settings) {
        setCurrencyCode(settings.currency_code || 'INR')
        setCurrencySymbol(settings.currency_symbol || '₹')
      }
    })
    
    // Fetch filter data options
    getStaff().then(data => setStaffList((data as unknown as Staff[]) || []))
    getServices().then(data => setServicesList(data || []))
    getVans().then(data => setVansList(data || []))
  }, [])

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const clientTodayStr = getLocalDateString(new Date())
      // Fetch 'all' if in calendar mode to map months, otherwise fetch by active view tab
      const queryView = activeViewMode === 'calendar' ? 'all' : view
      const data = await getAppointments(queryView, clientTodayStr)
      setAppointments(data || [])
    } catch (error: any) {
      console.error('Error fetching appointments:', error)
    }
    setLoading(false)
  }, [view, activeViewMode])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  const updateStatus = async (id: string, newStatus: AppointmentStatus) => {
    try {
      await updateAppointmentStatus(id, newStatus)
      fetchAppointments()
      router.refresh()
    } catch (error: any) {
      console.error('Error updating status:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this appointment? This will also delete any associated invoice.')) {
      return
    }
    try {
      await deleteAppointment(id)
      fetchAppointments()
      router.refresh()
    } catch (error: any) {
      console.error('Error deleting appointment:', error)
      alert(error.message || 'Failed to delete appointment.')
    }
  }

  const formatCurrency = (n: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(n)
    } catch {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
    }
  }

  // Handle Payment Status Toggle
  const handlePaymentToggle = async (apt: Appointment) => {
    const statuses = ['Pending', 'Cash', 'UPI']
    const nextIdx = (statuses.indexOf(apt.payment_status) + 1) % statuses.length
    try {
      await updatePaymentStatus(apt.id, statuses[nextIdx])
      fetchAppointments()
      router.refresh()
    } catch (error) {
      console.error('Error toggling payment status:', error)
    }
  }

  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', other: '🐾' }

  // Metrics (computed on selected date range selection)
  const metrics = useMemo(() => {
    const total = appointments.length
    const active = appointments.filter(a => a.status === 'CheckedIn' || a.status === 'InService').length
    const completed = appointments.filter(a => a.status === 'Done' || a.status === 'CheckOut').length
    const projectedRevenue = appointments.filter(a => a.status !== 'Cancelled').reduce((sum, a) => sum + (a.price || 0), 0)
    const pendingPayments = appointments.filter(a => a.status !== 'Cancelled' && a.payment_status === 'Pending').reduce((sum, a) => sum + (a.price || 0), 0)
    
    return { total, active, completed, projectedRevenue, pendingPayments }
  }, [appointments])

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter(apt => {
      // 1. Search Query (Pet name, Owner name, Breed, Service, Groomer name, Van name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const petName = (apt.pet?.pet_name || '').toLowerCase()
        const ownerName = (apt.pet?.owner?.name || '').toLowerCase()
        const breed = (apt.pet?.breed || '').toLowerCase()
        const service = (apt.service_type || '').toLowerCase()
        const groomer = (apt.groomer?.name || '').toLowerCase()
        const vanName = (apt.van?.name || '').toLowerCase()
        
        const matches = petName.includes(query) || 
                        ownerName.includes(query) || 
                        breed.includes(query) || 
                        service.includes(query) ||
                        groomer.includes(query) ||
                        vanName.includes(query)
        if (!matches) return false
      }
      
      // 2. Status Filter
      if (statusFilter !== 'all' && apt.status !== statusFilter) {
        return false
      }
      
      // 3. Groomer Filter
      if (groomerFilter !== 'all' && apt.groomer_id !== groomerFilter) {
        return false
      }
      
      // 4. Service Filter
      if (serviceFilter !== 'all') {
        const services = apt.service_type.split('+').map(s => s.trim().toLowerCase())
        const target = serviceFilter.toLowerCase()
        const matches = services.some(s => s.includes(target) || target.includes(s))
        if (!matches) return false
      }
      
      // 5. Van Filter
      if (vanFilter !== 'all') {
        if (vanFilter === 'in-spa') {
          if (apt.van_id) return false
        } else if (vanFilter === 'mobile') {
          if (!apt.van_id) return false
        } else if (apt.van_id !== vanFilter) {
          return false
        }
      }
      
      return true
    })
  }, [appointments, searchQuery, statusFilter, groomerFilter, vanFilter, serviceFilter])

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setGroomerFilter('all')
    setVanFilter('all')
    setServiceFilter('all')
  }

  // --- Calendar Math ---
  const calendarDays = useMemo(() => {
    const year = currentMonthDate.getFullYear()
    const month = currentMonthDate.getMonth()
    
    const firstDay = new Date(year, month, 1)
    const startDayOfWeek = firstDay.getDay()
    const totalDays = new Date(year, month + 1, 0).getDate()
    
    // Prev month padding
    const prevMonthTotalDays = new Date(year, month, 0).getDate()
    const prevDays = Array.from({ length: startDayOfWeek }, (_, i) => {
      const d = prevMonthTotalDays - startDayOfWeek + 1 + i
      return new Date(year, month - 1, d)
    })
    
    // Current month days
    const currentDays = Array.from({ length: totalDays }, (_, i) => {
      return new Date(year, month, i + 1)
    })
    
    // Next month padding
    const currentLength = prevDays.length + currentDays.length
    const nextPadding = currentLength % 7 === 0 ? 0 : 7 - (currentLength % 7)
    const nextDays = Array.from({ length: nextPadding }, (_, i) => {
      return new Date(year, month + 1, i + 1)
    })
    
    return [...prevDays, ...currentDays, ...nextDays]
  }, [currentMonthDate])

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1))
  }

  // Filter appointments for the selected calendar day
  const selectedDayAppointments = useMemo(() => {
    return appointments.filter(a => a.appointment_date === selectedCalendarDate)
  }, [appointments, selectedCalendarDate])

  // Sub-renderer for individual appointments cards
  const renderAppointmentCard = (apt: Appointment) => {
    const tempStyle = getTemperamentStyle(apt.pet?.temperament_notes || null)
    const isSafetyAlert = apt.pet?.medical_alerts || (apt.pet?.temperament_notes && ['Aggressive', 'Anxious'].includes(apt.pet.temperament_notes))
    
    return (
      <div 
        key={apt.id} 
        className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 group relative overflow-hidden flex flex-col justify-between min-h-[162px] ${
          isSafetyAlert ? 'ring-1 ring-red-100 bg-red-50/5' : ''
        }`}
      >
        {/* Top border banner for safety indicator */}
        {apt.pet?.temperament_notes === 'Aggressive' && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
        )}
        {apt.pet?.temperament_notes === 'Anxious' && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400 animate-pulse" />
        )}
        {apt.pet?.medical_alerts && !['Aggressive', 'Anxious'].includes(apt.pet?.temperament_notes || '') && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
        )}

        <div>
          {/* Main Info Row */}
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-3 min-w-0">
              {/* Pet Emoji Avatar with Safety Ring */}
              <div className={`w-10 h-10 rounded-xl bg-sage-muted flex items-center justify-center text-xl flex-shrink-0 border border-white shadow-sm relative ${
                apt.pet?.temperament_notes === 'Aggressive' 
                  ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse' 
                  : apt.pet?.temperament_notes === 'Anxious'
                  ? 'ring-2 ring-amber-400 ring-offset-2 animate-pulse'
                  : ''
              }`}>
                {speciesEmoji[apt.pet?.species || 'other']}
              </div>
              
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-800 text-[0.95rem] text-gray-800 leading-tight truncate capitalize">
                    {apt.pet?.pet_name}
                  </h3>
                  <span className="text-[0.6rem] font-700 text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md uppercase">
                    {apt.pet?.breed || 'Mixed'}
                  </span>
                </div>
                
                <p className="text-[0.65rem] font-700 text-sage-dark/80 uppercase tracking-widest mt-0.5 truncate">
                  {apt.service_type}
                </p>
              </div>
            </div>

            {/* Time Slot Badge */}
            <div className="bg-gray-900 text-white px-2.5 py-1 rounded-xl shadow-sm flex-shrink-0 text-center min-w-[62px]">
              <p className="font-800 text-[0.8rem] leading-none tracking-tight">{apt.appointment_time.slice(0, 5)}</p>
              <p className="text-[0.45rem] font-800 opacity-60 uppercase tracking-widest mt-0.5">
                {new Date(apt.appointment_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Safety Warning Indicators */}
          {(apt.pet?.temperament_notes || apt.pet?.medical_alerts) && (
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {apt.pet?.temperament_notes && (
                <span className={`px-2 py-0.5 rounded-full text-[0.65rem] font-800 border ${tempStyle.bg} ${tempStyle.color} flex items-center gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${tempStyle.dot}`} />
                  {apt.pet.temperament_notes}
                </span>
              )}
              {apt.pet?.medical_alerts && (
                <span className="px-2 py-0.5 rounded-full text-[0.65rem] font-800 bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-1 animate-pulse">
                  <ShieldAlert size={10} className="flex-shrink-0" />
                  MED: {apt.pet.medical_alerts}
                </span>
              )}
            </div>
          )}

          {/* Van & Location Row (if Van assigned) */}
          {apt.van && (
            <div className="flex items-center gap-1.5 mb-2.5 bg-sky-50/50 px-2.5 py-1.5 rounded-xl border border-sky-100/50">
              <Truck size={12} className="text-sky-500 flex-shrink-0" />
              <span className="text-[0.65rem] font-800 text-sky-700 truncate">{apt.van.name}</span>
              {apt.pet?.owner?.address && (
                <>
                  <span className="text-sky-300 mx-0.5 font-bold">•</span>
                  <MapPin size={10} className="text-sky-400 flex-shrink-0" />
                  <span className="text-[0.65rem] font-700 text-sky-600 truncate">{apt.pet.owner.address}</span>
                </>
              )}
            </div>
          )}

          {/* Owner details */}
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-5 h-5 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0 border border-gray-200">
              <User size={9} className="text-gray-400" />
            </div>
            <span className="text-[0.7rem] font-700 text-gray-500 truncate">{apt.pet?.owner?.name}</span>
            
            {/* Groomer Assignment */}
            {apt.groomer && (
              <span className="ml-auto flex items-center gap-1 text-[0.65rem] font-700 text-sage-dark bg-sage-muted px-2 py-0.5 rounded-md border border-sage/10">
                <Scissors size={10} className="opacity-60" />
                {apt.groomer.name}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Details Row */}
        <div className="flex items-center justify-between gap-2.5 pt-2.5 border-t border-gray-100 mt-2">
          {/* Price & Payment Pill */}
          <div className="flex items-center gap-2">
            <p className="font-800 text-[0.95rem] text-gray-800 tracking-tight leading-none">
              {formatCurrency(apt.price || 0)}
            </p>
            
            <button 
              type="button"
              onClick={() => handlePaymentToggle(apt)}
              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[0.55rem] font-900 border transition-all active:scale-95 hover:brightness-95 cursor-pointer"
              style={{ 
                backgroundColor: apt.payment_status === 'Pending' ? '#f9fafb' : 
                                 apt.payment_status === 'Cash' ? '#ecfdf5' : '#eff6ff',
                color: apt.payment_status === 'Pending' ? '#9ca3af' : 
                       apt.payment_status === 'Cash' ? '#059669' : '#2563eb',
                borderColor: apt.payment_status === 'Pending' ? '#f3f4f6' : 
                             apt.payment_status === 'Cash' ? '#d1fae5' : '#dbeafe',
              }}
            >
              <span>{apt.payment_status === 'Cash' ? '💵' : apt.payment_status === 'UPI' ? '📱' : '🕒'}</span>
              <span className="uppercase tracking-wider">{apt.payment_status}</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {apt.status === 'Booked' && (
              <>
                <button
                  onClick={() => updateStatus(apt.id, 'Done')}
                  className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 cursor-pointer"
                  title="Mark as Done"
                >
                  <CheckCircle size={14} />
                </button>
                <button
                  onClick={() => updateStatus(apt.id, 'Cancelled')}
                  className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100 cursor-pointer"
                  title="Cancel"
                >
                  <XCircle size={14} />
                </button>
              </>
            )}
            {apt.status === 'Done' && (
              <button
                onClick={() => setCheckoutAppt(apt)}
                className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all border border-amber-100 animate-pulse cursor-pointer"
                title="Checkout & Invoice"
              >
                <Receipt size={14} />
              </button>
            )}
            {apt.status === 'CheckOut' && (
              <button
                onClick={() => router.push('/billing')}
                className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-600 hover:text-white transition-all border border-slate-200 cursor-pointer"
                title="View in Billing"
              >
                <FileText size={14} />
              </button>
            )}
            
            {/* Grooming Record button */}
            <button
              onClick={() => setGroomingRecordAppt(apt)}
              className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-600 hover:text-white transition-all border border-purple-100 cursor-pointer"
              title="Grooming Record"
            >
              <Camera size={14} />
            </button>
            
            {/* Reschedule button */}
            <button
              onClick={() => setRescheduleAppt(apt)}
              className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 cursor-pointer"
              title="Reschedule"
            >
              <CalendarClock size={14} />
            </button>
            
            {/* Delete button */}
            <button
              onClick={() => handleDelete(apt.id)}
              className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100 cursor-pointer"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-[1100px] pb-24 md:pb-8">
      {/* Header and Toggle View bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1 flex items-center gap-2">
            Spa Schedule 📅
          </h1>
          <p className="text-gray-400 text-sm">
            Manage appointments, queues, and booking pipelines
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* View Mode Toggle */}
          <div className="bg-gray-200/50 p-1 rounded-xl flex items-center gap-0.5 border border-gray-200/30">
            <button
              onClick={() => {
                setActiveViewMode('list')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-750 flex items-center gap-1.5 transition-all cursor-pointer ${activeViewMode === 'list' ? 'bg-white text-sage-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutList size={13} />
              Timeline
            </button>
            <button
              onClick={() => {
                setActiveViewMode('kanban')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-750 flex items-center gap-1.5 transition-all cursor-pointer ${activeViewMode === 'kanban' ? 'bg-white text-sage-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Kanban size={13} />
              Board
            </button>
            <button
              onClick={() => {
                setActiveViewMode('calendar')
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-750 flex items-center gap-1.5 transition-all cursor-pointer ${activeViewMode === 'calendar' ? 'bg-white text-sage-dark shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <CalendarIcon size={13} />
              Calendar
            </button>
          </div>

          {/* Book visit button */}
          <button className="btn-sage font-700 flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all px-4 py-2" onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Book Visit
          </button>
        </div>
      </div>

      {/* KPI Metrics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {/* Total Appointments */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.625rem] font-800 text-gray-400 uppercase tracking-wider">Total Visits</span>
            <div className="w-7 h-7 rounded-lg bg-sage-muted flex items-center justify-center text-sage-dark">
              <CalendarIcon size={13} />
            </div>
          </div>
          <h4 className="text-xl font-800 text-gray-800 leading-none">{metrics.total}</h4>
          <p className="text-[0.55rem] text-gray-400 mt-1">Booked visits in range</p>
        </div>
        
        {/* Active Queue */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.625rem] font-800 text-gray-400 uppercase tracking-wider">Active Queue</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Clock size={13} className="animate-pulse" />
            </div>
          </div>
          <h4 className="text-xl font-800 text-gray-800 leading-none">{metrics.active}</h4>
          <p className="text-[0.55rem] text-indigo-500 font-700 mt-1">Checked In & In Service</p>
        </div>

        {/* Completed visits */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.625rem] font-800 text-gray-400 uppercase tracking-wider">Completed</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle size={13} />
            </div>
          </div>
          <h4 className="text-xl font-800 text-gray-800 leading-none">{metrics.completed}</h4>
          <p className="text-[0.55rem] text-emerald-600 font-700 mt-1">Grooming sessions done</p>
        </div>

        {/* Projected Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.625rem] font-800 text-gray-400 uppercase tracking-wider">Est. Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
              <span className="text-xs font-900">{currencySymbol}</span>
            </div>
          </div>
          <h4 className="text-lg font-800 text-gray-800 leading-none truncate">{formatCurrency(metrics.projectedRevenue)}</h4>
          <p className="text-[0.55rem] text-gray-400 mt-1">Sum of active bookings</p>
        </div>

        {/* Pending Payments */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[0.625rem] font-800 text-gray-400 uppercase tracking-wider">Unpaid Balance</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <span className="text-xs font-900">{currencySymbol}</span>
            </div>
          </div>
          <h4 className="text-lg font-800 text-rose-600 leading-none truncate">{formatCurrency(metrics.pendingPayments)}</h4>
          <p className="text-[0.55rem] text-rose-500 font-700 mt-1">Pending checkout collection</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search pet name, owner, breed, service, groomer..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.65rem] font-700 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                CLEAR
              </button>
            )}
          </div>
          
          {/* Advanced Toggle Indicator */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-gray-400" />
            <span className="text-[0.7rem] font-700 text-gray-400 uppercase tracking-wider">Filters</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-gray-50">
          {/* Status Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[0.6rem] font-800 text-gray-400 uppercase tracking-wider">Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-none focus:border-sage"
            >
              <option value="all">All Statuses</option>
              <option value="Lead">Inquiry</option>
              <option value="Booked">Booked</option>
              <option value="CheckedIn">Checked In</option>
              <option value="InService">In Service</option>
              <option value="Done">Done</option>
              <option value="CheckOut">Checked Out</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Groomer Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[0.6rem] font-800 text-gray-400 uppercase tracking-wider">Groomer</label>
            <select
              value={groomerFilter}
              onChange={e => setGroomerFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-none focus:border-sage"
            >
              <option value="all">All Staff</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Van Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[0.6rem] font-800 text-gray-400 uppercase tracking-wider">Location / Van</label>
            <select
              value={vanFilter}
              onChange={e => setVanFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-none focus:border-sage"
            >
              <option value="all">All Locations</option>
              <option value="in-spa">In-Spa Visits</option>
              <option value="mobile">All Vans (Mobile)</option>
              {vansList.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Service Filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[0.6rem] font-800 text-gray-400 uppercase tracking-wider">Service</label>
            <select
              value={serviceFilter}
              onChange={e => setServiceFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-none focus:border-sage"
            >
              <option value="all">All Services</option>
              {servicesList.map(s => (
                <option key={s.id} value={s.service_name}>{s.service_name}</option>
              ))}
            </select>
          </div>
        </div>

        {(searchQuery || statusFilter !== 'all' || groomerFilter !== 'all' || vanFilter !== 'all' || serviceFilter !== 'all') && (
          <div className="flex justify-end pt-1">
            <button
              onClick={resetFilters}
              className="text-[0.65rem] font-700 text-sage hover:text-sage-dark flex items-center gap-1 uppercase tracking-wider cursor-pointer"
            >
              <RefreshCw size={10} />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Date Range Tabs - only shown in List and Kanban views */}
      {activeViewMode !== 'calendar' && (
        <div className="flex items-center gap-1 mb-6 border-b overflow-x-auto hide-scrollbar" style={{ borderColor: '#e5e7eb' }}>
          {(['today', 'tomorrow', 'week', 'all'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '0.75rem 1.25rem',
                fontSize: '0.825rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: view === v ? 'var(--sage-dark)' : '#9ca3af',
                borderBottom: view === v ? '2.5px solid var(--sage)' : '2.5px solid transparent',
                transition: 'all 0.2s',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* List/Timeline View */}
      {activeViewMode === 'list' && (
        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="card h-24 animate-pulse" style={{ background: '#f3f4f6' }} />
              ))}
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="card h-64 flex flex-col items-center justify-center text-center text-gray-400">
              <CalendarIcon size={48} className="mb-4 opacity-20 text-sage" />
              <p className="font-700">No appointments scheduled</p>
              <p className="text-sm">Try choosing a different date range or book a new visit.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3.5">
              {filteredAppointments.map(apt => renderAppointmentCard(apt))}
            </div>
          )}
        </div>
      )}

      {/* Kanban Board View */}
      {activeViewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-6 pt-2 select-none hide-scrollbar">
          {loading ? (
            <div className="flex gap-4 w-full">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-[280px] h-[350px] bg-white rounded-2xl border border-gray-100 p-4 animate-pulse flex-shrink-0" />
              ))}
            </div>
          ) : (
            boardColumns.map(col => {
              const colAppointments = filteredAppointments.filter(a => a.status === col.key)
              
              return (
                <div key={col.key} className="flex-shrink-0 w-[285px] flex flex-col gap-3">
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{col.icon}</span>
                      <h3 className="font-800 text-[0.8rem] text-gray-700 uppercase tracking-wider leading-none">
                        {col.label}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[0.65rem] font-800 leading-none">
                        {colAppointments.length}
                      </span>
                    </div>
                    <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: col.color, opacity: 0.4 }} />
                  </div>

                  {/* Column Body */}
                  <div className="flex-1 rounded-2xl p-2 min-h-[480px] bg-gray-50/50 border border-dashed border-gray-200/80 flex flex-col gap-2.5">
                    {colAppointments.length === 0 ? (
                      <div className="h-20 flex items-center justify-center text-gray-300 text-[0.7rem] font-600 italic border border-dashed border-gray-200/50 rounded-xl bg-white/30">
                        Empty column
                      </div>
                    ) : (
                      colAppointments.map(appt => {
                        const currentIndex = statusOrder.indexOf(appt.status as AppointmentStatus)
                        const prevStatus = currentIndex > 0 ? statusOrder[currentIndex - 1] : null
                        const nextStatus = currentIndex < statusOrder.length - 1 ? statusOrder[currentIndex + 1] : null
                        
                        return (
                          <div 
                            key={appt.id} 
                            className="bg-white rounded-xl shadow-sm border border-gray-100/80 p-3 hover:shadow-md transition-all duration-200 flex flex-col gap-2 relative overflow-hidden group"
                          >
                            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: col.color }} />
                            
                            <div className="flex items-center justify-between">
                              <span className="text-[0.6rem] font-800 bg-gray-900 text-white px-2 py-0.5 rounded-md leading-none">
                                {appt.appointment_time.slice(0, 5)}
                              </span>
                              <span className="text-[0.75rem] font-800 text-gray-800 leading-none">
                                {formatCurrency(appt.price || 0)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-base flex-shrink-0">{speciesEmoji[appt.pet?.species || 'other']}</span>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-800 text-[0.8rem] text-gray-800 leading-none truncate capitalize">
                                  {appt.pet?.pet_name}
                                </h4>
                                <p className="text-[0.55rem] font-600 text-gray-400 truncate mt-0.5">
                                  {appt.pet?.owner?.name}
                                </p>
                              </div>
                            </div>

                            <div className="text-[0.55rem] font-700 text-sage-dark uppercase tracking-wider bg-sage-muted px-2 py-0.5 rounded-md truncate text-center">
                              {appt.service_type}
                            </div>

                            {/* Kanban Actions */}
                            <div className="flex items-center justify-between border-t border-gray-50 pt-2 mt-1">
                              <button
                                onClick={() => prevStatus && updateStatus(appt.id, prevStatus)}
                                disabled={!prevStatus}
                                className={`p-1 rounded-md text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-all cursor-pointer ${!prevStatus ? 'opacity-0 pointer-events-none' : ''}`}
                                title={`Move back to ${prevStatus}`}
                              >
                                <ChevronLeft size={12} />
                              </button>

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setGroomingRecordAppt(appt)}
                                  className="p-1 rounded-md text-purple-600 hover:bg-purple-50 transition-all cursor-pointer"
                                  title="Grooming Record"
                                >
                                  <Camera size={11} />
                                </button>
                                <button
                                  onClick={() => setRescheduleAppt(appt)}
                                  className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                                  title="Reschedule"
                                >
                                  <CalendarClock size={11} />
                                </button>
                              </div>

                              <button
                                onClick={() => {
                                  if (nextStatus) {
                                    if (appt.status === 'Done' && nextStatus === 'CheckOut') {
                                      setCheckoutAppt(appt)
                                    } else {
                                      updateStatus(appt.id, nextStatus)
                                    }
                                  }
                                }}
                                disabled={!nextStatus}
                                className={`p-1 rounded-md text-gray-800 hover:bg-gray-100 transition-all cursor-pointer ${!nextStatus ? 'opacity-0 pointer-events-none' : ''}`}
                                title={appt.status === 'Done' ? 'Checkout' : `Move to ${nextStatus}`}
                              >
                                <ChevronRight size={12} />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Calendar View */}
      {activeViewMode === 'calendar' && (
        <div className="flex flex-col gap-6">
          {/* Month Header selector */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-sage" size={20} />
              <h2 className="text-base font-800 text-gray-800 capitalize leading-none">
                {currentMonthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all text-gray-600 cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setCurrentMonthDate(new Date())}
                className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all text-xs font-700 text-gray-600 cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all text-gray-600 cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Calendar Month Grid */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm overflow-hidden">
            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-[0.65rem] font-800 text-gray-400 uppercase tracking-widest py-1.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((dayDate, idx) => {
                const dateStr = getLocalDateString(dayDate)
                const isCurrentMonth = dayDate.getMonth() === currentMonthDate.getMonth()
                const isToday = dateStr === getLocalDateString(new Date())
                const isSelected = dateStr === selectedCalendarDate
                
                // Find appointments on this day
                const dayAppts = appointments.filter(a => a.appointment_date === dateStr)
                
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedCalendarDate(dateStr)}
                    className={`min-h-[72px] p-1.5 rounded-xl border flex flex-col justify-between text-left transition-all duration-200 group relative cursor-pointer ${
                      isSelected 
                        ? 'border-sage bg-sage-muted/30 shadow-inner' 
                        : isToday
                        ? 'border-indigo-200 bg-indigo-50/20'
                        : isCurrentMonth
                        ? 'border-gray-100 bg-white hover:border-gray-300 hover:shadow-sm'
                        : 'border-gray-50 bg-gray-50/40 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-700 ${
                        isSelected 
                          ? 'text-sage-dark' 
                          : isToday 
                          ? 'text-indigo-600 font-900 bg-indigo-50 px-1.5 py-0.5 rounded-md' 
                          : isCurrentMonth 
                          ? 'text-gray-700' 
                          : 'text-gray-300'
                      }`}>
                        {dayDate.getDate()}
                      </span>
                      {/* Plus button to add visit on hover */}
                      <span 
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCalendarDate(dateStr)
                          setShowModal(true)
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-4 h-4 rounded-md bg-sage text-white flex items-center justify-center text-[0.65rem] hover:bg-sage-dark"
                        title="Book visit on this day"
                      >
                        +
                      </span>
                    </div>
                    
                    {/* Event indicators */}
                    <div className="mt-1 flex flex-wrap gap-0.5 max-h-[35px] overflow-hidden">
                      {dayAppts.slice(0, 3).map((appt) => {
                        // Determine dot color based on status
                        let dotColor = 'bg-sky-400'
                        if (appt.status === 'CheckedIn') dotColor = 'bg-indigo-500'
                        else if (appt.status === 'InService') dotColor = 'bg-purple-500'
                        else if (appt.status === 'Done' || appt.status === 'CheckOut') dotColor = 'bg-emerald-500'
                        else if (appt.status === 'Cancelled') dotColor = 'bg-red-400'
                        
                        return (
                          <span 
                            key={appt.id} 
                            className={`w-1.5 h-1.5 rounded-full ${dotColor}`}
                            title={`${appt.pet?.pet_name} - ${appt.appointment_time}`}
                          />
                        )
                      })}
                      {dayAppts.length > 3 && (
                        <span className="text-[0.55rem] font-800 text-sage-dark/80 bg-sage-muted px-1 rounded-sm leading-none flex items-center">
                          +{dayAppts.length - 3}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Day's Appointments List */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div>
                <h3 className="font-800 text-sm text-gray-700 uppercase tracking-wider leading-none">
                  Appointments for {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                <p className="text-[0.65rem] text-gray-400 mt-1">{selectedDayAppointments.length} bookings scheduled</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-1.5 rounded-xl border border-sage text-sage hover:bg-sage-muted text-[0.7rem] font-700 flex items-center gap-1 transition-all cursor-pointer"
              >
                <Plus size={12} />
                Book Day
              </button>
            </div>

            {selectedDayAppointments.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center text-center text-gray-400">
                <Smile size={28} className="mb-2 opacity-30 text-sage" />
                <p className="text-xs font-700">No visits scheduled for this date</p>
                <p className="text-[0.6rem]">Click "Book Day" to schedule a groom visit.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {selectedDayAppointments.map(appt => renderAppointmentCard(appt))}
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <BookAppointmentModal
          currencySymbol={currencySymbol}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      {rescheduleAppt && (
        <RescheduleModal
          currencySymbol={currencySymbol}
          appointment={rescheduleAppt}
          onClose={() => setRescheduleAppt(null)}
          onSuccess={() => {
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      {groomingRecordAppt && (
        <GroomingRecordModal
          appointment={groomingRecordAppt}
          onClose={() => setGroomingRecordAppt(null)}
          onSuccess={() => {
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      {checkoutAppt && (
        <CheckoutModal
          appointment={checkoutAppt}
          onClose={() => setCheckoutAppt(null)}
          onSuccess={() => {
            setCheckoutAppt(null)
            fetchAppointments()
            router.refresh()
          }}
        />
      )}
      <div className="fixed bottom-2 right-2 text-[10px] text-gray-300 pointer-events-none">v1.2.0</div>
    </div>
  )
}
