export interface DailyShift {
  is_working: boolean;
  start?: string;
  end?: string;
}

export type WorkingHours = Record<string, DailyShift>;

export interface Staff {
  id: string
  name: string
  phone: string | null
  email: string | null
  role: string | null
  specialization: string | null
  status: 'Active' | 'Inactive' | string
  working_hours?: WorkingHours | any
  created: Date | string
  updated: Date | string
  hasAccount?: boolean
  accessLevel?: 'Staff' | 'SpaAdmin' | null
}

export interface Client {
  id: string
  name: string
  whatsapp_number: string | null
  email: string | null
  address: string | null
  total_spend: number | null
  join_date: Date | string | null
  created: Date | string
  updated: Date | string
  pets?: Pet[]
}

export interface Pet {
  id: string
  pet_name: string
  species: string | null
  breed: string | null
  weight: number | null
  temperament_notes: string | null
  medical_alerts: string | null
  photo: string | null
  owner_id: string
  owner?: Client
  vaccinations?: VaccinationRecord[]
  created: Date | string
  updated: Date | string
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

export type AppointmentStatus = 'Lead' | 'Booked' | 'CheckedIn' | 'InService' | 'Done' | 'CheckOut' | 'Cancelled' | 'No-show'

export interface Invoice {
  id: string
  invoice_number: string
  appointment_id?: string | null
  appointment?: Appointment | null
  boarding_reservation_id?: string | null
  boarding_reservation?: BoardingReservation | null
  subtotal: number
  discount: number
  discount_type: 'flat' | 'percent' | string
  tax_rate: number
  tax_amount: number
  total_amount: number
  payment_method: 'Cash' | 'UPI' | 'Split' | string
  cash_amount: number | null
  upi_amount: number | null
  invoice_notes: string | null
  created: Date | string
  updated: Date | string
}

export interface Appointment {
  id: string
  pet_id: string
  pet?: Pet
  groomer_id: string | null
  groomer?: Staff | null
  service_type: string
  appointment_date: string
  appointment_time: string
  status: AppointmentStatus | string
  payment_status: 'Pending' | 'Cash' | 'UPI' | string
  price: number | null
  notes: string | null
  grooming_notes: string | null
  before_photos: string[]
  after_photos: string[]
  created: Date | string
  updated: Date | string
  boarding_reservation_id?: string | null
  invoice?: Invoice | null
}

export const statusStyles: Record<AppointmentStatus, { color: string; bg: string }> = {
  Lead:       { color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  Booked:     { color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  CheckedIn:  { color: 'text-indigo-700',  bg: 'bg-indigo-50 border-indigo-200' },
  InService:  { color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200' },
  Done:       { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  CheckOut: { color: 'text-gray-700',    bg: 'bg-gray-100 border-gray-300' },
  Cancelled:  { color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  'No-show':   { color: 'text-gray-700',    bg: 'bg-gray-50 border-gray-200' },
}

export interface Service {
  id: string
  thumbnail: string | null
  service_name: string
  pet_type: 'dog' | 'cat' | 'other' | 'all' | string | null
  description: string | null
  price: number               // base / fallback price
  price_small: number | null  // < 10kg
  price_medium: number | null // 10–25kg
  price_large: number | null  // > 25kg
  estimated_duration: number
  created: Date | string
  updated: Date | string
}

export interface BusinessHours {
  open: string
  close: string
  closed: boolean
}

export interface Settings {
  id: string
  spa_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  accent_color: string
  spa_whatsapp: string | null
  spa_email: string | null
  spa_address: string | null
  business_hours: any
  currency_symbol: string | null
  currency_code: string | null
  boarding_enabled?: boolean
  retail_enabled?: boolean
  created: Date | string
  updated: Date | string
}

export interface Product {
  id: string
  name: string
  sku: string | null
  category: string | null
  description: string | null
  retail_price: number
  cost_price: number | null
  stock: number
  low_stock_threshold: number
  unit: string | null
  image_url: string | null
  is_active: boolean
  created: Date | string
  updated: Date | string
}

export const PRODUCT_CATEGORIES = [
  'Shampoo', 'Conditioner', 'Treats', 'Accessories', 'Supplies', 'Equipment', 'Other'
] as const

export interface Sale {
  id: string
  invoice_id: string | null
  client_id: string
  product_id: string
  product?: Product
  quantity: number
  unit_price: number
  total_price: number
  boarding_reservation_id?: string | null
  created: Date | string
}

export interface ChatSession {
  id: string
  phone: string
  client_id: string | null
  client?: {
    name: string
    whatsapp_number: string | null
  }
  last_message: string | null
  is_paused: boolean
  created: Date | string
  updated: Date | string
  messages?: ChatMessage[]
}

export interface ChatMessage {
  id: string
  session_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_call_id: string | null
  name: string | null
  created: Date | string
}

export interface VaccinationRecord {
  id: string
  pet_id: string
  vaccine_name: string
  administered: Date | string
  due_date: Date | string
  status: 'Active' | 'Overdue' | 'Due Soon' | string
  notes: string | null
  created: Date | string
  updated: Date | string
}

// ─── Boarding ─────────────────────────────────────────────────────────────────

export interface BoardingRoom {
  id: string
  name: string
  room_type: 'Standard' | 'Deluxe' | 'Suite' | string
  size_category: 'Small' | 'Medium' | 'Large' | 'Cat' | string
  pet_type: 'dog' | 'cat' | 'all' | string
  price_per_night: number
  capacity: number
  status: 'Available' | 'Maintenance' | string
  notes: string | null
  created: Date | string
  updated: Date | string
  reservations?: BoardingReservation[]
}

export interface BoardingReservation {
  id: string
  room_id: string
  room?: BoardingRoom
  pet_id: string
  pet?: Pet
  check_in_date: string
  check_out_date: string
  total_nights: number
  total_amount: number
  status: 'Reserved' | 'CheckedIn' | 'CheckedOut' | 'Cancelled' | string
  payment_status: 'Pending' | 'Cash' | 'UPI' | 'Split' | 'Paid' | string
  payment_method: string | null
  special_notes: string | null
  feeding_notes: string | null
  medication_notes: string | null
  emergency_contact: string | null
  check_in_weight?: number | null
  check_in_belongings?: string | null
  check_in_health?: string | null
  check_in_signature?: string | null
  invoice?: Invoice | null
  care_logs?: BoardingCareLog[]
  appointments?: Appointment[]
  sales?: Sale[]
  created: Date | string
  updated: Date | string
}

export interface BoardingCareLog {
  id: string
  reservation_id: string
  date: string
  activity_type: string
  status: string
  notes: string | null
  photo_url: string | null
  logged_by: string | null
  created_at: Date | string
}
