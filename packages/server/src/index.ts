import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initFirebaseAdmin } from './firebase/admin';
import { createRepositoryFactory } from './repositories/factory';
import { buildAuthRouter } from './routers/authRouter';
import { buildOrgRouter } from './routers/orgRouter';
import { buildAccessRequestRouter } from './routers/accessRequestRouter';
import { buildProjectRouter } from './routers/projectRouter';
import { buildSprintRouter } from './routers/sprintRouter';
import { buildTaskRouter } from './routers/taskRouter';

dotenv.config();

// ── Bootstrap ─────────────────────────────────────────────────────────────────

initFirebaseAdmin();
const factory = createRepositoryFactory();

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Health Check ──────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────────────────────

const api = express.Router();

api.use(
  '/auth',
  buildAuthRouter(
    factory.getUserRepository(),
    factory.getOrgRepository()
  )
);

api.use(
  '/orgs',
  buildOrgRouter(
    factory.getOrgRepository(),
    factory.getAccessRequestRepository()
  )
);

api.use(
  '/access-requests',
  buildAccessRequestRouter(
    factory.getAccessRequestRepository(),
    factory.getOrgRepository()
  )
);

// Project & epic routes (both /orgs/:orgId/projects and /projects/:projectId)
const projectRouter = buildProjectRouter(factory.getOrgRepository());
api.use('/', projectRouter);

api.use(
  '/',
  buildSprintRouter(
    factory.getSprintRepository(),
    factory.getOrgRepository()
  )
);

api.use(
  '/tasks',
  buildTaskRouter(
    factory.getTaskRepository(),
    factory.getCommentRepository(),
    factory.getOrgRepository()
  )
);

app.use('/api/v1', api);
app.use('/api', api);

// ── Global Error Handler ──────────────────────────────────────────────────────

app.use(
  (err: Error & { code?: number; errorCode?: string },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const statusCode =
      typeof err.code === 'number' ? err.code : 500;
    console.error(`[ERROR] ${err.message}`, err.stack);
    res.status(statusCode).json({
      success: false,
      error: {
        code: err.errorCode ?? 'INTERNAL_ERROR',
        message: err.message ?? 'An unexpected error occurred.',
      },
      timestamp: new Date().toISOString(),
    });
  }
);

// ── Start Server ──────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);
app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] API base: http://localhost:${PORT}/api/v1`);
});

export default app;
