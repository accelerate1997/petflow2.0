'use client'

import { useState, useEffect, useCallback } from 'react'
import { UserCog, Plus, Phone, Mail, Scissors, Trash2, Star, TrendingUp, Edit2, UserPlus, Link2, X, Clock, CheckCircle2, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { getStaff, deleteStaff, updateStaff } from '@/lib/actions'
import { createStaffInvite, getStaffInvites, revokeStaffInvite } from '@/lib/invite-actions'
import AddStaffModal from '@/components/AddStaffModal'
import type { Staff } from '@/types'
import { useSession } from 'next-auth/react'

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  'Senior Groomer': { bg: '#ede9fe', color: '#7c3aed' },
  'Groomer':        { bg: '#dbeafe', color: '#1d4ed8' },
  'Assistant Groomer': { bg: '#ecfdf5', color: '#059669' },
  'Receptionist':   { bg: '#fef3c7', color: '#b45309' },
  'Manager':        { bg: '#fee2e2', color: '#b91c1c' },
  'SpaAdmin':       { bg: '#e0f2fe', color: '#0369a1' },
  'Staff':          { bg: '#f3f4f6', color: '#374151' },
}

type Invite = {
  id: string
  email: string
  role: string
  expires_at: Date
  used_at: Date | null
  created: Date
  inviter: { name: string }
}

