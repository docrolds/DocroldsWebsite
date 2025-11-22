const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

module.exports = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      adapter: new PrismaPg(
        new Pool({
          connectionString: process.env.DATABASE_URL,
        })
      ),
    },
  },
};
