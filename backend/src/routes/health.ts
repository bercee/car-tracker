import { Router } from 'express';

export type HealthCheck = () => Promise<void>;

export function createHealthRouter(checkHealth: HealthCheck): Router {
  const router = Router();

  router.get('/', async (_request, response) => {
    try {
      await checkHealth();
      response.status(200).json({ status: 'ok' });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });

  return router;
}
