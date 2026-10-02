#!/usr/bin/env node
/**
 * Apply pending SQL migrations from server/migrations in filename order.
 *
 * Creates the database if it doesn't exist. Applied migrations are recorded
 * in the schema_migrations table, so each file runs once. A database created
 * before this table existed (tables already present) gets 001_init_schema
 * marked as applied instead of run.
 *
 * Usage:
 *   npm run db:migrate            apply pending migrations
 *   npm run db:migrate -- --dry   only list pending migrations
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { dbConfig } from './db-config.mjs'

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../server/migrations')
const BASELINE = '001_init_schema'
const dryRun = process.argv.includes('--dry')

const { database, ...server } = dbConfig
let connection

try {
  connection = await mysql.createConnection({ ...server, multipleStatements: true })
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  )
  await connection.changeUser({ database })

  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [appliedRows] = await connection.query('SELECT version FROM schema_migrations')
  const applied = new Set(appliedRows.map(r => r.version))

  // Existing database from before migrations were tracked
  if (applied.size === 0) {
    const [tables] = await connection.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'companies'`
    )
    if (tables.length > 0) {
      console.log(`ℹ️  Existing schema found, marking ${BASELINE} as applied`)
      if (!dryRun) await connection.query('INSERT INTO schema_migrations (version) VALUES (?)', [BASELINE])
      applied.add(BASELINE)
    }
  }

  const files = (await fs.readdir(MIGRATIONS_DIR)).filter(f => f.endsWith('.sql')).sort()
  const pending = files.filter(f => !applied.has(path.basename(f, '.sql')))

  if (pending.length === 0) {
    console.log(`✅ ${database} is up to date (${applied.size} migrations applied)`)
  }

  for (const file of pending) {
    const version = path.basename(file, '.sql')
    if (dryRun) {
      console.log(`⏳ pending: ${version}`)
      continue
    }

    console.log(`▶️  ${version}`)
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8')
    // MySQL commits DDL implicitly, so a failed migration must be fixed by hand
    await connection.query(sql)
    await connection.query('INSERT INTO schema_migrations (version) VALUES (?)', [version])
    console.log(`✅ ${version}`)
  }
} catch (error) {
  console.error('❌ Migration failed:', error.message)
  process.exitCode = 1
} finally {
  await connection?.end()
}
