// יוצר את הקובץ docs/openapi.json מתוך src/docs/openapi.ts
// הרצה: npm run openapi
import fs from 'node:fs';
import path from 'node:path';
import { openApiDocument } from '../src/docs/openapi';

const out = path.join(__dirname, '..', 'docs', 'openapi.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(openApiDocument, null, 2) + '\n', 'utf8');
console.log(`✅ נוצר ${path.relative(process.cwd(), out)}`);
