import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './db/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`✅ BorrowBoard API פועל על פורט ${env.PORT}`);
  console.log(`📘 Swagger: http://localhost:${env.PORT}/api-docs`);
});

// סגירה מסודרת כשהשירות נעצר
async function shutdown(signal: string) {
  console.log(`${signal} התקבל, סוגר את השרת...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
