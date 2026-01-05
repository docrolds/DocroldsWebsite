const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const fs = require('fs');
const sharp = require('sharp');
const path = require('path');
require('dotenv').config();

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString: process.env.DATABASE_URL,
    })
  ),
});

async function processPhotoToBase64(imagePath, width = 500, height = 500, quality = 80) {
    try {
        if (!fs.existsSync(imagePath)) {
            console.log(`File not found: ${imagePath}`);
            return null;
        }

        const buffer = fs.readFileSync(imagePath);
        const processedBuffer = await sharp(buffer)
            .resize(width, height, {
                fit: 'cover',
                position: 'center'
            })
            .webp({ quality })
            .toBuffer();
        
        return `data:image/webp;base64,${processedBuffer.toString('base64')}`;
    } catch (error) {
        console.error(`Error processing ${imagePath}:`, error.message);
        return null;
    }
}

async function migratePhotos() {
    try {
        console.log('Starting photo migration...');
        
        // Get all photos with photoFile paths
        const photos = await prisma.photo.findMany({
            where: {
                photoFile: {
                    not: null
                },
                photoData: null
            }
        });

        console.log(`Found ${photos.length} photos to migrate`);

        for (const photo of photos) {
            console.log(`Migrating photo ID ${photo.id}: ${photo.name}`);
            
            // Construct the full path to the photo file
            const photoPath = path.join(__dirname, photo.photoFile);
            
            // Process the photo to base64
            const photoData = await processPhotoToBase64(photoPath);
            
            if (photoData) {
                // Update the photo record
                await prisma.photo.update({
                    where: { id: photo.id },
                    data: {
                        photoData,
                        mimeType: 'image/webp'
                    }
                });
                console.log(`✅ Successfully migrated photo ID ${photo.id}`);
            } else {
                console.log(`❌ Failed to migrate photo ID ${photo.id}`);
            }
        }

        console.log('Photo migration completed!');
        
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migratePhotos();