import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

import authRouter from './modules/auth/auth.routes';
import clientsRouter from './routes/clients.routes';
import { productsRouter, inventoryRouter, stockMovementsRouter } from './routes/catalog.routes';
import invoicesRouter, { publicInvoiceRouter } from './routes/invoices.routes';
import recurringRouter from './routes/recurring.routes';
import paymentsRouter from './routes/payments.routes';
import expensesRouter from './routes/expenses.routes';
import reportsRouter from './routes/reports.routes';
import { alertsRouter, remindersRouter, templatesRouter, notificationsRouter, arkeselWebhookRouter } from './routes/communications.routes';
import { settingsRouter, usersRouter, auditRouter, taxRatesRouter } from './routes/settings.routes';
import dashboardRouter from './routes/dashboard.routes';

import { requireAuth, requirePermission } from './auth/permissions';
import { errorHandler } from './lib/errors';
import { ensureDefaultTemplates } from './services/template.service';
import { getSettings } from './services/settings.service';
import prisma from './lib/prisma';
import { runWithCompany } from './lib/company-context';
import { startScheduler } from './jobs/scheduler';
import './services/notification.service'; // registers domain-event listeners

const app = express();
const BASE = '/api/v1';

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ---------------------------------------------------------------------------
// Health & OpenAPI (unauthenticated)
// ---------------------------------------------------------------------------
const healthHandler = (_req: express.Request, res: express.Response) =>
  res.json({ status: 'ok', app: 'LedgerFlow CRM', database: 'PostgreSQL 16', uptime: process.uptime(), timestamp: new Date().toISOString(), db: 'connected' });
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
app.get(`${BASE}/health`, healthHandler);

const openApiHandler = (_req: express.Request, res: express.Response) => {
  const openApiPath = path.join(__dirname, 'openapi.json');
  const rootOpenApiPath = path.join(__dirname, '..', 'openapi.json');
  if (fs.existsSync(openApiPath)) return res.sendFile(openApiPath);
  if (fs.existsSync(rootOpenApiPath)) return res.sendFile(rootOpenApiPath);
  res.status(404).json({ error: 'OpenAPI specification not found' });
};
app.get('/openapi.json', openApiHandler);
app.get(`${BASE}/openapi.json`, openApiHandler);

// ---------------------------------------------------------------------------
// Public routes (no auth): invoice self-service link, Arkesel delivery webhook, /auth/*
// ---------------------------------------------------------------------------
app.use(`${BASE}/auth`, authRouter);
app.use(`${BASE}/public/invoices`, publicInvoiceRouter);
app.use(`${BASE}/webhooks`, arkeselWebhookRouter);

// ---------------------------------------------------------------------------
// Authenticated application routes
// ---------------------------------------------------------------------------
app.use(BASE, requireAuth);

app.use(`${BASE}/clients`, clientsRouter);
app.use(`${BASE}/products-services`, productsRouter);
app.use(`${BASE}/inventory`, inventoryRouter);
app.use(`${BASE}/stock-movements`, stockMovementsRouter);
app.use(`${BASE}/stockmovements`, stockMovementsRouter); // legacy alias
app.use(`${BASE}/invoices`, invoicesRouter);
app.use(`${BASE}/recurring-invoices`, recurringRouter);
app.use(`${BASE}/recurringinvoices`, recurringRouter); // legacy alias
app.use(`${BASE}/payments`, paymentsRouter);
app.use(`${BASE}/expenses`, expensesRouter);
app.use(`${BASE}/reports`, reportsRouter);
app.use(`${BASE}/alerts`, alertsRouter);
app.use(`${BASE}/reminders`, remindersRouter);
app.use(`${BASE}/message-templates`, templatesRouter);
app.use(`${BASE}/notifications`, notificationsRouter);
app.use(`${BASE}/settings/company`, settingsRouter);
app.use(`${BASE}/settings/tax-rates`, taxRatesRouter);
app.use(`${BASE}/users`, requirePermission('users.manage'), usersRouter);
app.use(`${BASE}/audit-logs`, auditRouter);
app.use(`${BASE}/dashboard`, dashboardRouter);

// JSON 404 fallback for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found', path: req.originalUrl, code: 'NOT_FOUND' });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT || 5100);

function listenOnAvailablePort(port: number, attempts = 20): void {
  const server = app.listen(port);

  server.once('listening', () => {
    const address = server.address();
    const actualPort = address && typeof address !== 'string' ? address.port : port;
    console.log(`Backend running on port ${actualPort} with PostgreSQL 16`);
  });

  server.once('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && attempts > 1 && port < 65535) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is already in use, trying port ${nextPort}...`);
      listenOnAvailablePort(nextPort, attempts - 1);
      return;
    }

    console.error(`Backend could not listen on port ${port}:`, err.message);
    process.exit(1);
  });
}

if (process.env.NODE_ENV !== 'test') {
  Promise.all([
    prisma.company.upsert({ where: { slug: 'brand-it' }, create: { slug: 'brand-it', name: 'Brand It Company' }, update: { name: 'Brand It Company', isActive: true } }),
    prisma.company.upsert({ where: { slug: 'stoic' }, create: { slug: 'stoic', name: 'Stoic Company' }, update: { name: 'Stoic Company', isActive: true } }),
  ])
    .then(() => prisma.company.findMany({ where: { isActive: true } }))
    .then(async (companies) => {
      for (const company of companies) {
        await runWithCompany(company.id, async () => {
          const settings = await getSettings();
          if (settings.companyName === 'LedgerFlow CRM' || (company.slug === 'brand-it' && settings.companyName === 'LedgerFlow Solutions Ltd')) {
            await prisma.companySettings.update({ where: { companyId: company.id }, data: { companyName: company.name } });
          }
          await ensureDefaultTemplates();
        });
      }
    })
    .then(() => startScheduler())
    .catch((err) => console.error('[boot] Failed to initialize settings/templates:', err?.message || err));

  listenOnAvailablePort(PORT);
}

export { app };
export default app;
