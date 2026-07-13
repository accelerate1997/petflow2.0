'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { 
  getSettings, 
  updateSettings, 
  getWhatsAppConfig, 
  updateWhatsAppConfig, 
  createStaff, 
  createService 
} from '@/lib/actions'
import { COUNTRY_CONFIGS, CountryCode } from '@/lib/countryConfigs'
import { 
  PawPrint, 
  Sparkles, 
  User, 
  Scissors, 
  MessageSquare, 
  Plus, 
  Trash2, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Loader2, 
  Building,
  BedDouble,
  ShoppingBag,
  Truck
} from 'lucide-react'

interface ServiceTemplate {
  service_name: string
  pet_type: string
  description: string
  price: number
  estimated_duration: number
  selected: boolean
}

interface LocalStaff {
  name: string
  email: string
  role: string
  specialization: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Step 1: Settings state
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [spaName, setSpaName] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('US')
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [taxLabel, setTaxLabel] = useState('Sales Tax')
  const [taxPresets, setTaxPresets] = useState<number[]>([0, 6, 8, 10])
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('12h')
  const [timezone, setTimezone] = useState('America/New_York')
  const [tipEnabled, setTipEnabled] = useState(true)
  const [boardingEnabled, setBoardingEnabled] = useState(true)
  const [retailEnabled, setRetailEnabled] = useState(true)
  const [mobileEnabled, setMobileEnabled] = useState(false)

  // Step 2: Staff state
  const [staffList, setStaffList] = useState<LocalStaff[]>([])
  const [newStaffName, setNewStaffName] = useState('')
  const [newStaffEmail, setNewStaffEmail] = useState('')
  const [newStaffRole, setNewStaffRole] = useState('Groomer')
  const [newStaffSpec, setNewStaffSpec] = useState('All')

  // Step 3: Services state
  const [services, setServices] = useState<ServiceTemplate[]>([
    {
      service_name: 'Full Grooming',
      pet_type: 'all',
      description: 'Full body haircut, bathing, blow dry, nail trim, ear cleaning.',
      price: 65,
      estimated_duration: 75,
      selected: true
    },
    {
      service_name: 'Bath & Brush',
      pet_type: 'all',
      description: 'Bathing, blow dry, thorough brush out, nail trim, ear cleaning.',
      price: 35,
      estimated_duration: 45,
      selected: true
    },
    {
      service_name: 'Nail Trim & Buffing',
      pet_type: 'all',
      description: 'Quick nail clip and buffing for smooth edges.',
      price: 15,
      estimated_duration: 15,
      selected: true
    },
    {
      service_name: 'Teeth Brushing',
      pet_type: 'all',
      description: 'Brushing teeth with enzymatic pet toothpaste and breath spray.',
      price: 10,
      estimated_duration: 10,
      selected: false
    }
  ])

