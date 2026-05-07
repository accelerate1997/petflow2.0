export interface Client {
  id: string
  name: string
  whatsapp_number: string | null
  email: string | null
  address: string | null
  total_spend: number
  join_date: string
  created_at: string
  pets?: Pet[]
}

export interface Pet {
  id: string
  pet_name: string
  species: 'dog' | 'cat' | 'other'
  breed: string | null
  weight: number | null
  temperament_notes: string | null
  medical_alerts: string | null
  photo: string | null
  photo_url?: string | null
  owner_id: string
  created: string
  collectionId: string
  collectionName: string
  expand?: {
    owner_id: Client
  }
  clients?: { name: string }
}

export type Temperament = 'Friendly' | 'Calm' | 'Anxious' | 'Aggressive' | string

export const temperamentConfig: Record<string, { color: string; bg: string; dot: string }> = {
  Friendly: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  Calm:     { color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',       dot: 'bg-blue-500' },
  Anxious:  { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',     dot: 'bg-amber-500' },
  Aggressive:{ color: 'text-red-700',   bg: 'bg-red-50 border-red-200',          dot: 'bg-red-500' },
  Default:  { color: 'text-gray-600',   bg: 'bg-gray-50 border-gray-200',        dot: 'bg-gray-400' },
}

export function getTemperamentStyle(notes: string | null) {
  if (!notes) return temperamentConfig.Default
  const key = Object.keys(temperamentConfig).find(k =>
    notes.toLowerCase().includes(k.toLowerCase())
  )
  return key ? temperamentConfig[key] : temperamentConfig.Default
}

export type AppointmentStatus = 'Lead' | 'Booked' | 'CheckedIn' | 'InService' | 'Done' | 'CheckedOut' | 'Cancelled' | 'No-show'

export interface Appointment {
  id: string
  pet_id: string
  service_type: string
  appointment_date: string
  appointment_time: string
  status: AppointmentStatus
  price: number
  notes: string | null
  created_at: string
  pets?: Pet & { clients: { name: string } }
}

export const statusStyles: Record<AppointmentStatus, { color: string; bg: string }> = {
  Lead:       { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  Booked:     { color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  CheckedIn:  { color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
  InService:  { color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200' },
  Done:       { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  CheckedOut: { color: 'text-gray-700',    bg: 'bg-gray-100 border-gray-300' },
  Cancelled:  { color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  'No-show':   { color: 'text-gray-700',    bg: 'bg-gray-50 border-gray-200' },
}
export interface Service {
  id: string
  thumbnail: string | null
  service_name: string
  pet_type: 'dog' | 'cat' | 'other' | 'all'
  description: string | null
  price: number
  created_at: string
}

export interface BusinessHours {
  open: string
  close: string
  closed: boolean
}

export interface Settings {
  id: string
  spa_name: string
  spa_whatsapp: string | null
  spa_email: string | null
  spa_address: string | null
  business_hours: Record<string, BusinessHours>
  currency_symbol: string
  updated_at: string
}
