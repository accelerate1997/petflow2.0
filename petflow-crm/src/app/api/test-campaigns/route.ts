import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSegmentedClients, createCampaign, deleteCampaign, getSegmentedClientsCount } from '@/lib/actions'

export async function GET() {
  const log: string[] = []
  
  // Keep track of created entities for cleanup
  let testClientId: string | null = null
  let testPetId: string | null = null
  let testAppointmentId: string | null = null
  let testCampaignId: string | null = null

  try {
    log.push("Starting Campaign & Segmentation Automated Integration Tests...")

    // 1. Create a test client with total spend 1500
    log.push("TC1: Setting up test database records...")
    const client = await prisma.client.create({
      data: {
        name: "Test Campaign Client",
        whatsapp_number: "919876543210",
        email: "test.campaign@petflow.com",
        total_spend: 1500.00
      }
    })
    testClientId = client.id
    log.push(`Created test client: ${client.name} (ID: ${client.id}, Spend: ₹${client.total_spend})`)

    // Create a pet for the client
    const pet = await prisma.pet.create({
      data: {
        pet_name: "Test Rover",
        species: "dog",
        breed: "Golden Retriever",
        owner_id: client.id
      }
    })
    testPetId = pet.id
    log.push(`Created test pet: ${pet.pet_name} (Species: ${pet.species}, Owner ID: ${pet.owner_id})`)

    // Create an old appointment (45 days ago)
    const fortyFiveDaysAgo = new Date()
    fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45)
    const apptDateStr = fortyFiveDaysAgo.toISOString().split('T')[0]

    const appointment = await prisma.appointment.create({
      data: {
        pet_id: pet.id,
        service_type: "Grooming",
        appointment_date: apptDateStr,
        appointment_time: "10:00",
        status: "Done",
        price: 800.00
      }
    })
    testAppointmentId = appointment.id
    log.push(`Created test appointment on: ${apptDateStr} (Status: ${appointment.status})`)

    // 2. Test Pet Species Filtering
    log.push("TC2: Testing pet species filtering...")
    const dogFilters = { petSpecies: 'dog' }
    const catFilters = { petSpecies: 'cat' }

    const dogs = await getSegmentedClients(dogFilters)
    const cats = await getSegmentedClients(catFilters)

    const hasClientInDogs = dogs.some(c => c.id === client.id)
    const hasClientInCats = cats.some(c => c.id === client.id)

    log.push(`Dogs segment count: ${dogs.length}, contains test client: ${hasClientInDogs} (Expected: true)`)
    log.push(`Cats segment count: ${cats.length}, contains test client: ${hasClientInCats} (Expected: false)`)

    if (!hasClientInDogs || hasClientInCats) {
      throw new Error("Species filtering failed. Client mis-segmented.")
    }

    // 3. Test Spend Tier Filtering
    log.push("TC3: Testing spend tier filtering...")
    const highSpendFilters = { minSpend: "2000" } // Client has 1500, should be excluded
    const lowSpendFilters = { minSpend: "1000" }  // Client has 1500, should be included

    const highSpenders = await getSegmentedClients(highSpendFilters)
    const lowSpenders = await getSegmentedClients(lowSpendFilters)

    const hasClientHighSpend = highSpenders.some(c => c.id === client.id)
    const hasClientLowSpend = lowSpenders.some(c => c.id === client.id)

    log.push(`Spend >= ₹2000 count: ${highSpenders.length}, contains test client: ${hasClientHighSpend} (Expected: false)`)
    log.push(`Spend >= ₹1000 count: ${lowSpenders.length}, contains test client: ${hasClientLowSpend} (Expected: true)`)

    if (hasClientHighSpend || !hasClientLowSpend) {
      throw new Error("Spend tier filtering failed. Client mis-segmented.")
    }

    // 4. Test Inactivity (Recency) Filtering
    log.push("TC4: Testing inactivity recency filtering...")
    // Last visit was 45 days ago.
    // Filter: inactive since 30 days -> Client should be included (last appointment 45 days ago > 30 days ago)
    // Filter: inactive since 60 days -> Client should be excluded (last appointment 45 days ago is NOT > 60 days ago)
    const inactive30Filters = { inactiveDays: "30" }
    const inactive60Filters = { inactiveDays: "60" }

    const inactive30 = await getSegmentedClients(inactive30Filters)
    const inactive60 = await getSegmentedClients(inactive60Filters)

    const hasClientInactive30 = inactive30.some(c => c.id === client.id)
    const hasClientInactive60 = inactive60.some(c => c.id === client.id)

    log.push(`Inactive 30+ days count: ${inactive30.length}, contains test client: ${hasClientInactive30} (Expected: true)`)
    log.push(`Inactive 60+ days count: ${inactive60.length}, contains test client: ${hasClientInactive60} (Expected: false)`)

    if (!hasClientInactive30 || hasClientInactive60) {
      throw new Error("Inactivity recency filtering failed. Client mis-segmented.")
    }

    // 5. Test Campaign Creation and Count Live Update
    log.push("TC5: Testing campaign creation and live reach counts...")
    const campaignFilters = { petSpecies: "dog", inactiveDays: "30", minSpend: "1000" }
    const expectedReach = await getSegmentedClientsCount(campaignFilters)
    log.push(`Segment reach size returned: ${expectedReach} client(s)`)

    const campaign = await createCampaign({
      name: "Monsoon Test Campaign",
      message: "Hi {name}, is {pet_name} ready for a spa session?",
      mediaUrl: "https://example.com/test-flyer.jpg",
      segmentFilters: campaignFilters
    })
    testCampaignId = campaign.id
    log.push(`Campaign draft successfully created with ID: ${campaign.id}, status: ${campaign.status}`)

    if (campaign.status !== 'Draft' || campaign.name !== "Monsoon Test Campaign" || campaign.mediaUrl !== "https://example.com/test-flyer.jpg") {
      throw new Error("Campaign database insertion returned incorrect values.")
    }

    log.push("TC6: Performing clean up of test records...")
    // Cleanup will run in finally block
    
    return NextResponse.json({
      success: true,
      log,
      message: "All campaign and segmentation tests passed successfully!"
    })

  } catch (error: any) {
    log.push(`Error occurred during testing: ${error.message || String(error)}`)
    return NextResponse.json({
      success: false,
      log,
      error: error.message || String(error)
    }, { status: 500 })

  } finally {
    // Cleanup DB records to avoid polluting the development DB
    if (testAppointmentId) {
      await prisma.appointment.delete({ where: { id: testAppointmentId } }).catch(() => {})
    }
    if (testPetId) {
      await prisma.pet.delete({ where: { id: testPetId } }).catch(() => {})
    }
    if (testClientId) {
      await prisma.client.delete({ where: { id: testClientId } }).catch(() => {})
    }
    if (testCampaignId) {
      await prisma.campaign.delete({ where: { id: testCampaignId } }).catch(() => {})
    }
    log.push("Database cleanup complete.")
  }
}
