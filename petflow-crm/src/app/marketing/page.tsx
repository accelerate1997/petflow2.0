'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Megaphone,
  Send,
  Users,
  Sparkles,
  CheckCircle2,
  Loader2,
  Info,
  Trash2,
  Image as ImageIcon,
  History,
  AlertCircle,
  Eye,
  Check,
  DollarSign,
  Upload,
  X,
  Link as LinkIcon
} from 'lucide-react'
import {
  getCampaigns,
  createCampaign,
  deleteCampaign,
  getSegmentedClientsCount,
  broadcastCampaign,
  SegmentFilters,
  getPresignedUploadUrl
} from '@/lib/actions'

interface CompressedResult {
  previewUrl: string
  blob: Blob
}

async function compressImage(file: File, maxWidth = 800, quality = 0.8): Promise<CompressedResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }
        ctx.drawImage(img, 0, 0, width, height)
        
        const previewUrl = canvas.toDataURL('image/jpeg', quality)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ previewUrl, blob })
          } else {
            reject(new Error('Canvas compression failed'))
          }
        }, 'image/jpeg', quality)
      }
      img.src = e.target!.result as string
    }
    reader.readAsDataURL(file)
  })
}

interface Campaign {
  id: string
  name: string
  message: string
  mediaUrl: string | null
  segmentFilters: any
  status: string
  sentCount: number
  failedCount: number
  created: Date
  logs?: { id: string }[]
}

