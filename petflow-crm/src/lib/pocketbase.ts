import PocketBase from 'pocketbase'

const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090'
export const pb = new PocketBase(pbUrl)

// Optional: if you want to use auto-cancellation
// pb.autoCancellation(false)

export const isPocketBaseConfigured = !!process.env.NEXT_PUBLIC_POCKETBASE_URL
