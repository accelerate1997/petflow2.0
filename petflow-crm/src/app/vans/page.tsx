'use client'

import { useEffect, useState, useCallback } from 'react'
import { Truck, Plus, Trash2, Calendar, CheckCircle2, AlertCircle, Loader2, User, Clock, CheckCircle, XCircle, ArrowRight, RefreshCw, MapPin } from 'lucide-react'
import { getVans, createVan, updateVan, deleteVan, updateAppointment, getAppointments, getSettings } from '@/lib/actions'
import { getLocalDateString } from '@/lib/dateUtils'
import type { Appointment, Van } from '@/types'
import { useRouter } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function VansPage() {
  const [vans, setVans] = useState<Van[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [mobileEnabled, setMobileEnabled] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [vansLoading, setVansLoading] = useState(false)
  const [apptsLoading, setApptsLoading] = useState(false)
  
  // Van form state
  const [newVanName, setNewVanName] = useState('')
  const [newVanPlate, setNewVanPlate] = useState('')
  
  // Notification messages
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  
  const router = useRouter()

  // Load Settings and check mobile module
  useEffect(() => {
    getSettings().then(s => {
      if (s) {
        setMobileEnabled(s.mobile_enabled ?? false)
      }
      setSettingsLoading(false)
    }).catch(err => {
      console.error(err)
      setSettingsLoading(false)
    })
  }, [])

  // Load Fleet & Appointments data
  const fetchData = useCallback(async () => {
    if (!mobileEnabled) return
    setVansLoading(true)
    setApptsLoading(true)
    setMessage(null)
    
    try {
      const fleet = await getVans()
      setVans(fleet as any)
      
      const appts = await getAppointments('today', selectedDate)
      setAppointments(appts as any)
    } catch (error: any) {
      console.error('Error fetching van dispatch data:', error)
      setMessage({ text: 'Failed to load fleet or appointment data.', type: 'error' })
    } finally {
      setVansLoading(false)
      setApptsLoading(false)
    }
  }, [mobileEnabled, selectedDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Register New Van
  const handleAddVan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newVanName.trim()) return
    
    setVansLoading(true)
    try {
      await createVan({
        name: newVanName.trim(),
        plate_number: newVanPlate.trim() || undefined,
        status: 'Active'
      })
      setNewVanName('')
      setNewVanPlate('')
      setMessage({ text: 'Grooming van registered successfully!', type: 'success' })
      const fleet = await getVans()
      setVans(fleet as any)
    } catch (error: any) {
      setMessage({ text: error.message || 'Failed to register van.', type: 'error' })
    } finally {
      setVansLoading(false)
    }
  }

  // Toggle status (Active / Maintenance)
  const handleToggleStatus = async (id: string, currentStatus: string) => {
    setVansLoading(true)
    const newStatus = currentStatus === 'Active' ? 'Maintenance' : 'Active'
    try {
      await updateVan(id, { status: newStatus })
      setMessage({ text: `Van status updated to ${newStatus}.`, type: 'success' })
      const fleet = await getVans()
      setVans(fleet as any)
    } catch (error: any) {
      setMessage({ text: 'Failed to update van status.', type: 'error' })
    } finally {
      setVansLoading(false)
    }
  }

  // Decommission van
  const handleDeleteVan = async (id: string) => {
    if (!confirm('Are you sure you want to decommission this van? This will remove it from the active fleet.')) return
    
    setVansLoading(true)
    try {
      await deleteVan(id)
      setMessage({ text: 'Van decommissioned successfully.', type: 'success' })
      const fleet = await getVans()
      setVans(fleet as any)
    } catch (error: any) {
      setMessage({ text: 'Failed to delete van.', type: 'error' })
    } finally {
      setVansLoading(false)
    }
  }

  // Assign or change van for appointment
  const handleAssignVan = async (apptId: string, vanId: string | null) => {
    setApptsLoading(true)
    try {
      await updateAppointment(apptId, { van_id: vanId })
      setMessage({ text: vanId ? 'Appointment successfully dispatched to van!' : 'Appointment unassigned from van.', type: 'success' })
      const appts = await getAppointments('today', selectedDate)
      setAppointments(appts as any)
    } catch (error: any) {
      setMessage({ text: error.message || 'Failed to dispatch appointment.', type: 'error' })
    } finally {
      setApptsLoading(false)
    }
  }

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-sage-dark" size={36} />
      </div>
    )
  }

  if (!mobileEnabled) {
    return (
      <div className="p-8 max-w-[800px] mx-auto text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm mt-10">
        <Truck className="mx-auto text-gray-300 mb-4" size={56} />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Mobile Grooming Vans is Disabled</h2>
        <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
          Enable the Mobile Grooming Vans module in settings to start dispatching grooming vans, managing route assignments, and tracking your mobile fleet.
        </p>
        <button
          onClick={() => router.push('/settings?tab=general')}
          className="btn-sage py-3 px-6 text-sm font-semibold rounded-xl inline-flex items-center gap-2"
        >
          Go to Settings <ArrowRight size={16} />
        </button>
      </div>
    )
  }

  // Group appointments by van
  const activeVans = vans.filter(v => v.status === 'Active')
  
  // Unassigned mobile appointments (or shop appointments that could be dispatched)
  const unassignedAppointments = appointments.filter(a => !a.van_id && a.status !== 'Cancelled')
  
  // Status color helpers
  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'Lead': return 'bg-sky-50 text-sky-700 border-sky-100'
      case 'Booked': return 'bg-indigo-50 text-indigo-700 border-indigo-100'
      case 'CheckedIn': return 'bg-amber-50 text-amber-700 border-amber-100'
      case 'InService': return 'bg-purple-50 text-purple-700 border-purple-100'
      case 'Done': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'CheckedOut': return 'bg-teal-50 text-teal-700 border-teal-100'
      default: return 'bg-gray-50 text-gray-700 border-gray-100'
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px] pb-24 md:pb-8 flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
            🚚 Mobile Fleet Dispatch
          </h1>
          <p className="text-gray-400 text-sm">
            Manage your mobile grooming vans, schedule routes, and dispatch staff to clients' locations
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
            <Calendar size={16} className="text-gray-400" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-sm font-semibold text-gray-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
            />
          </div>
          <button 
            onClick={fetchData}
            title="Refresh dashboard data"
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors shadow-sm"
          >
            <RefreshCw size={16} className={vansLoading || apptsLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Message alerts */}
      {message && (
        <div 
          className={`p-4 rounded-2xl flex items-center gap-3 border transition-all ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Main Grid: Left is Fleet Admin, Right is Daily Dispatch Board */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Left Side: Fleet Admin */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          {/* Register New Van */}
          <div className="card p-5 border border-gray-100 shadow-sm flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800" style={{ fontWeight: 700 }}>Add Grooming Van</h3>
              <p className="text-[11px] text-gray-400">Register a new vehicle in your mobile grooming fleet</p>
            </div>
            
            <form onSubmit={handleAddVan} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Van Name / Identifier</label>
                <input
                  type="text"
                  required
                  className="input-field w-full text-xs py-2 px-3 bg-white"
                  placeholder="e.g. Van Alpha, Downtown Unit"
                  value={newVanName}
                  onChange={e => setNewVanName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">License Plate (Optional)</label>
                <input
                  type="text"
                  className="input-field w-full text-xs py-2 px-3 bg-white"
                  placeholder="e.g. DXB-12345"
                  value={newVanPlate}
                  onChange={e => setNewVanPlate(e.target.value)}
                />
              </div>
              
              <button 
                type="submit" 
                disabled={vansLoading}
                className="btn-sage w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Plus size={14} /> Register Van
              </button>
            </form>
          </div>

          {/* Fleet Status Management List */}
          <div className="card p-5 border border-gray-100 shadow-sm flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-bold text-gray-800" style={{ fontWeight: 700 }}>Fleet Management</h3>
              <p className="text-[11px] text-gray-400">Track and toggle active statuses of your vans</p>
            </div>

            {vansLoading && vans.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-sage-dark" size={24} />
              </div>
            ) : vans.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-gray-100 rounded-xl bg-gray-50/50">
                <Truck className="mx-auto text-gray-300 mb-2" size={28} />
                <p className="text-xs font-semibold text-gray-400">No vans registered yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
                {vans.map(van => (
                  <div key={van.id} className="p-3.5 rounded-xl border border-gray-100 bg-white flex flex-col gap-2.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center text-sage-dark flex-shrink-0">
                          <Truck size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate" style={{ fontWeight: 700 }}>{van.name}</p>
                          {van.plate_number && (
                            <p className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold uppercase w-fit mt-0.5 tracking-wider">
                              {van.plate_number}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleToggleStatus(van.id, van.status)}
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border ${
                          van.status === 'Active'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                        }`}
                      >
                        {van.status}
                      </button>
                    </div>
                    
                    <div className="flex justify-end border-t border-gray-50 pt-2">
                      <button
                        onClick={() => handleDeleteVan(van.id)}
                        className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-all"
                      >
                        <Trash2 size={11} /> Decommission
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Daily Dispatch board */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          <div className="card p-5 border border-gray-100 shadow-sm flex flex-col gap-6">
            <div>
              <h2 className="text-md font-bold text-gray-800" style={{ fontWeight: 700 }}>Daily Dispatch Timeline</h2>
              <p className="text-xs text-gray-400">Sequence of grooming jobs dispatched to each active van</p>
            </div>

            {apptsLoading && appointments.length === 0 ? (
              <div className="flex justify-center py-20">
                <Loader2 className="animate-spin text-sage-dark" size={36} />
              </div>
            ) : activeVans.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/20">
                <Truck className="mx-auto text-gray-300 mb-3 animate-pulse" size={48} />
                <h3 className="text-sm font-bold text-gray-600">No Active Vans Available</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                  Please register a van or activate an existing van on the left panel to begin dispatching appointments.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {activeVans.map(van => {
                  const vanJobs = appointments.filter(a => a.van_id === van.id)
                  
                  return (
                    <div key={van.id} className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4 flex flex-col gap-4 min-h-[400px]">
                      {/* Van Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-gray-200/60">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-sage text-white flex items-center justify-center shadow-sm">
                            <Truck size={15} />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-gray-800" style={{ fontWeight: 700 }}>{van.name}</h4>
                            <p className="text-[10px] text-gray-400">{vanJobs.length} {vanJobs.length === 1 ? 'job' : 'jobs'} scheduled</p>
                          </div>
                        </div>
                      </div>

                      {/* Van Job Timeline */}
                      <div className="flex-1 flex flex-col gap-3 overflow-y-auto max-h-[450px] pr-1">
                        {vanJobs.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-gray-400">
                            <Clock size={24} className="mb-1 opacity-20" />
                            <p className="text-[10px] font-semibold">No jobs assigned</p>
                            <p className="text-[9px] text-gray-400 mt-0.5">Select a job from below to dispatch</p>
                          </div>
                        ) : (
                          vanJobs.map(job => (
                            <div key={job.id} className="p-3.5 rounded-xl border border-gray-100 bg-white shadow-sm flex flex-col gap-2.5 hover:border-sage/40 transition-all">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md flex items-center gap-1 w-fit">
                                  <Clock size={10} /> {job.appointment_time}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusColorClass(job.status)}`}>
                                  {job.status}
                                </span>
                              </div>
                              
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-gray-800" style={{ fontWeight: 700 }}>{job.pet?.pet_name}</h5>
                                <p className="text-[10px] text-gray-500 font-medium truncate mt-0.5">{job.service_type}</p>
                                {job.pet?.owner?.address && (
                                  <p className="text-[9px] text-gray-400 italic truncate mt-1 flex items-center gap-0.5">
                                    <MapPin size={9} /> {job.pet.owner.address}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between border-t border-gray-50 pt-2 text-[10px] text-gray-500">
                                <div className="flex items-center gap-1 truncate font-medium">
                                  <User size={11} className="text-gray-400 flex-shrink-0" />
                                  <span className="truncate">{job.groomer?.name || 'Auto-assigned'}</span>
                                </div>
                                <button
                                  onClick={() => handleAssignVan(job.id, null)}
                                  className="text-[9px] font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors flex-shrink-0"
                                >
                                  Recall
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Unassigned / Shop Appointments Board */}
      <div className="card p-6 border border-gray-100 shadow-sm flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-bold text-gray-800" style={{ fontWeight: 700 }}>Unassigned Bookings Pool ({selectedDate})</h2>
          <p className="text-xs text-gray-400">Appointments scheduled for today that are not dispatched to any van yet</p>
        </div>

        {apptsLoading && appointments.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-sage-dark" size={32} />
          </div>
        ) : unassignedAppointments.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-gray-100 rounded-xl bg-gray-50/50">
            <CheckCircle className="mx-auto text-emerald-400 mb-2" size={32} />
            <p className="text-xs font-semibold text-gray-500">All appointments have been successfully assigned to vans!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[300px] overflow-y-auto pr-1">
            {unassignedAppointments.map(appt => (
              <div key={appt.id} className="p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-all flex flex-col justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Clock size={9} /> {appt.appointment_time}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ${getStatusColorClass(appt.status)}`}>
                      {appt.status}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-gray-800" style={{ fontWeight: 700 }}>{appt.pet?.pet_name}</h4>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{appt.service_type}</p>
                  
                  {appt.pet?.owner?.address ? (
                    <p className="text-[9px] text-gray-400 truncate italic mt-1.5 flex items-center gap-0.5">
                      <MapPin size={9} /> {appt.pet.owner.address}
                    </p>
                  ) : (
                    <p className="text-[9px] text-gray-400 truncate italic mt-1.5 flex items-center gap-0.5">
                      🏪 Store / In-Shop Appointment
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 border-t border-gray-50 pt-2.5">
                  <select
                    className="flex-1 text-[10px] font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg py-1.5 px-2 transition-colors cursor-pointer"
                    onChange={e => {
                      if (e.target.value) {
                        handleAssignVan(appt.id, e.target.value)
                      }
                    }}
                    value=""
                  >
                    <option value="">Dispatch to Van...</option>
                    {activeVans.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
