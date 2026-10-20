import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins } from './config/env';
import { apiRouter } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { openApiDocument } from './docs/openapi';

export function createApp() {
  const app = express();

  // Render ושירותי ענן אחרים יושבים מאחורי Proxy
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // מאפשר להציג את התמונות מהשרת גם באתר React שרץ בכתובת אחרת
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: corsOrigins === '*' ? '*' : corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/', (_req, res) => {
    res.json({ name: 'BorrowBoard API', docs: '/api-docs', health: '/api/health' });
  });

  // תיעוד Swagger
  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'BorrowBoard API',
      swaggerOptions: { persistAuthorization: true },
    }),
  );

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
