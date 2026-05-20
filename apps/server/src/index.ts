import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './env.js';
import { qfRouter } from './routes/qf.js';
import { qfAuthRouter, qfCallbackRouter } from './routes/qfAuth.js';
import { qfUserRouter } from './routes/qfUser.js';
import { onboardingRouter } from './routes/onboarding.js';
import { testsRouter } from './routes/tests.js';

const app = express();

app.use(
  cors({
    origin: env.webOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'tahfeedh-server' });
});

app.use('/api/qf', qfRouter);
app.use('/api/qf-auth', qfAuthRouter);
app.use('/auth/qf', qfCallbackRouter);
app.use('/api/qf-user', qfUserRouter);
app.use('/api/onboarding', onboardingRouter);
app.use('/api/tests', testsRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server error]', err);
  res.status(500).json({ error: err.message });
});

app.listen(env.port, () => {
  console.log(`tahfeedh server listening on http://localhost:${env.port}`);
});
