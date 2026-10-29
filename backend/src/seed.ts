import 'dotenv/config';
import { prisma, prismaRoot } from './lib/prisma';
import { hashPassword } from './auth/password';
import { getSettings, updateSettings } from './services/settings.service';
import { ensureDefaultTemplates } from './services/template.service';
import { runWithCompany } from './lib/company-context';
import { seedExpenseCatalog } from './seeds/seed-expense-catalog';

async function main() {
  // This script wipes every table. Never let it run against production by accident;
  // use `npm run db:seed:expenses` there to (re)load the expense catalog only.
  if (process.env.LEGERCRM_NODE_ENV === 'production' && process.env.LEGERCRM_ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error('Refusing to wipe a production database. Set LEGERCRM_ALLOW_DESTRUCTIVE_SEED=true to override.');
  }

  console.log('🌱 Starting clean PostgreSQL database reset and production-ready seed...');

  // 1. Purge ALL database tables cleanly across all companies
  console.log('🧹 Purging all existing database records...');
  await prismaRoot.notificationLog.deleteMany().catch(() => {});
  await prismaRoot.auditLog.deleteMany().catch(() => {});
  await prismaRoot.invoiceRevision.deleteMany().catch(() => {});
  await prismaRoot.reminder.deleteMany().catch(() => {});
  await prismaRoot.alert.deleteMany().catch(() => {});
  await prismaRoot.stockMovement.deleteMany().catch(() => {});
  await prismaRoot.payment.deleteMany().catch(() => {});
  await prismaRoot.invoiceLineItem.deleteMany().catch(() => {});
  await prismaRoot.invoice.deleteMany().catch(() => {});
  await prismaRoot.recurringInvoice.deleteMany().catch(() => {});
  await prismaRoot.inventoryItem.deleteMany().catch(() => {});
  await prismaRoot.productService.deleteMany().catch(() => {});
  await prismaRoot.clientContact.deleteMany().catch(() => {});
  await prismaRoot.client.deleteMany().catch(() => {});
  await prismaRoot.expense.deleteMany().catch(() => {});
  await prismaRoot.expenseItem.deleteMany().catch(() => {});
  await prismaRoot.expenseCategory.deleteMany().catch(() => {});
  await prismaRoot.taxRate.deleteMany().catch(() => {});
  await prismaRoot.messageTemplate.deleteMany().catch(() => {});
  await prismaRoot.companySettings.deleteMany().catch(() => {});
  await prismaRoot.numberSequence.deleteMany().catch(() => {});
  await prismaRoot.passwordResetToken.deleteMany().catch(() => {});
  await prismaRoot.user.deleteMany().catch(() => {});
  await prismaRoot.company.deleteMany().catch(() => {});

  // 2. Create the two primary companies: Brand It & Stoic
  console.log('🏢 Creating companies: Brand It & Stoic...');
  const brandIt = await prismaRoot.company.create({
    data: {
      slug: 'brand-it',
      name: 'Brand It Company',
      isActive: true,
    },
  });

  const stoic = await prismaRoot.company.create({
    data: {
      slug: 'stoic',
      name: 'Stoic Company',
      isActive: true,
    },
  });

  // =========================================================================
  // 3. INITIALIZE BRAND IT COMPANY
  // =========================================================================
  await runWithCompany(brandIt.id, async () => {
    console.log('\n--- Initializing Brand It Company ---');

    // Settings
    console.log('⚙️ Initializing Brand It settings & templates...');
    await getSettings();
    await updateSettings({
      companyName: 'Brand It Company',
      currency: 'GHS',
      invoicePrefix: 'INV-',
      receiptPrefix: 'RCT-',
      quotationPrefix: 'QT-',
      defaultPaymentTermsDays: 14,
      allowNegativeStock: false,
      address: 'Plot 12, Industrial Area, Accra, Ghana',
      phone: '+233 30 222 1100',
      email: 'contact@brand-it.com',
      taxId: 'GH-TIN-BR001',
      notifyInvoiceSentEmail: false,
      notifyInvoiceSentSms: false,
      notifyPaymentEmail: false,
      notifyPaymentSms: false,
      notifyRemindersEmail: false,
      notifyRemindersSms: false,
    });
    await ensureDefaultTemplates();

    // Tax Rates
    console.log('📊 Creating Brand It tax rates...');
    await prisma.taxRate.createMany({
      data: [
        { name: 'Standard VAT', rate: 15.0, isDefault: true, isActive: true },
        { name: 'NHIL / GETFund Levy', rate: 5.0, isDefault: false, isActive: true },
      ],
    });

    // Admin & Staff users
    console.log('👤 Provisioning Brand It Admin and Staff...');
    await prisma.user.create({
      data: {
        email: 'admin@brand-it.com',
        name: 'Brand It Admin',
        role: 'admin',
        passwordHash: hashPassword('Admin!2026'),
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'staff@brand-it.com',
        name: 'Brand It Staff',
        role: 'staff',
        passwordHash: hashPassword('Staff!2026'),
        isActive: true,
      },
    });
  });

  // =========================================================================
  // 4. INITIALIZE STOIC COMPANY
  // =========================================================================
  await runWithCompany(stoic.id, async () => {
    console.log('\n--- Initializing Stoic Company ---');

    // Settings
    console.log('⚙️ Initializing Stoic settings & templates...');
    await getSettings();
    await updateSettings({
      companyName: 'Stoic Company',
      currency: 'USD',
      invoicePrefix: 'STK-INV-',
      receiptPrefix: 'STK-RCT-',
      quotationPrefix: 'STK-QT-',
      defaultPaymentTermsDays: 30,
      allowNegativeStock: false,
      address: '742 Evergreen Terrace, Suite 400, New York, NY 10001',
      phone: '+1 212 555 0199',
      email: 'billing@stoic.com',
      taxId: 'US-EIN-99887766',
      notifyInvoiceSentEmail: false,
      notifyInvoiceSentSms: false,
      notifyPaymentEmail: false,
      notifyPaymentSms: false,
      notifyRemindersEmail: false,
      notifyRemindersSms: false,
    });
    await ensureDefaultTemplates();

    // Tax Rates
    console.log('📊 Creating Stoic tax rates...');
    await prisma.taxRate.createMany({
      data: [
        { name: 'US Standard Sales Tax', rate: 8.875, isDefault: true, isActive: true },
        { name: 'State Surcharge', rate: 1.5, isDefault: false, isActive: true },
      ],
    });

    // Admin & Staff users
    console.log('👤 Provisioning Stoic Admin and Staff...');
    await prisma.user.create({
      data: {
        email: 'admin@stoic.com',
        name: 'Stoic Admin',
        role: 'admin',
        passwordHash: hashPassword('Admin!2026'),
        isActive: true,
      },
    });

    await prisma.user.create({
      data: {
        email: 'staff@stoic.com',
        name: 'Stoic Staff',
        role: 'staff',
        passwordHash: hashPassword('Staff!2026'),
        isActive: true,
      },
    });
  });

  // =========================================================================
  // 5. SEED SHARED EXPENSE SCHEDULE CATALOG (FROM EXCEL)
  // =========================================================================
  await seedExpenseCatalog();

  console.log('\n======================================================');
  console.log('✅ Clean production database seeded successfully!');
  console.log('======================================================');
  console.log('🏢 Brand It Company (slug: brand-it):');
  console.log('   Admin: admin@brand-it.com / Admin!2026 (Brand It Admin)');
  console.log('   Staff: staff@brand-it.com / Staff!2026 (Brand It Staff)');
  console.log('   Data:  Clean (No dummy clients, invoices, products, or transactions)');
  console.log('------------------------------------------------------');
  console.log('🏢 Stoic Company (slug: stoic):');
  console.log('   Admin: admin@stoic.com / Admin!2026 (Stoic Admin)');
  console.log('   Staff: staff@stoic.com / Staff!2026 (Stoic Staff)');
  console.log('   Data:  Clean (No dummy clients, invoices, products, or transactions)');
  console.log('------------------------------------------------------');
  console.log('📦 Shared Expense Catalog: Standard categories & items available for both companies.');
  console.log('======================================================');
}

main()
  .catch((err) => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prismaRoot.$disconnect();
  });
