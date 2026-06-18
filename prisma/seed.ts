import { PrismaClient, SubscriptionPlan, SubscriptionStatus, StaffRole } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  // Restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: faker.company.name(),
      address: faker.location.streetAddress(),
      billingEmail: faker.internet.email(),
    },
  });

  console.log('Restaurant:', restaurant.id);

  // Subscription
  await prisma.subscription.create({
    data: {
      restaurantId: restaurant.id,
      plan: SubscriptionPlan.monthly,
      status: SubscriptionStatus.active,
      maxBranches: 5,
      expiresAt: faker.date.future(),
    },
  });

  // Branches
  for (let i = 1; i <= 3; i++) {
    const branch = await prisma.branch.create({
      data: {
        restaurantId: restaurant.id,
        name: `Branch ${i}`,
        address: faker.location.streetAddress().substring(0, 200),
        phone: faker.phone.number().substring(0, 20),
      },
    });

    // Admin - First branch gets the development email
    if (i === 1) {
      await prisma.staffUser.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branch.id,
          name: 'Dev Admin',
          email: 'khumapokharel2076@gmail.com',
          role: StaffRole.admin,
          oauthProvider: 'google',
          isActive: true,
          // oauthId will be set on first successful Google login
        },
      });
    } else {
      // Other branches get random admin users
      await prisma.staffUser.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branch.id,
          name: faker.person.fullName(),
          email: faker.internet.email(),
          role: StaffRole.admin,
          oauthProvider: 'google',
          isActive: true,
        },
      });
    }

    // Sections
    const section = await prisma.section.create({
      data: {
        branchId: branch.id,
        name: 'Ground Floor',
      },
    });

    // Tables
    for (let t = 1; t <= 10; t++) {
      await prisma.table.create({
        data: {
          sectionId: section.id,
          branchId: branch.id,
          tableNumber: t,
          qrToken: faker.string.uuid(),
        },
      });
    }

    // Menu Category
    const category = await prisma.menuCategory.create({
      data: {
        branchId: branch.id,
        name: 'Momo',
      },
    });

    // Menu Items
    for (let m = 0; m < 8; m++) {
      await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name: faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          basePrice: faker.number.int({
            min: 120,
            max: 600,
          }),
        },
      });
    }

    // Inventory Category
    const inventoryCategory = await prisma.inventoryCategory.create({
      data: {
        branchId: branch.id,
        name: 'Vegetables',
      },
    });

    // Inventory Items
    const items = [
      'Tomato',
      'Onion',
      'Chicken',
      'Paneer',
      'Rice',
      'Oil',
      'Salt',
      'Garlic',
    ];

    for (const item of items) {
      await prisma.inventoryItem.create({
        data: {
          branchId: branch.id,
          categoryId: inventoryCategory.id,
          name: item,
          unit: 'kg',
          quantity: faker.number.float({
            min: 10,
            max: 200,
            fractionDigits: 2,
          }),
          lowStockThreshold: 10,
        },
      });
    }
  }

  console.log('✅ Database Seeded');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());