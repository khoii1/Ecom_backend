import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const { Pool } = pg;

export const databasePool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
});