export default function StaffPage() {
  const { data: session } = useSession()
  const [staff, setStaff] = useState<Staff[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showInvites, setShowInvites] = useState(false)
  const [editingMember, setEditingMember] = useState<Staff | null>(null)
  const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive'>('All')

  // Invite modal state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('Staff')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [staffData, inviteData] = await Promise.all([
        getStaff(),
        getStaffInvites(),
      ])
      setStaff(staffData as any)
      setInvites(inviteData as any)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this staff member?')) return
    await deleteStaff(id)
    load()
  }

  const toggleStatus = async (member: Staff) => {
    const newStatus = member.status === 'Active' ? 'Inactive' : 'Active'
    await updateStaff(member.id, { status: newStatus })
    load()
  }

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user) return
    setInviteError('')
    setInviting(true)
    try {
      const invite = await createStaffInvite((session.user as any).id, inviteEmail, inviteRole)
      const baseUrl = window.location.origin
      setGeneratedLink(`${baseUrl}/register?token=${invite.token}`)
      load()
    } catch (err: any) {
      setInviteError(err.message || 'Failed to create invite.')
    } finally {
      setInviting(false)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(generatedLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this invite?')) return
    await revokeStaffInvite(id)
    load()
  }

  const closeInviteModal = () => {
    setShowInviteModal(false)
    setInviteEmail('')
    setInviteRole('Staff')
    setInviteError('')
    setGeneratedLink('')
    setCopied(false)
  }

  const pendingInvites = invites.filter(i => !i.used_at && new Date(i.expires_at) > new Date())
  const filtered = staff.filter(s => filter === 'All' || s.status === filter)
  const activeCount = staff.filter(s => s.status === 'Active').length

  return (
    <div className="p-4 md:p-8 max-w-[1100px] pb-24 md:pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold mb-1">Staff & Groomers</h1>
          <p className="text-gray-400 text-sm">{activeCount} active team members</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-outline flex items-center gap-2"
            onClick={() => setShowInviteModal(true)}
          >
            <UserPlus size={15} />
            <span className="hidden md:inline">Invite Staff</span>
          </button>
          <button
            className="btn-sage flex items-center gap-2"
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} />
            <span className="hidden md:inline">Add Staff</span>
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 md:mb-8">
        {[
          { label: 'Total Staff', value: staff.length, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
          { label: 'Active', value: activeCount, color: '#059669', bg: 'rgba(5,150,105,0.1)' },
          { label: 'Inactive', value: staff.length - activeCount, color: '#9ca3af', bg: 'rgba(156,163,175,0.1)', fullWidth: true },
        ].map(({ label, value, color, bg, fullWidth }) => (
          <div 
            key={label} 
            className={`card p-3 md:p-4 flex items-center gap-2 md:gap-3 ${fullWidth ? 'col-span-2 md:col-span-1' : ''}`}
          >
            <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 36, height: 36, background: bg }}>
              <TrendingUp size={16} style={{ color }} className="md:w-[18px] md:h-[18px]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base md:text-lg font-bold truncate" style={{ lineHeight: 1.1 }}>{value}</p>
              <p className="text-[0.65rem] md:text-xs text-gray-400 mt-0.5 truncate uppercase tracking-wider font-600">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending Invites Section */}
      {pendingInvites.length > 0 && (
        <div className="mb-6 card overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
          <button
            onClick={() => setShowInvites(!showInvites)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock size={15} style={{ color: '#6366f1' }} />
              <span className="font-600 text-sm" style={{ color: '#6366f1' }}>Pending Invites</span>
              <span
                className="inline-flex items-center justify-center rounded-full text-[0.65rem] font-700 px-2 py-0.5"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
              >
                {pendingInvites.length}
              </span>
            </div>
            {showInvites ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </button>

          {showInvites && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {pendingInvites.map(invite => {
                const expiresIn = Math.max(0, Math.ceil((new Date(invite.expires_at).getTime() - Date.now()) / 3600000))
                return (
                  <div key={invite.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className="flex items-center justify-center rounded-full flex-shrink-0"
                        style={{ width: 32, height: 32, background: 'rgba(99,102,241,0.1)' }}
                      >
                        <UserPlus size={14} style={{ color: '#6366f1' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-600 text-sm text-gray-800 truncate">{invite.email}</p>
                        <p className="text-xs text-gray-400">
                          {invite.role} · Invited by {invite.inviter.name} · Expires in {expiresIn}h
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(invite.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                      title="Revoke invite"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5">
        {(['All', 'Active', 'Inactive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-4 py-1.5 rounded-full text-sm font-600 transition-all"
            style={{
              background: filter === f ? 'var(--sage-dark)' : '#f9fafb',
              color: filter === f ? 'white' : '#6b7280',
              fontWeight: filter === f ? 700 : 500,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Staff Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <div className="flex flex-col items-center gap-3">
            <UserCog size={36} className="opacity-20 animate-pulse" />
            <p className="text-sm">Loading staff...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-gray-400">
          <UserCog size={40} className="mb-3 opacity-20" />
          <p className="font-600 text-gray-600 mb-1">No staff members found</p>
          <p className="text-sm">Add your first groomer or team member to get started.</p>
          <div className="flex gap-3 mt-5">
            <button className="btn-outline flex items-center gap-2" onClick={() => setShowInviteModal(true)}>
              <UserPlus size={15} /> Invite via Link
            </button>
            <button className="btn-sage flex items-center gap-2" onClick={() => setShowModal(true)}>
              <Plus size={15} /> Add Staff Member
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(member => {
            const roleStyle = ROLE_COLORS[member.role || ''] || { bg: '#f3f4f6', color: '#6b7280' }
            const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            return (
              <div
                key={member.id}
                className="card p-5 flex flex-col gap-4 transition-all hover:shadow-md"
                style={{ opacity: member.status === 'Inactive' ? 0.65 : 1 }}
              >
                {/* Top Row: Avatar + Name + Delete */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex items-center justify-center rounded-2xl font-bold text-lg flex-shrink-0"
                      style={{
                        width: 52,
                        height: 52,
                        background: 'linear-gradient(135deg, var(--sage-muted) 0%, rgba(137,168,148,0.3) 100%)',
                        color: 'var(--sage-dark)',
                        fontSize: '1.1rem',
                        border: '2px solid rgba(137,168,148,0.25)',
                      }}
                    >
                      {initials}
                    </div>
                    <div>
                      <p className="font-700 text-gray-800" style={{ fontSize: '0.95rem' }}>{member.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {member.role && (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-700 uppercase tracking-wider"
                            style={{ background: roleStyle.bg, color: roleStyle.color }}
                          >
                            {member.role}
                          </span>
                        )}
                        {member.hasAccount && member.accessLevel && (
                          <span
                            className="inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-700 uppercase tracking-wider"
                            style={{
                              background: member.accessLevel === 'SpaAdmin' ? '#e0f2fe' : '#f3f4f6',
                              color: member.accessLevel === 'SpaAdmin' ? '#0369a1' : '#374151',
                              border: '1px solid rgba(0,0,0,0.05)'
                            }}
                          >
                            🔑 {member.accessLevel === 'SpaAdmin' ? 'Full Access' : 'Default Access'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => {
                        setEditingMember(member)
                        setShowModal(true)
                      }}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-[var(--sage-dark)] hover:bg-[var(--sage-muted)] transition-colors"
                      title="Edit Staff / Shifts"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                      title="Remove Staff"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-2">
                  {member.specialization && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Star size={13} className="text-amber-400 flex-shrink-0" />
                      <span className="text-xs">{member.specialization}</span>
                    </div>
                  )}
                  {member.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Phone size={13} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs">{member.phone}</span>
                    </div>
                  )}
                  {member.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Mail size={13} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs truncate">{member.email}</span>
                    </div>
                  )}
                  {member.working_hours && Object.keys(member.working_hours).length > 0 && (
                    <div className="mt-1 pt-2 border-t border-gray-100 flex flex-wrap gap-1">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                        const shift = (member.working_hours as any)[day]
                        if (shift?.is_working) {
                          return (
                            <span 
                              key={day} 
                              className="text-[9px] px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-500 font-500 capitalize"
                              title={`${day}: ${shift.start} - ${shift.end}`}
                            >
                              {day.slice(0, 3)}
                            </span>
                          )
                        }
                        return null
                      })}
                    </div>
                  )}
                </div>

                {/* Footer: Status Toggle */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ background: member.status === 'Active' ? '#10b981' : '#d1d5db' }}
                    />
                    <span className="text-xs font-600 text-gray-400">{member.status}</span>
                  </div>
                  <button
                    onClick={() => toggleStatus(member)}
                    className="text-xs px-3 py-1 rounded-lg border font-600 transition-all hover:shadow-sm"
                    style={{
                      background: member.status === 'Active' ? '#fef2f2' : '#ecfdf5',
                      color: member.status === 'Active' ? '#dc2626' : '#059669',
                      borderColor: member.status === 'Active' ? '#fecaca' : '#d1fae5',
                    }}
                  >
                    {member.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Staff Modal */}
      {showModal && (
        <AddStaffModal
          existingStaff={editingMember}
          onClose={() => {
            setShowModal(false)
            setEditingMember(null)
          }}
          onSuccess={() => {
            load()
            setShowModal(false)
            setEditingMember(null)
          }}
        />
      )}

      {/* ─── Invite Staff Modal ─────────────────────────────────────────────── */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={closeInviteModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 36, height: 36, background: 'rgba(99,102,241,0.1)' }}
                >
                  <UserPlus size={18} style={{ color: '#6366f1' }} />
                </div>
                <div>
                  <h3 className="font-700 text-gray-900" style={{ fontSize: '0.95rem' }}>Invite Staff Member</h3>
                  <p className="text-xs text-gray-400">They'll receive a private registration link</p>
                </div>
              </div>
              <button
                onClick={closeInviteModal}
                className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6">
              {!generatedLink ? (
                <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
                  <div>
                    <label className="text-sm font-600 text-gray-700 block mb-1.5">Email Address</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="staff@example.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="text-sm font-600 text-gray-700 block mb-2">Access Level</label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors">
                        <input
                          type="radio"
                          name="inviteRole"
                          value="Staff"
                          checked={inviteRole === 'Staff'}
                          onChange={() => setInviteRole('Staff')}
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
                          name="inviteRole"
                          value="SpaAdmin"
                          checked={inviteRole === 'SpaAdmin'}
                          onChange={() => setInviteRole('SpaAdmin')}
                          className="mt-1 text-[var(--sage-dark)] focus:ring-[var(--sage)]"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-800">Full Access</p>
                          <p className="text-xs text-gray-400 mt-0.5">Includes full settings modification and staff panel management.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {inviteError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                      <X size={14} />
                      {inviteError}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Link2 size={12} />
                    A link will be generated — share it via WhatsApp or email. Expires in 48 hours.
                  </p>

                  <div className="flex gap-3 pt-1">
                    <button type="button" className="btn-outline flex-1" onClick={closeInviteModal}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-sage flex-1" disabled={inviting}>
                      {inviting ? 'Generating...' : 'Generate Link'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col items-center gap-3 py-3 text-center">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(16,185,129,0.1)' }}
                    >
                      <CheckCircle2 size={28} style={{ color: '#10b981' }} />
                    </div>
                    <div>
                      <p className="font-700 text-gray-900">Invite Link Ready!</p>
                      <p className="text-xs text-gray-400 mt-1">Share this link with {inviteEmail}</p>
                    </div>
                  </div>

                  <div
                    className="rounded-xl p-3 flex items-center gap-2"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}
                  >
                    <Link2 size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 flex-1 truncate font-mono">{generatedLink}</span>
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-600 flex-shrink-0 transition-all"
                      style={{
                        background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)',
                        color: copied ? '#059669' : '#6366f1',
                      }}
                    >
                      {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>

                  <p className="text-xs text-gray-400 text-center">⏰ This link expires in 48 hours</p>

                  <div className="flex gap-3 pt-1">
                    <button className="btn-outline flex-1" onClick={closeInviteModal}>
                      Done
                    </button>
                    <button
                      className="btn-sage flex-1"
                      onClick={() => {
                        setGeneratedLink('')
                        setInviteEmail('')
                        setInviteError('')
                      }}
                    >
                      Invite Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
