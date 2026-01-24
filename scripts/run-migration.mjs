import mysql from 'mysql2/promise';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '', // No password for local MySQL
  database: 'stock_analysis_db',
  multipleStatements: true // Enable multiple statements query
};

async function runMigration() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected.');

    const migrationFile = path.resolve(__dirname, '../server/migrations/001_init_schema.sql');
    console.log(`Reading migration file: ${migrationFile}`);

    const sql = await fs.readFile(migrationFile, 'utf8');

    console.log('Executing migration...');
    await connection.query(sql);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();
