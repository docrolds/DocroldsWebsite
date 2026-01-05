const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.content.create({
    data: {
      key: 'hero',
      value: {
        title: 'The Journey to Professional Sound Starts with a Dream',
        tagline: 'Dreams Over Careers',
        description: 'Professional recording studio and mixing services for artists who are serious about their craft. Book your session today and bring your music to life.',
        imageUrl: ''
      }
    }
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });