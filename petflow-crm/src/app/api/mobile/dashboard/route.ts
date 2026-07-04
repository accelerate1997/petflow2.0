import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLocalDateString } from "@/lib/dateUtils";

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.headers.get("x-tenant-id") || req.nextUrl.searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Missing tenantId" },
        { status: 400 }
      );
    }

    const todayStr = getLocalDateString(new Date());
    const vanId = req.nextUrl.searchParams.get("vanId") || undefined;

    // Fetch all appointments for today under this tenant
    const appointmentsToday = await prisma.appointment.findMany({
      where: {
        tenantId,
        appointment_date: todayStr,
        ...(vanId ? { van_id: vanId } : {}),
      },
      include: {
        pet: {
          include: {
            owner: true,
          },
        },
      },
      orderBy: {
        appointment_time: 'asc',
      },
    });

    // Calculate metrics
    const totalAppointmentsCount = appointmentsToday.length;
    
    const completedAppointments = appointmentsToday.filter(
      (a) => a.status === "Done" || a.status === "CheckedOut"
    );
    const groomedPetsCount = completedAppointments.length;

    const revenueGenerated = completedAppointments.reduce(
      (sum, a) => sum + (a.price || 0),
      0
    );

    // Filter upcoming active appointments (excluding completed or cancelled)
    const upcomingAppointments = appointmentsToday.filter(
      (a) => a.status !== "Done" && a.status !== "CheckedOut" && a.status !== "Cancelled"
    );

    // Return the payload format expected by the mobile client
    return NextResponse.json(
      {
        appointmentsToday: totalAppointmentsCount,
        groomedPetsCount,
        revenueGenerated,
        upcomingAppointments,
      },
      {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id, Authorization',
        },
      }
    );
  } catch (error: any) {
    console.error("Mobile Dashboard API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-tenant-id, Authorization',
    },
  });
}
