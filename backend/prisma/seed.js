const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed hero content (upsert to avoid duplicates)
  await prisma.content.upsert({
    where: { key: 'hero' },
    update: {},
    create: {
      key: 'hero',
      value: {
        title: 'The Journey to Professional Sound Starts with a Dream',
        tagline: 'Dreams Over Careers',
        description: 'Professional recording studio and mixing services for artists who are serious about their craft. Book your session today and bring your music to life.',
        imageUrl: ''
      }
    }
  });
  console.log('Hero content seeded');

  // Create mock test customer for admin testing
  const testCustomerPassword = await bcrypt.hash('test123', 10);

  const testCustomer = await prisma.customer.upsert({
    where: { email: 'test@docrolds.com' },
    update: {},
    create: {
      email: 'test@docrolds.com',
      password: testCustomerPassword,
      firstName: 'Test',
      lastName: 'Customer',
      stageName: 'TestArtist',
      phone: '555-123-4567',
      profession: 'Rapper',
      city: 'Los Angeles',
      state: 'CA',
      isGuest: false
    }
  });
  console.log('Test customer created:', testCustomer.email);

  // Create default playlist for test customer
  await prisma.playlist.upsert({
    where: {
      id: 'test-customer-default-playlist'
    },
    update: {},
    create: {
      id: 'test-customer-default-playlist',
      customerId: testCustomer.id,
      name: 'Saved Beats',
      isDefault: true
    }
  });
  console.log('Test customer playlist created');

  // Create a second mock customer (guest who purchased)
  const guestCustomer = await prisma.customer.upsert({
    where: { email: 'guest@example.com' },
    update: {},
    create: {
      email: 'guest@example.com',
      firstName: 'Guest',
      lastName: 'Buyer',
      phone: '555-987-6543',
      isGuest: true
    }
  });
  console.log('Guest customer created:', guestCustomer.email);

  console.log('Database seeding completed!');
  console.log('\n--- Test Credentials ---');
  console.log('Test Customer Login:');
  console.log('  Email: test@docrolds.com');
  console.log('  Password: test123');
  console.log('\nAdmin Login (from .env):');
  console.log('  Username: admin');
  console.log('  Password: (check your .env file)');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });