import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

/**
 * לפני כל הרצת בדיקות: מוחק את מסד הבדיקות ובונה אותו מחדש
 * מתוך קובצי המיגרציה (prisma/migrations/*\/migration.sql).
 * כך הבדיקות בודקות גם שהמיגרציות עצמן תקינות.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL חסר');
  if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL חייב להיות שונה מ-DATABASE_URL - הבדיקות מוחקות את כל הנתונים!');

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
    const dir = path.join(__dirname, '..', 'prisma', 'migrations');
    const migrations = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const name of migrations) {
      const sql = fs.readFileSync(path.join(dir, name, 'migration.sql'), 'utf8');
      await client.query(sql);
    }
  } finally {
    await client.end();
  }
}
