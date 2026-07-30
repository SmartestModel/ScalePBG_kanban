import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createRepositoryFactory } from './repositories/factory';
import { buildAuthRouter } from './routers/authRouter';
import { buildOrgRouter } from './routers/orgRouter';
import { buildAccessRequestRouter } from './routers/accessRequestRouter';
import { buildProjectRouter } from './routers/projectRouter';
import { buildSprintRouter } from './routers/sprintRouter';
import { buildTaskRouter } from './routers/taskRouter';
import { buildStoryRouter } from './routers/storyRouter';

dotenv.config();

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const isMock = process.env.USE_MOCK === 'true';

if (!isMock) {
  // Only initialise Firebase Admin when using real Firestore
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { initFirebaseAdmin } = require('./firebase/admin') as {
    initFirebaseAdmin: () => void;
  };
  initFirebaseAdmin();
}

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
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path}`
    );
    next();
  });
}

// ── Health Check ──────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    mode: isMock ? 'mock' : 'firebase',
    timestamp: new Date().toISOString(),
  });
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

// Project & epic routes
const projectRouter = buildProjectRouter(
  factory.getOrgRepository(),
  factory.getProjectRepository()
);
api.use('/', projectRouter);

api.use(
  '/',
  buildSprintRouter(
    factory.getSprintRepository(),
    factory.getOrgRepository(),
    factory.getProjectRepository(),
    factory.getTaskRepository()
  )
);

api.use(
  '/tasks',
  buildTaskRouter(
    factory.getTaskRepository(),
    factory.getCommentRepository(),
    factory.getOrgRepository(),
    factory.getProjectRepository()
  )
);

api.use(
  '/',
  buildStoryRouter(
    factory.getStoryRepository(),
    factory.getProjectRepository(),
    factory.getOrgRepository()
  )
);

app.use('/api/v1', api);
app.use('/api', api);

// ── Global Error Handler ──────────────────────────────────────────────────────

app.use(
  (
    err: Error & { code?: number; errorCode?: string },
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
  console.log(
    `[Server] API base: http://localhost:${PORT}/api/v1`
  );
  if (isMock) {
    console.log(
      '[Server] ⚠️  MOCK MODE — all data is in-memory only.'
    );
  }
});

export default app;