  // Step 4: WhatsApp / Twilio credentials
  const [waConfigId, setWaConfigId] = useState<string | null>(null)
  const [twilioSid, setTwilioSid] = useState('')
  const [twilioToken, setTwilioToken] = useState('')
  const [twilioNumber, setTwilioNumber] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    async function loadInitialData() {
      try {
        const settings = await getSettings()
        if (settings) {
          setSettingsId(settings.id)
          setSpaName(settings.spa_name || '')
          if (settings.country) {
            setSelectedCountry(settings.country as CountryCode)
            const preset = COUNTRY_CONFIGS[settings.country as CountryCode]
            if (preset) {
              setCurrencySymbol(settings.currency_symbol || preset.currency_symbol)
              setCurrencyCode(settings.currency_code || preset.currency_code)
              setTaxLabel(settings.tax_label || preset.tax_label)
              setDateFormat(settings.date_format || preset.date_format)
              setTimeFormat((settings.time_format as '12h' | '24h') || preset.time_format)
              setTimezone(settings.timezone || preset.timezone)
              setTipEnabled(settings.tip_enabled ?? preset.tip_enabled)
            }
          }
          setBoardingEnabled(settings.boarding_enabled)
          setRetailEnabled(settings.retail_enabled)
          setMobileEnabled(settings.mobile_enabled)
        }

        const wa = await getWhatsAppConfig()
        if (wa) {
          setWaConfigId(wa.id)
          setTwilioSid(wa.twilio_account_sid || '')
          setTwilioToken(wa.twilio_auth_token || '')
          setTwilioNumber(wa.twilio_phone_number || '')
        }
      } catch (err) {
        console.error('Error fetching onboarding configs:', err)
      } finally {
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      loadInitialData()
    }
  }, [status, router])

  const handleCountryChange = (countryCode: CountryCode) => {
    setSelectedCountry(countryCode)
    const config = COUNTRY_CONFIGS[countryCode]
    if (config) {
      setCurrencySymbol(config.currency_symbol)
      setCurrencyCode(config.currency_code)
      setTaxLabel(config.tax_label)
      setTaxPresets(config.tax_presets)
      setDateFormat(config.date_format)
      setTimeFormat(config.time_format)
      setTimezone(config.timezone)
      setTipEnabled(config.tip_enabled)
    }
  }

  const addLocalStaff = () => {
    if (!newStaffName.trim()) {
      alert('Please enter a name for the staff member.')
      return
    }
    setStaffList([...staffList, {
      name: newStaffName.trim(),
      email: newStaffEmail.trim() || `${newStaffName.trim().toLowerCase().replace(/[^a-z]/g, '')}@petflow-spa.com`,
      role: newStaffRole,
      specialization: newStaffSpec
    }])
    setNewStaffName('')
    setNewStaffEmail('')
  }

  const removeLocalStaff = (idx: number) => {
    setStaffList(staffList.filter((_, i) => i !== idx))
  }

  const toggleServiceSelected = (idx: number) => {
    setServices(services.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s))
  }

  const updateServiceField = (idx: number, field: 'price' | 'estimated_duration', value: number) => {
    setServices(services.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const handleNext = () => {
    if (currentStep === 1 && !spaName.trim()) {
      alert('Please enter a name for your pet spa.')
      return
    }
    setCurrentStep(prev => prev + 1)
  }

  const handleBack = () => {
    setCurrentStep(prev => prev - 1)
  }

  const handleLaunch = async () => {
    setSaving(true)
    setErrorMessage(null)
    try {
      // 1. Save Settings
      const settingsPayload = {
        spa_name: spaName.trim(),
        country: selectedCountry,
        currency_symbol: currencySymbol,
        currency_code: currencyCode,
        tax_label: taxLabel,
        tax_presets: taxPresets,
        date_format: dateFormat,
        time_format: timeFormat,
        timezone: timezone,
        tip_enabled: tipEnabled,
        boarding_enabled: boardingEnabled,
        retail_enabled: retailEnabled,
        mobile_enabled: mobileEnabled,
        onboarded: true, // Complete onboarding flag!
      }
      await updateSettings(settingsId, settingsPayload)

      // 2. Save WhatsApp / Twilio Config
      if (twilioSid.trim() && twilioToken.trim()) {
        const waPayload = {
          twilio_account_sid: twilioSid.trim(),
          twilio_auth_token: twilioToken.trim(),
          twilio_phone_number: twilioNumber.trim(),
        }
        await updateWhatsAppConfig(waConfigId, waPayload)
      }

      // 3. Save Staff Members
      for (const staff of staffList) {
        await createStaff({
          name: staff.name,
          email: staff.email,
          role: staff.role,
          specialization: staff.specialization,
          status: 'Active',
          working_hours: {
            monday: { is_working: true, start: '09:00', end: '18:00' },
            tuesday: { is_working: true, start: '09:00', end: '18:00' },
            wednesday: { is_working: true, start: '09:00', end: '18:00' },
            thursday: { is_working: true, start: '09:00', end: '18:00' },
            friday: { is_working: true, start: '09:00', end: '18:00' },
            saturday: { is_working: true, start: '09:00', end: '18:00' },
            sunday: { is_working: false, start: '09:00', end: '18:00' }
          }
        })
      }

      // 4. Save selected services
      const selectedServices = services.filter(s => s.selected)
      for (const service of selectedServices) {
        await createService({
          service_name: service.service_name,
          pet_type: service.pet_type,
          description: service.description,
          price: service.price,
          estimated_duration: service.estimated_duration
        })
      }

      // Redirect user to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Onboarding failed:', err)
      setErrorMessage(err.message || 'Onboarding failed. Please try again.')
      setSaving(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F7F4] gap-4">
        <Loader2 className="w-8 h-8 text-[#89A894] animate-spin" />
        <p className="text-sm font-medium text-gray-500">Preparing your setup environment...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F7F4] p-4 md:p-8">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="bg-[#89A894] text-white p-2 rounded-xl shadow-md">
            <PawPrint className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-800">PetFlow</h1>
            <p className="text-xs text-gray-500">Salon Setup & Configuration Wizard</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Step {currentStep} of 4</span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto w-full mt-6 bg-gray-200 h-1.5 rounded-full overflow-hidden">
        <div 
          className="bg-[#89A894] h-full transition-all duration-300 ease-out" 
          style={{ width: `${(currentStep / 4) * 100}%` }}
        />
      </div>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center py-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden p-6 md:p-10 transition-all duration-300">
          
          {errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <span className="font-bold">⚠️ Error:</span> {errorMessage}
            </div>
          )}

          {/* STEP 1: Settings */}
          {currentStep === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                  <Building className="w-6 h-6 text-[#89A894]" /> Spa Profile & Brand
                </h2>
                <p className="text-sm text-gray-500 mt-1">Let's set up the core details of your pet salon brand and local regional settings.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Spa / Salon Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Bark Avenue Spa" 
                    value={spaName} 
                    onChange={e => setSpaName(e.target.value)} 
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Country Preset</label>
                  <select 
                    value={selectedCountry} 
                    onChange={e => handleCountryChange(e.target.value as CountryCode)} 
                    className="input-field cursor-pointer"
                  >
                    {Object.entries(COUNTRY_CONFIGS).map(([code, cfg]) => (
                      <option key={code} value={code}>{cfg.label}</option>
                    ))}
                  </select>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Currency</label>
                    <p className="text-sm font-semibold text-gray-700">{currencyCode} ({currencySymbol})</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tax Label</label>
                    <p className="text-sm font-semibold text-gray-700">{taxLabel}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Date Format</label>
                    <p className="text-sm font-semibold text-gray-700">{dateFormat}</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Time Format</label>
                    <p className="text-sm font-semibold text-gray-700">{timeFormat}</p>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Enabled Features</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-[#89A894] transition-all">
                      <input 
                        type="checkbox" 
                        checked={boardingEnabled} 
                        onChange={e => setBoardingEnabled(e.target.checked)} 
                        className="w-4 h-4 rounded text-[#89A894]"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> Boarding</span>
                        <span className="text-[10px] text-gray-400">Overnight lodging stays</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-[#89A894] transition-all">
                      <input 
                        type="checkbox" 
                        checked={retailEnabled} 
                        onChange={e => setRetailEnabled(e.target.checked)} 
                        className="w-4 h-4 rounded text-[#89A894]"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5" /> Retail</span>
                        <span className="text-[10px] text-gray-400">Inventory & products POS</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-[#89A894] transition-all">
                      <input 
                        type="checkbox" 
                        checked={mobileEnabled} 
                        onChange={e => setMobileEnabled(e.target.checked)} 
                        className="w-4 h-4 rounded text-[#89A894]"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-700 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> Mobile Grooming</span>
                        <span className="text-[10px] text-gray-400">Van routing & dispatching</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Staff */}
          {currentStep === 2 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                  <User className="w-6 h-6 text-[#89A894]" /> Staff & Groomers
                </h2>
                <p className="text-sm text-gray-500 mt-1">Groomers are the heart of your salon. Add your staff members to populate your calendar schedules.</p>
              </div>

              <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Add Staff Member</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <input 
                    type="text" 
                    placeholder="Staff Name" 
                    value={newStaffName} 
                    onChange={e => setNewStaffName(e.target.value)} 
                    className="input-field"
                  />
                  <input 
                    type="email" 
                    placeholder="Email (Optional)" 
                    value={newStaffEmail} 
                    onChange={e => setNewStaffEmail(e.target.value)} 
                    className="input-field"
                  />
                  <select 
                    value={newStaffRole} 
                    onChange={e => setNewStaffRole(e.target.value)} 
                    className="input-field cursor-pointer"
                  >
                    <option value="Senior Groomer">Senior Groomer</option>
                    <option value="Groomer">Groomer</option>
                    <option value="Assistant">Assistant</option>
                    <option value="Manager">Manager</option>
                  </select>
                  <button 
                    type="button" 
                    onClick={addLocalStaff} 
                    className="btn-sage w-full flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" /> Add staff
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Salon Team List ({staffList.length})</h3>
                {staffList.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <p className="text-sm text-gray-400">No groomers added yet. Please add at least one staff member to schedule bookings.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {staffList.map((staff, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-xl hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#89A894]/15 text-[#89A894] font-bold text-xs flex items-center justify-center">
                            {staff.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{staff.name}</p>
                            <p className="text-xs text-gray-500">{staff.email} • <span className="font-medium text-[#89A894]">{staff.role}</span></p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeLocalStaff(idx)} 
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Services */}
          {currentStep === 3 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                  <Scissors className="w-6 h-6 text-[#89A894]" /> Core Spa Services
                </h2>
                <p className="text-sm text-gray-500 mt-1">Select and customize the initial grooming menu you want to offer to your customers.</p>
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[350px] overflow-y-auto pr-2">
                {services.map((service, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      service.selected ? 'border-[#89A894] bg-[#89A894]/5' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <label className="flex items-start gap-3 flex-1 cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={service.selected} 
                        onChange={() => toggleServiceSelected(idx)} 
                        className="w-4.5 h-4.5 rounded text-[#89A894] mt-1"
                      />
                      <div>
                        <span className="text-sm font-bold text-gray-800">{service.service_name}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{service.description}</p>
                      </div>
                    </label>

                    {service.selected && (
                      <div className="flex items-center gap-3">
                        <div className="w-[100px]">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Price ({currencySymbol})</label>
                          <input 
                            type="number" 
                            value={service.price} 
                            onChange={e => updateServiceField(idx, 'price', parseFloat(e.target.value) || 0)} 
                            className="input-field py-1 px-2.5"
                          />
                        </div>
                        <div className="w-[100px]">
                          <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Duration (Min)</label>
                          <input 
                            type="number" 
                            value={service.estimated_duration} 
                            onChange={e => updateServiceField(idx, 'estimated_duration', parseInt(e.target.value) || 0)} 
                            className="input-field py-1 px-2.5"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: WhatsApp Connection */}
          {currentStep === 4 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-gray-800 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-[#89A894]" /> Connect AI Receptionist
                </h2>
                <p className="text-sm text-gray-500 mt-1">Configure Twilio credentials to allow Petro to chat and schedule appointments with clients via SMS/WhatsApp.</p>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-4 rounded-xl">
                  <p className="font-bold flex items-center gap-1">💡 Option details:</p>
                  <p className="mt-1">PetFlow uses Twilio to send automated marketing followups, invoice links, and coordinate appointments. You can enter your Twilio keys below or leave them empty to configure later inside Settings.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Twilio Account SID</label>
                  <input 
                    type="text" 
                    placeholder="e.g. ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" 
                    value={twilioSid} 
                    onChange={e => setTwilioSid(e.target.value)} 
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Twilio Auth Token</label>
                  <input 
                    type="password" 
                    placeholder="Twilio secret authorization token" 
                    value={twilioToken} 
                    onChange={e => setTwilioToken(e.target.value)} 
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Twilio Phone Number / WhatsApp Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. +14155552671" 
                    value={twilioNumber} 
                    onChange={e => setTwilioNumber(e.target.value)} 
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-150">
            {currentStep > 1 ? (
              <button 
                type="button" 
                onClick={handleBack} 
                className="btn-outline"
                disabled={saving}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button 
                type="button" 
                onClick={handleNext} 
                className="btn-sage"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button 
                type="button" 
                onClick={handleLaunch} 
                disabled={saving}
                className="btn-sage font-bold flex items-center gap-2"
                style={{ background: 'var(--sage-dark)', padding: '0.625rem 2rem' }}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Launching...
                  </>
                ) : (
                  <>
                    Launch Spa <Check className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
