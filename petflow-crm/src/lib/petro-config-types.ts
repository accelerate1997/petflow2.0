// ─── Petro Config Types & Constants ──────────────────────────────────────────
// This file is NOT a server action file — it only exports types and constants.
// Import async functions from petro-config-actions.ts instead.

export interface KnowledgeEntry {
  id: string
  question: string
  answer: string
}

export interface BookingRules {
  slot_duration: number
  max_advance_days: number
  max_concurrent: number
  working_hours: {
    [day: string]: {
      start: string
      end: string
      is_working: boolean
    }
  }
  required_fields: string[]
}

export interface PetroConfigData {
  id?: string
  tenantId?: string
  agent_name: string
  persona: string
  tone: string
  language: string
  booking_rules: BookingRules
  tools_enabled: string[]
  knowledge_base: KnowledgeEntry[]
  plan_tier: string
  is_active: boolean
}

export const DEFAULT_BOOKING_RULES: BookingRules = {
  slot_duration: 60,
  max_advance_days: 30,
  max_concurrent: 3,
  working_hours: {
    mon: { start: '09:00', end: '18:00', is_working: true },
    tue: { start: '09:00', end: '18:00', is_working: true },
    wed: { start: '09:00', end: '18:00', is_working: true },
    thu: { start: '09:00', end: '18:00', is_working: true },
    fri: { start: '09:00', end: '18:00', is_working: true },
    sat: { start: '09:00', end: '14:00', is_working: true },
    sun: { start: '09:00', end: '14:00', is_working: false },
  },
  required_fields: ['pet_name', 'species'],
}

export const ALL_TOOLS = [
  { name: 'search_client_and_pets',    label: 'Client Lookup',           description: 'Search clients by phone number',           required: true  },
  { name: 'create_client_profile',     label: 'Create Client Profile',   description: 'Register new clients in CRM',              required: true  },
  { name: 'add_pet_to_profile',        label: 'Add Pet to Profile',      description: 'Add a pet to a client profile',            required: true  },
  { name: 'create_appointment',        label: 'Book Appointments',       description: 'Create grooming appointments',             required: false },
  { name: 'get_upcoming_appointments', label: 'View Appointments',       description: 'Fetch upcoming appointments',              required: false },
  { name: 'reschedule_appointment',    label: 'Reschedule Appointments', description: 'Move appointments to new times',           required: false },
  { name: 'list_available_services',   label: 'List Services & Prices',  description: 'Show available services with pricing',     required: false },
  { name: 'get_vaccination_records',   label: 'Vaccination Records',     description: 'View pet vaccination history',             required: false },
]
