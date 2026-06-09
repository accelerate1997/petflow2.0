'use client'

import { useState } from 'react'
import { X, UserCog, Phone, Mail, Scissors, Star } from 'lucide-react'
import { createStaff, updateStaff } from '@/lib/actions'
import { useSession } from 'next-auth/react'

interface Props {
  onClose: () => void
  onSuccess: () => void
  existingStaff?: any
}

const ROLES = ['Senior Groomer', 'Groomer', 'Assistant Groomer', 'Receptionist', 'Manager']
const SPECS = ['Dog Grooming', 'Cat Grooming', 'All Breeds', 'Large Breeds', 'Small Breeds', 'Exotic Pets']

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function AddStaffModal({ onClose, onSuccess, existingStaff }: Props) {
  const { data: session } = useSession()
  const currentUserRole = (session?.user as any)?.role

  const rolesToUse = currentUserRole === 'SuperAdmin' || existingStaff?.role === 'SpaAdmin'
    ? [...ROLES, 'SpaAdmin']
    : ROLES

  const [form, setForm] = useState({
    name: existingStaff?.name || '',
    phone: existingStaff?.phone || '',
    email: existingStaff?.email || '',
    role: existingStaff?.role || (currentUserRole === 'SuperAdmin' ? 'SpaAdmin' : 'Groomer'),
    specialization: existingStaff?.specialization || '',
    status: existingStaff?.status || 'Active',
  })
  const [accessLevel, setAccessLevel] = useState<'Staff' | 'SpaAdmin'>(
    existingStaff?.accessLevel || 'Staff'
  )
  const [workingHours, setWorkingHours] = useState<any>(() => {
    const base = DAYS.reduce((acc, day) => {
      acc[day] = { is_working: true, start: '09:00', end: '18:00' }
      return acc
    }, {} as any)
    if (existingStaff?.working_hours && typeof existingStaff.working_hours === 'object') {
      return { ...base, ...existingStaff.working_hours }
    }
    return base
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }

    setLoading(true)
    setError('')
    try {
      const payload: any = {
        name: form.name.trim(),
        phone: form.phone || null,
        email: form.email || null,
        role: form.role || null,
        specialization: form.specialization || null,
        status: form.status,
        working_hours: workingHours,
      }
      
      if (existingStaff?.hasAccount) {
        payload.accessLevel = accessLevel
      }

      if (existingStaff) {
        await updateStaff(existingStaff.id, payload)
      } else {
        await createStaff(payload)
      }
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error saving staff member')
    }
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, background: 'var(--sage-muted)' }}
            >
              <UserCog size={18} style={{ color: 'var(--sage-dark)' }} />
            </div>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{existingStaff ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
              <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{existingStaff ? 'Modify profile and shifts' : 'Add a groomer or team member'}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="rounded-lg px-3 py-2 mb-4" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* Name */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Full Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div className="form-group">
              <UserCog size={14} className="text-gray-400" />
              <input
                className="input-field pl-8"
                placeholder="e.g. Priya Sharma"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
          </div>

          {/* Role & Specialization */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Role
              </label>
              <div className="form-group">
                <Scissors size={14} className="text-gray-400" />
                <select
                  className="input-field pl-8"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                >
                  {rolesToUse.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Specialization
              </label>
              <div className="form-group">
                <Star size={14} className="text-gray-400" />
                <select
                  className="input-field pl-8"
                  value={form.specialization}
                  onChange={e => setForm({ ...form, specialization: e.target.value })}
                >
                  <option value="">None</option>
                  {SPECS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Phone
              </label>
              <div className="form-group">
                <Phone size={14} className="text-gray-400" />
                <input
                  className="input-field pl-8"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Email
              </label>
              <div className="form-group">
                <Mail size={14} className="text-gray-400" />
                <input
                  className="input-field pl-8"
                  type="email"
                  placeholder="priya@spa.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
              Status
            </label>
            <div className="flex gap-2">
              {['Active', 'Inactive'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, status: s })}
                  className="flex-1 py-2 rounded-xl text-sm font-600 border transition-all"
                  style={{
                    background: form.status === s ? (s === 'Active' ? '#ecfdf5' : '#fef2f2') : '#f9fafb',
                    color: form.status === s ? (s === 'Active' ? '#059669' : '#dc2626') : '#9ca3af',
                    borderColor: form.status === s ? (s === 'Active' ? '#d1fae5' : '#fecaca') : '#f3f4f6',
                    fontWeight: form.status === s ? 700 : 500,
                  }}
                >
                  {s === 'Active' ? '✅ Active' : '⏸ Inactive'}
                </button>
              ))}
            </div>
          </div>

          {/* Access Level (Only if account exists) */}
          {existingStaff?.hasAccount && (
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                Account Access Level
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="accessLevel"
                    value="Staff"
                    checked={accessLevel === 'Staff'}
                    onChange={() => setAccessLevel('Staff')}
                    className="mt-1 text-[var(--sage-dark)] focus:ring-[var(--sage)]"
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Default Access</p>
                    <p className="text-xs text-gray-400 mt-0.5">Excludes settings and staff panel management. Perfect for groomers and receptionists.</p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="radio"
                    name="accessLevel"
                    value="SpaAdmin"
                    checked={accessLevel === 'SpaAdmin'}
                    onChange={() => setAccessLevel('SpaAdmin')}
                    className="mt-1 text-[var(--sage-dark)] focus:ring-[var(--sage)]"
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Full Access</p>
                    <p className="text-xs text-gray-400 mt-0.5">Includes full settings modification and staff panel management.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Shift Schedule */}
          <div className="border-t border-gray-100 pt-4 mt-2">
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
              Shift Schedule & Working Hours
            </label>
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {DAYS.map(day => {
                const shift = workingHours[day] || { is_working: false, start: '09:00', end: '18:00' };
                return (
                  <div key={day} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100">
                    <label className="flex items-center gap-2 cursor-pointer min-w-[100px]">
                      <input
                        type="checkbox"
                        checked={shift.is_working}
                        onChange={e => setWorkingHours({
                          ...workingHours,
                          [day]: { ...shift, is_working: e.target.checked }
                        })}
                        className="rounded text-[var(--sage-dark)] focus:ring-[var(--sage)]"
                      />
                      <span className="text-xs font-bold capitalize text-gray-700">{day}</span>
                    </label>
                    
                    {shift.is_working && (
                      <div className="flex items-center gap-2 ml-auto">
                        <input
                          type="time"
                          value={shift.start || '09:00'}
                          onChange={e => setWorkingHours({
                            ...workingHours,
                            [day]: { ...shift, start: e.target.value }
                          })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none bg-white focus:border-[var(--sage-dark)]"
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                          type="time"
                          value={shift.end || '18:00'}
                          onChange={e => setWorkingHours({
                            ...workingHours,
                            [day]: { ...shift, end: e.target.value }
                          })}
                          className="px-2 py-1 border border-gray-200 rounded-lg text-xs outline-none bg-white focus:border-[var(--sage-dark)]"
                        />
                      </div>
                    )}
                    {!shift.is_working && (
                      <span className="text-xs text-gray-400 italic ml-auto pr-2">Day Off</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-sage flex-1" disabled={loading}>
              {loading ? 'Saving...' : (existingStaff ? 'Save Changes' : 'Add Staff Member')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