export default function MarketingPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create')
  
  // Lists & data
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  
  // Campaign composer states
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [mediaFile, setMediaFile] = useState<Blob | null>(null)
  
  // Targeting filter states
  const [petSpecies, setPetSpecies] = useState('all')
  const [inactiveDays, setInactiveDays] = useState('all')
  const [minSpend, setMinSpend] = useState('')
  
  // Live calculation states
  const [reachCount, setReachCount] = useState(0)
  const [calculatingReach, setCalculatingReach] = useState(false)
  
  // Status states
  const [sending, setSending] = useState(false)
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)
  const [campaignProgress, setCampaignProgress] = useState<{ sent: number; failed: number; total: number } | null>(null)

  // Media upload states
  const [mediaMode, setMediaMode] = useState<'upload' | 'url'>('upload')
  const [compressingMedia, setCompressingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setCompressingMedia(true)
    try {
      const { previewUrl, blob } = await compressImage(file)
      setMediaUrl(previewUrl)
      setMediaFile(blob)
    } catch (err) {
      console.error(err)
      alert('Failed to process image file')
    } finally {
      setCompressingMedia(false)
    }
  }

  // Fetch campaigns and update reach initially
  useEffect(() => {
    loadCampaigns()
  }, [])

  // Recalculate estimated reach when filters change
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      calculateReach()
    }, 400) // Debounce dynamic query to save DB load

    return () => clearTimeout(delayDebounce)
  }, [petSpecies, inactiveDays, minSpend])

  // Poll progress when a campaign is sending
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (sending && activeCampaignId) {
      interval = setInterval(async () => {
        const latestCampaigns = await getCampaigns()
        setCampaigns(latestCampaigns as any)
        const current = latestCampaigns.find(c => c.id === activeCampaignId)
        if (current) {
          setCampaignProgress({
            sent: current.sentCount,
            failed: current.failedCount,
            total: reachCount
          })
          if (current.status === 'Completed' || current.status === 'Failed') {
            setSending(false)
            setActiveCampaignId(null)
            setCampaignProgress(null)
            loadCampaigns()
            alert(`Campaign blast complete! Sent: ${current.sentCount}, Failed: ${current.failedCount}`)
          }
        }
      }, 2000)
    }

    return () => clearInterval(interval)
  }, [sending, activeCampaignId, reachCount])

  const loadCampaigns = async () => {
    const list = await getCampaigns()
    setCampaigns(list as any)
  }

  const calculateReach = async () => {
    setCalculatingReach(true)
    try {
      const filters: SegmentFilters = {
        petSpecies,
        inactiveDays,
        minSpend: minSpend || undefined
      }
      const count = await getSegmentedClientsCount(filters)
      setReachCount(count)
    } catch (e) {
      console.error(e)
    }
    setCalculatingReach(false)
  }

  const handleCreateAndSend = async () => {
    if (!name.trim()) return alert('Please enter a campaign name')
    if (!message.trim()) return alert('Please write a campaign message')
    if (reachCount === 0) return alert('No clients match your filter criteria')

    const filters = { petSpecies, inactiveDays, minSpend: minSpend || undefined }

    if (!confirm(`Are you sure you want to send this campaign blast to ${reachCount} matching clients?`)) return

    setSending(true)
    try {
      let finalMediaUrl = mediaUrl || undefined

      // If mediaMode is upload and there is a mediaFile, upload it to R2 first
      if (mediaMode === 'upload' && mediaFile) {
        const { uploadUrl, publicUrl } = await getPresignedUploadUrl(
          'flyer.jpg',
          'image/jpeg',
          'marketing'
        )

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: mediaFile
        })

        if (!uploadRes.ok) {
          throw new Error('Failed to upload campaign flyer to Cloudflare R2.')
        }

        finalMediaUrl = publicUrl
      }

      // 1. Save Campaign Draft
      const campaign = await createCampaign({
        name,
        message,
        mediaUrl: finalMediaUrl,
        segmentFilters: filters
      })

      setActiveCampaignId(campaign.id)
      setCampaignProgress({ sent: 0, failed: 0, total: reachCount })
      
      // Reload campaigns tab
      loadCampaigns()

      // 2. Start broadcast (Next.js server action)
      await broadcastCampaign(campaign.id)
      
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to initialize campaign')
      setSending(false)
      setActiveCampaignId(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This will remove all delivery history.')) return
    await deleteCampaign(id)
    loadCampaigns()
  }

  // Formatting filters for display in table
  const renderFilters = (filterObj: any) => {
    if (!filterObj) return 'All Clients'
    const parts = []
    if (filterObj.petSpecies && filterObj.petSpecies !== 'all') {
      parts.push(`Pet: ${filterObj.petSpecies}`)
    }
    if (filterObj.inactiveDays && filterObj.inactiveDays !== 'all') {
      parts.push(`Inactive: ${filterObj.inactiveDays}d`)
    }
    if (filterObj.minSpend) {
      parts.push(`Spend >= ₹${filterObj.minSpend}`)
    }
    return parts.length > 0 ? parts.join(', ') : 'All Clients'
  }

  // Personalization preview replace
  const getPreviewText = () => {
    let text = message || 'Type your message in the composer... 🐾'
    text = text.replace(/{name}/g, 'John Doe')
    text = text.replace(/{pet_name}/g, 'Buddy')
    return text
  }

  // Calculate statistics
  const totalCampaigns = campaigns.length
  const totalSentMessages = campaigns.reduce((acc, c) => acc + c.sentCount, 0)
  const successRate = totalSentMessages > 0 
    ? Math.round((totalSentMessages / (totalSentMessages + campaigns.reduce((acc, c) => acc + c.failedCount, 0))) * 100) 
    : 100

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight flex items-center gap-3">
            Campaign Center <Megaphone className="text-sage" size={28} />
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Build dynamic customer segments and run media-rich WhatsApp campaigns.
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl w-fit self-start">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'create'
                ? 'bg-white text-sage-dark shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Sparkles size={16} />
            New Campaign
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-white text-sage-dark shadow-sm'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <History size={16} />
            History & Analytics ({campaigns.length})
          </button>
        </div>
      </div>

      {/* Top Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6 bg-white border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center text-sage-dark">
            <Megaphone size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Campaigns</p>
            <h3 className="text-2xl font-black text-gray-800">{totalCampaigns} Runs</h3>
          </div>
        </div>

        <div className="card p-6 bg-white border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500">
            <Send size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Delivered Messages</p>
            <h3 className="text-2xl font-black text-gray-800">{totalSentMessages} Sent</h3>
          </div>
        </div>

        <div className="card p-6 bg-white border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Overall Success Rate</p>
            <h3 className="text-2xl font-black text-gray-800">{successRate}%</h3>
          </div>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Campaign Form */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Segmentation Targeting Card */}
            <div className="card p-6 bg-white space-y-4">
              <h2 className="text-base font-extrabold text-gray-800 flex items-center gap-2 border-b border-gray-50 pb-3">
                <Users size={18} className="text-sage" />
                1. Target Audience Segmentation
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pet Species */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pet Species</label>
                  <select
                    value={petSpecies}
                    onChange={(e) => setPetSpecies(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white text-sm outline-none transition-all"
                  >
                    <option value="all">All Species (Cats, Dogs, etc.)</option>
                    <option value="dog">Dogs Only</option>
                    <option value="cat">Cats Only</option>
                    <option value="bird">Birds Only</option>
                  </select>
                </div>

                {/* Inactivity Threshold */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recency / Inactivity</label>
                  <select
                    value={inactiveDays}
                    onChange={(e) => setInactiveDays(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white text-sm outline-none transition-all"
                  >
                    <option value="all">Active & Inactive (All)</option>
                    <option value="30">Lapsed (No visits in 30+ days)</option>
                    <option value="60">Dormant (No visits in 60+ days)</option>
                    <option value="90">Highly Dormant (No visits in 90+ days)</option>
                  </select>
                </div>

                {/* Min Client Spend */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Minimum Total Spend (₹)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 text-sm">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 1000 for high spenders"
                      value={minSpend}
                      onChange={(e) => setMinSpend(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white text-sm outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Estimated Reach Indicator */}
              <div className="bg-sage-muted/30 border border-sage/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[0.65rem] text-sage-dark font-black tracking-wider uppercase">Estimated Reach</p>
                  <h4 className="text-lg font-black text-gray-800">
                    {calculatingReach ? (
                      <Loader2 className="animate-spin text-sage inline-block mr-2" size={18} />
                    ) : (
                      `${reachCount} Clients`
                    )}
                  </h4>
                </div>
                <span className="text-[0.65rem] bg-sage/10 text-sage-dark px-2.5 py-1 rounded-full font-bold">
                  DYNAMIC TARGETING
                </span>
              </div>
            </div>

            {/* Campaign Details Form */}
            <div className="card p-6 bg-white space-y-4">
              <h2 className="text-base font-extrabold text-gray-800 flex items-center gap-2 border-b border-gray-50 pb-3">
                <Megaphone size={18} className="text-sage" />
                2. Campaign Content
              </h2>

              {/* Campaign Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Campaign Name</label>
                <input
                  type="text"
                  placeholder="e.g. Monsoon Grooming Discount"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white text-sm outline-none transition-all"
                />
              </div>

              {/* Campaign Media */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-sage" /> Campaign Media (Optional)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMediaMode('upload')
                        setMediaUrl('')
                        setMediaFile(null)
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                        mediaMode === 'upload'
                          ? 'bg-sage/10 text-sage-dark'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMediaMode('url')
                        setMediaUrl('')
                        setMediaFile(null)
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all ${
                        mediaMode === 'url'
                          ? 'bg-sage/10 text-sage-dark'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Web Link
                    </button>
                  </div>
                </div>

                {mediaMode === 'upload' ? (
                  <div className="space-y-2">
                    {mediaUrl ? (
                      <div className="relative border border-dashed border-gray-200 rounded-xl p-3 bg-gray-50/50 flex items-center justify-between gap-3 group">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 border overflow-hidden relative flex items-center justify-center flex-shrink-0">
                            <img src={mediaUrl} alt="Uploaded media preview" className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-700">Flyer Image Loaded</p>
                            <p className="text-[10px] font-medium text-gray-400">Compressed · JPG format</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setMediaUrl('')
                            setMediaFile(null)
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center justify-center"
                          title="Remove media file"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed border-gray-200 hover:border-sage hover:bg-sage-muted/5 rounded-xl p-6 text-center cursor-pointer transition-all ${
                          compressingMedia ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          accept="image/*"
                          onChange={handleMediaUpload}
                          className="hidden"
                        />
                        {compressingMedia ? (
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Loader2 className="animate-spin text-sage" size={24} />
                            <p className="text-xs font-bold text-gray-500">Compressing Image...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <Upload className="text-gray-400" size={22} />
                            <p className="text-xs font-bold text-gray-600">Click to Upload Image Flyer</p>
                            <p className="text-[10px] font-medium text-gray-400">Supports JPG, PNG (automatically resized & optimized)</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400">
                      <LinkIcon size={14} />
                    </span>
                    <input
                      type="url"
                      placeholder="https://example.com/flyer.png"
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white text-sm outline-none transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Message Composer */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Message</label>
                  <span className="text-[0.65rem] text-gray-400 font-semibold">
                    Merge Tags: <code className="bg-gray-100 px-1 py-0.5 rounded text-sage-dark">{'{name}'}</code> <code className="bg-gray-100 px-1 py-0.5 rounded text-sage-dark">{'{pet_name}'}</code>
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Hi {name}, treat your dog {pet_name} to our Special De-shedding Session this weekend and get 15% off! 🐾"
                  className="w-full h-32 p-3 rounded-lg border border-gray-200 bg-gray-50 focus:bg-white text-sm outline-none transition-all resize-none"
                />
              </div>

              {/* Warnings/Help */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2.5">
                <Info className="text-blue-500 flex-shrink-0" size={16} />
                <p className="text-[0.7rem] text-blue-700 leading-relaxed">
                  <strong>Standard Best Practice:</strong> We implement a 1.5s delay between messages to ensure WhatsApp doesn't identify the broadcast as bulk automated spam. Avoid blasting lists larger than 500 in one go.
                </p>
              </div>

              {/* Broadcast Action / Progress */}
              {sending ? (
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                    <span className="flex items-center gap-1.5 text-sage-dark">
                      <Loader2 className="animate-spin" size={14} />
                      Sending Campaign Blast...
                    </span>
                    <span>
                      {campaignProgress ? `${campaignProgress.sent + campaignProgress.failed} / ${campaignProgress.total}` : 'Initializing...'}
                    </span>
                  </div>
                  {campaignProgress && (
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${((campaignProgress.sent + campaignProgress.failed) / campaignProgress.total) * 100}%` }}
                        className="h-full bg-sage transition-all duration-300"
                      />
                    </div>
                  )}
                  <p className="text-[0.65rem] text-gray-400 text-center font-medium">
                    Please do not close this window while the broadcast is running.
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleCreateAndSend}
                  disabled={!name.trim() || !message.trim() || reachCount === 0}
                  className="btn-sage w-full py-3 justify-center text-sm font-bold gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:shadow-none"
                >
                  <Send size={16} />
                  Launch Campaign Blast to {reachCount} Clients
                </button>
              )}
            </div>
          </div>

          {/* Sidebar - WhatsApp Live Preview */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-8">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5 pl-1">
              <Eye size={14} /> Live WhatsApp Preview
            </h3>

            {/* Mock Phone Frame */}
            <div className="border-[10px] border-gray-800 rounded-[2.5rem] bg-gray-900 shadow-2xl overflow-hidden aspect-[9/18] max-w-[340px] mx-auto flex flex-col">
              {/* Top Notch bar */}
              <div className="h-6 bg-gray-800 flex items-center justify-between px-6 text-[0.6rem] text-gray-300 font-bold">
                <span>9:41</span>
                <div className="w-16 h-4 bg-black rounded-b-xl mx-auto -mt-1 hidden xs:block" />
                <div className="flex gap-1">
                  <span>📶</span>
                  <span>🔋</span>
                </div>
              </div>

              {/* Chat Header */}
              <div className="bg-[#075e54] text-white p-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-teal-700/60 border border-teal-600 flex items-center justify-center font-bold text-xs">
                  PF
                </div>
                <div>
                  <h4 className="text-[0.75rem] font-bold">PetFlow Spa</h4>
                  <p className="text-[0.55rem] text-teal-100">Online</p>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 p-3 bg-[#efeae2] flex flex-col justify-end overflow-y-auto space-y-4">
                
                {/* Chat Bubble */}
                <div className="max-w-[85%] bg-white rounded-xl rounded-tl-none p-2 shadow-sm border border-gray-100 self-start text-xs space-y-2 relative">
                  
                  {/* Media Content */}
                  {mediaUrl ? (
                    <div className="rounded-lg overflow-hidden border border-gray-50 bg-gray-100 aspect-video flex items-center justify-center relative">
                      <img
                        src={mediaUrl}
                        alt="Campaign Flyer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback display if URL is broken or not loaded yet
                          (e.target as HTMLElement).style.display = 'none'
                        }}
                      />
                      <span className="text-[0.6rem] text-gray-400 absolute">Image Attachment</span>
                    </div>
                  ) : null}

                  {/* Message Content */}
                  <p className="text-gray-800 text-[0.7rem] leading-relaxed whitespace-pre-wrap">
                    {getPreviewText()}
                  </p>

                  {/* Time / Tick */}
                  <div className="flex items-center justify-end gap-1 text-[0.5rem] text-gray-400 mt-1">
                    <span>9:41 AM</span>
                    <span className="text-blue-500">✔✔</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>
      ) : (
        /* History & Analytics Tab */
        <div className="card bg-white p-6 overflow-hidden">
          <h2 className="text-lg font-extrabold text-gray-800 mb-4 flex items-center gap-2">
            <History size={20} className="text-sage" />
            Campaign Execution Log
          </h2>

          {campaigns.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <AlertCircle className="mx-auto text-gray-300" size={40} />
              <h3 className="text-sm font-bold text-gray-500">No campaigns sent yet</h3>
              <p className="text-xs text-gray-400">Launch your first dynamic campaign segment to see statistics here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <th className="pb-3 pl-2">Campaign</th>
                    <th className="pb-3">Target Segment</th>
                    <th className="pb-3">Sent / Failed</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Launch Date</th>
                    <th className="pb-3 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-gray-700">
                  {campaigns.map((camp) => (
                    <tr key={camp.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 pl-2">
                        <div className="font-extrabold text-gray-800 text-sm">{camp.name}</div>
                        <div className="text-xs text-gray-400 font-semibold truncate max-w-[200px]">{camp.message}</div>
                      </td>
                      <td className="py-4 text-xs font-bold text-sage-dark">
                        {renderFilters(camp.segmentFilters)}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-bold">
                            {camp.sentCount} sent
                          </span>
                          {camp.failedCount > 0 && (
                            <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-bold">
                              {camp.failedCount} failed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`text-[0.65rem] px-2 py-0.5 rounded-full font-black tracking-wider uppercase ${
                          camp.status === 'Completed' ? 'bg-green-50 text-green-700 border border-green-200' :
                          camp.status === 'Sending' ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse' :
                          camp.status === 'Failed' ? 'bg-red-50 text-red-700 border border-red-200' :
                          'bg-gray-50 text-gray-500 border border-gray-200'
                        }`}>
                          {camp.status}
                        </span>
                      </td>
                      <td className="py-4 text-xs text-gray-400 font-bold">
                        {new Date(camp.created).toLocaleDateString()} at {new Date(camp.created).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 pr-2 text-right">
                        <button
                          onClick={() => handleDelete(camp.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors inline-block"
                          title="Delete Campaign Log"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
