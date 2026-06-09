import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateGroomerAvailability } from '@/lib/actions'

export async function GET() {
  const log: string[] = []
  
  try {
    log.push("Starting conflict verification tests...")

    // 1. Ensure test groomer exists
    let groomer = await prisma.staff.findFirst({
      where: { name: "Test Groomer Alex" }
    })
    if (!groomer) {
      groomer = await prisma.staff.create({
        data: {
          name: "Test Groomer Alex",
          role: "Groomer",
          status: "Active",
          email: "alex.test@petflow.com",
          phone: "919999999999"
        }
      })
      log.push(`Created test groomer: ${groomer.name}`)
    } else {
      log.push(`Found existing test groomer: ${groomer.name}`)
    }

    // 2. Ensure test pet exists
    let owner = await prisma.client.findFirst({ where: { name: "Test Owner" } })
    if (!owner) {
      owner = await prisma.client.create({
        data: {
          name: "Test Owner",
          whatsapp_number: "919999999999",
          email: "owner@test.com"
        }
      })
    }
    let pet = await prisma.pet.findFirst({ where: { pet_name: "Test Doggy" } })
    if (!pet) {
      pet = await prisma.pet.create({
        data: {
          pet_name: "Test Doggy",
          species: "dog",
          breed: "Golden Retriever",
          owner_id: owner.id
        }
      })
      log.push(`Created test pet: ${pet.pet_name}`)
    }

    // 3. Ensure test services exist with estimated durations
    // Delete them first to ensure clean state
    await prisma.service.deleteMany({
      where: { service_name: { in: ["Test Bath (30m)", "Test Groom (60m)"] } }
    })

    const service30 = await prisma.service.create({
      data: {
        service_name: "Test Bath (30m)",
        price: 500,
        estimated_duration: 30,
        pet_type: "dog",
        thumbnail: "🛁"
      }
    })
    log.push(`Created service: ${service30.service_name} with duration ${service30.estimated_duration}m`)

    const service60 = await prisma.service.create({
      data: {
        service_name: "Test Groom (60m)",
        price: 1000,
        estimated_duration: 60,
        pet_type: "dog",
        thumbnail: "✂️"
      }
    })
    log.push(`Created service: ${service60.service_name} with duration ${service60.estimated_duration}m`)

    // 4. Clean up any existing test appointments on the test date
    const testDate = "2026-09-01"
    await prisma.appointment.deleteMany({
      where: {
        appointment_date: testDate,
        pet_id: pet.id
      }
    })
    log.push(`Cleared appointments for pet on ${testDate}`)

    // 5. Test Case 1: Book Test Bath (30m) at 10:00. Should SUCCEED.
    log.push("TC1: Booking 'Test Bath (30m)' at 10:00...")
    const check1 = await validateGroomerAvailability(null, testDate, "10:00", "Test Bath (30m)", groomer.id)
    if (!check1.success) {
      throw new Error(`TC1 failed: ${check1.error}`)
    }
    const appt1 = await prisma.appointment.create({
      data: {
        pet_id: pet.id,
        service_type: "Test Bath (30m)",
        appointment_date: testDate,
        appointment_time: "10:00",
        status: "Booked",
        groomer_id: groomer.id
      }
    })
    log.push(`TC1 PASSED: Booked appointment ${appt1.id} at 10:00`)

    // 6. Test Case 2: Book Test Groom (60m) at 10:15 (Overlaps with 10:00-10:30). Should FAIL.
    log.push("TC2: Booking 'Test Groom (60m)' at 10:15...")
    const check2 = await validateGroomerAvailability(null, testDate, "10:15", "Test Groom (60m)", groomer.id)
    if (check2.success) {
      throw new Error("TC2 failed: Overlapping appointment was allowed!")
    }
    log.push(`TC2 PASSED: Overlap correctly rejected: "${check2.error}"`)

    // 7. Test Case 3: Book Test Groom (60m) at 09:30 (Ends at 10:30, overlaps 10:00-10:30). Should FAIL.
    log.push("TC3: Booking 'Test Groom (60m)' at 09:30...")
    const check3 = await validateGroomerAvailability(null, testDate, "09:30", "Test Groom (60m)", groomer.id)
    if (check3.success) {
      throw new Error("TC3 failed: Overlapping appointment was allowed!")
    }
    log.push(`TC3 PASSED: Overlap correctly rejected: "${check3.error}"`)

    // 8. Test Case 4: Book Test Groom (60m) at 10:30 (Starts exactly when Bath ends). Should SUCCEED.
    log.push("TC4: Booking 'Test Groom (60m)' at 10:30...")
    const check4 = await validateGroomerAvailability(null, testDate, "10:30", "Test Groom (60m)", groomer.id)
    if (!check4.success) {
      throw new Error(`TC4 failed: ${check4.error}`)
    }
    log.push("TC4 PASSED: Gap-free back-to-back booking allowed")

    // 9. Test Case 5: Book Test Groom (60m) at 09:00 (Ends exactly when Bath starts). Should SUCCEED.
    log.push("TC5: Booking 'Test Groom (60m)' at 09:00...")
    const check5 = await validateGroomerAvailability(null, testDate, "09:00", "Test Groom (60m)", groomer.id)
    if (!check5.success) {
      throw new Error(`TC5 failed: ${check5.error}`)
    }
    log.push("TC5 PASSED: Prior back-to-back booking allowed")

    // 10. Ensure second test groomer exists
    let groomer2 = await prisma.staff.findFirst({
      where: { name: "Test Groomer Ben" }
    })
    if (!groomer2) {
      groomer2 = await prisma.staff.create({
        data: {
          name: "Test Groomer Ben",
          role: "Groomer",
          status: "Active",
          email: "ben.test@petflow.com",
          phone: "918888888888"
        }
      })
      log.push(`Created second test groomer: ${groomer2.name}`)
    } else {
      log.push(`Found existing second test groomer: ${groomer2.name}`)
    }

    // 11. Test Case 6: Book Test Bath (30m) at 11:00 with NO groomer. Should auto-assign to Alex or Ben.
    log.push("TC6: Booking 'Test Bath (30m)' at 11:00 (Auto-Assign)...")
    const check6 = await validateGroomerAvailability(null, testDate, "11:00", "Test Bath (30m)", null)
    if (!check6.success || !check6.groomerId) {
      throw new Error(`TC6 failed: Auto-assign failed. Error: ${check6.error}`)
    }
    const appt6 = await prisma.appointment.create({
      data: {
        pet_id: pet.id,
        service_type: "Test Bath (30m)",
        appointment_date: testDate,
        appointment_time: "11:00",
        status: "Booked",
        groomer_id: check6.groomerId
      }
    })
    log.push(`TC6 PASSED: Auto-assigned to groomer ID: ${check6.groomerId}`)

    // 12. Test Case 7: Book another Test Bath (30m) at 11:00 with NO groomer. Should auto-assign to the other groomer.
    log.push("TC7: Booking another 'Test Bath (30m)' at 11:00 (Auto-Assign)...")
    const check7 = await validateGroomerAvailability(null, testDate, "11:00", "Test Bath (30m)", null)
    if (!check7.success || !check7.groomerId) {
      throw new Error(`TC7 failed: Auto-assign failed for second concurrent booking. Error: ${check7.error}`)
    }
    if (check7.groomerId === check6.groomerId) {
      throw new Error(`TC7 failed: Double-booked the same groomer! ${check7.groomerId}`)
    }
    const appt7 = await prisma.appointment.create({
      data: {
        pet_id: pet.id,
        service_type: "Test Bath (30m)",
        appointment_date: testDate,
        appointment_time: "11:00",
        status: "Booked",
        groomer_id: check7.groomerId
      }
    })
    log.push(`TC7 PASSED: Auto-assigned concurrent booking to groomer ID: ${check7.groomerId}`)

    // 13. Test Case 8: Book a THIRD Test Bath (30m) at 11:00 with NO groomer. Should FAIL because both Alex and Ben are booked.
    log.push("TC8: Booking a third 'Test Bath (30m)' at 11:00 (Auto-Assign)...")
    const check8 = await validateGroomerAvailability(null, testDate, "11:00", "Test Bath (30m)", null)
    if (check8.success) {
      throw new Error("TC8 failed: Allowed third concurrent booking when only 2 groomers are active!")
    }
    log.push(`TC8 PASSED: Correctly rejected with error: "${check8.error}"`)

    // 14. Test Case 9: Working Hours Off-Day. Set Alex's Tuesday to is_working: false. Try to book Alex. Should FAIL.
    log.push("TC9: Setting Alex's Tuesday as non-working day and testing booking...")
    await prisma.staff.update({
      where: { id: groomer.id },
      data: {
        working_hours: {
          tuesday: { is_working: false }
        }
      }
    })
    const check9 = await validateGroomerAvailability(null, testDate, "10:00", "Test Bath (30m)", groomer.id)
    if (check9.success) {
      throw new Error("TC9 failed: Booked groomer on their off-day!")
    }
    log.push(`TC9 PASSED: Booking correctly blocked for off-day: "${check9.error}"`)

    // 15. Test Case 10: Working Hours Shift Limit. Set Alex's Tuesday to is_working: true, start: 10:00, end: 14:00.
    // Try to book Alex at 09:00 (ends at 09:30). Should FAIL.
    log.push("TC10: Setting Alex's Tuesday shift to 10:00 - 14:00. Booking at 09:00...")
    await prisma.staff.update({
      where: { id: groomer.id },
      data: {
        working_hours: {
          tuesday: { is_working: true, start: "10:00", end: "14:00" }
        }
      }
    })
    const check10 = await validateGroomerAvailability(null, testDate, "09:00", "Test Bath (30m)", groomer.id)
    if (check10.success) {
      throw new Error("TC10 failed: Booked groomer outside shift hours (before shift)!")
    }
    log.push(`TC10 PASSED: Booking outside shift hours correctly blocked: "${check10.error}"`)

    // 16. Test Case 11: Working Hours Shift Limit (After Shift). Try to book Alex at 14:00 (ends 14:30). Should FAIL.
    log.push("TC11: Booking Alex at 14:00 (outside shift end)...")
    const check11 = await validateGroomerAvailability(null, testDate, "14:00", "Test Bath (30m)", groomer.id)
    if (check11.success) {
      throw new Error("TC11 failed: Booked groomer outside shift hours (after shift)!")
    }
    log.push(`TC11 PASSED: Booking after shift end correctly blocked: "${check11.error}"`)

    // 17. Test Case 12: Working Hours Valid Shift. Try to book Alex at 10:30 (ends 11:00). Should SUCCEED.
    log.push("TC12: Booking Alex at 10:30 (within shift)...")
    const check12 = await validateGroomerAvailability(null, testDate, "10:30", "Test Bath (30m)", groomer.id)
    if (!check12.success) {
      throw new Error(`TC12 failed: Valid shift booking blocked! Error: ${check12.error}`)
    }
    log.push("TC12 PASSED: Booking within shift hours allowed")

    // Reset Alex's working hours
    await prisma.staff.update({
      where: { id: groomer.id },
      data: { working_hours: {} }
    })

    // 18. Clean up test data
    await prisma.appointment.deleteMany({
      where: {
        appointment_date: testDate,
        pet_id: pet.id
      }
    })
    await prisma.service.deleteMany({
      where: { service_name: { in: ["Test Bath (30m)", "Test Groom (60m)"] } }
    })
    log.push("Test data successfully cleaned up")
    log.push("ALL TESTS PASSED SUCCESSFULLY! 🎉")

    return NextResponse.json({ success: true, log })
  } catch (error: any) {
    log.push(`ERROR: ${error.message}`)
    return NextResponse.json({ success: false, log, error: error.message }, { status: 400 })
  }
}
