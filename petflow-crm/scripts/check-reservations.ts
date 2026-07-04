import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Fetching all Boarding Reservations...");
  const reservations = await prisma.boardingReservation.findMany({
    include: {
      pet: {
        include: {
          owner: true,
        },
      },
      room: true,
    },
  });

  console.log(`📋 Found ${reservations.length} reservations:\n`);
  for (const res of reservations) {
    console.log(`Reservation ID: ${res.id}`);
    console.log(`Pet: ${res.pet.pet_name} (Owner: ${res.pet.owner.name})`);
    console.log(`Phone: ${res.pet.owner.whatsapp_number}`);
    console.log(`Room: ${res.room.name}`);
    console.log(`Check-in: ${res.check_in_date}`);
    console.log(`Check-out: ${res.check_out_date}`);
    console.log(`Status: ${res.status}`);
    console.log(`Created At: ${res.created}`);
    console.log("-----------------------------------------");
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
