import 'dotenv/config';
import { prisma, prismaRoot } from './lib/prisma';
import { hashPassword } from './auth/password';
import { invoiceService } from './services/invoice.service';
import { paymentService } from './services/payment.service';
import { getSettings, updateSettings } from './services/settings.service';
import { ensureDefaultTemplates } from './services/template.service';
import { runWithCompany } from './lib/company-context';

async function main() {
  console.log('🌱 Starting clean PostgreSQL database reset and seed...');

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
  await prismaRoot.taxRate.deleteMany().catch(() => {});
  await prismaRoot.messageTemplate.deleteMany().catch(() => {});
  await prismaRoot.companySettings.deleteMany().catch(() => {});
  await prismaRoot.numberSequence.deleteMany().catch(() => {});
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
  // 3. SEED BRAND IT COMPANY
  // =========================================================================
  await runWithCompany(brandIt.id, async () => {
    console.log('\n--- Seeding Brand It Company ---');

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

    // Tax Rates (2 rates)
    console.log('📊 Creating Brand It tax rates...');
    await prisma.taxRate.createMany({
      data: [
        { name: 'Standard VAT', rate: 15.0, isDefault: true, isActive: true },
        { name: 'NHIL / GETFund Levy', rate: 5.0, isDefault: false, isActive: true },
      ],
    });

    // Exactly 1 Admin & 1 Staff
    console.log('👤 Provisioning Brand It Admin and Staff...');
    const adminUser = await prisma.user.create({
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

    const adminActor = { userId: adminUser.id, ip: '127.0.0.1' };

    // Exactly 2 Clients
    console.log('👥 Creating 2 Brand It clients...');
    const client1 = await prisma.client.create({
      data: {
        name: 'Apex Infrastructure Ltd',
        companyName: 'Apex Infrastructure Ltd',
        email: 'procurement@apexinfra.gh',
        phone: '+233241234567',
        billingAddress: 'Plot 45, Industrial Area, Tema, Ghana',
        shippingAddress: 'Apex Yard Gate 2, Heavy Industrial Area, Tema',
        taxIdentifier: 'C0001294821',
        segment: 'Enterprise',
        notes: 'Commercial contractor for municipal surveillance and infrastructure.',
        isActive: true,
        createdById: adminActor.userId,
      },
    });

    await prisma.clientContact.create({
      data: {
        clientId: client1.id,
        name: 'Kofi Mensah',
        email: 'k.mensah@apexinfra.gh',
        phone: '+233241234568',
        designation: 'VP of Procurement',
        isPrimary: true,
      },
    });

    const client2 = await prisma.client.create({
      data: {
        name: 'Metro Hospitality Group',
        companyName: 'Metro Hospitality Group',
        email: 'facilities@metrohotels.gh',
        phone: '+233209876543',
        billingAddress: '12 Liberation Road, Airport City, Accra, Ghana',
        shippingAddress: 'Metro Hotel Central, Airport City, Accra',
        taxIdentifier: 'C0009841201',
        segment: 'Corporate',
        notes: 'Hotels and hospitality enterprise facilities.',
        isActive: true,
        createdById: adminActor.userId,
      },
    });

    await prisma.clientContact.create({
      data: {
        clientId: client2.id,
        name: 'Abena Osei',
        email: 'a.osei@metrohotels.gh',
        phone: '+233209876544',
        designation: 'Director of Operations',
        isPrimary: true,
      },
    });

    // Exactly 2 Products & Inventory
    console.log('📦 Creating 2 Brand It products & inventory items...');
    const product1 = await prisma.productService.create({
      data: {
        name: '4K UltraHD Vandal-Resistant Dome IP Camera (8MP IR)',
        description: 'H.265+ outdoor dome camera with 30m IR, motorized lens, and deep-learning analytics.',
        type: 'product',
        group: 'CCTV',
        sku: 'CCTV-CAM-4KDOME',
        unitPrice: 285.0,
        costPrice: 165.0,
        taxRate: 15.0,
        trackInventory: true,
        isActive: true,
      },
    });

    const invItem1 = await prisma.inventoryItem.create({
      data: {
        productServiceId: product1.id,
        quantityOnHand: 85,
        reorderThreshold: 15,
        unitCost: 165.0,
        location: 'Accra Depot - Shelf C2',
        isArchived: false,
      },
    });

    await prisma.stockMovement.create({
      data: {
        inventoryItemId: invItem1.id,
        userId: adminActor.userId,
        quantityChange: 85,
        previousQuantity: 0,
        balanceAfter: 85,
        reason: 'Initial opening stock allocation',
        reasonCode: 'opening',
      },
    });

    const product2 = await prisma.productService.create({
      data: {
        name: '16-Channel 4K NVR with 8TB Surveillance HDD',
        description: '160Mbps incoming bandwidth, PoE+ ports on all channels, dual HDMI output.',
        type: 'product',
        group: 'CCTV',
        sku: 'CCTV-NVR-16CH',
        unitPrice: 890.0,
        costPrice: 540.0,
        taxRate: 15.0,
        trackInventory: true,
        isActive: true,
      },
    });

    const invItem2 = await prisma.inventoryItem.create({
      data: {
        productServiceId: product2.id,
        quantityOnHand: 20,
        reorderThreshold: 5,
        unitCost: 540.0,
        location: 'Accra Depot - Shelf C4',
        isArchived: false,
      },
    });

    await prisma.stockMovement.create({
      data: {
        inventoryItemId: invItem2.id,
        userId: adminActor.userId,
        quantityChange: 20,
        previousQuantity: 0,
        balanceAfter: 20,
        reason: 'Initial opening stock allocation',
        reasonCode: 'opening',
      },
    });

    // Exactly 2 Invoices & 2 Payments
    console.log('📑 Creating 2 Brand It invoices & payments...');
    // Invoice 1 (Paid): For Apex Infrastructure
    const inv1 = await invoiceService.create(
      {
        clientId: client1.id,
        issueDate: new Date('2026-09-01'),
        dueDate: new Date('2026-09-15'),
        notes: 'Supply and installation of perimeter security cameras for Facility Bravo.',
        terms: 'Payment due within 14 days of invoice date.',
        discountAmount: 100,
        lineItems: [
          {
            productServiceId: product1.id,
            description: product1.name,
            quantity: 4,
            unitPrice: 285.0,
            taxRate: 15.0,
          },
          {
            productServiceId: product2.id,
            description: product2.name,
            quantity: 1,
            unitPrice: 890.0,
            taxRate: 15.0,
          },
        ],
        issue: true,
      },
      adminActor,
      { notify: false }
    );

    // Payment 1: Full settlement for Invoice 1
    await paymentService.record(
      {
        invoiceId: inv1.id,
        amount: Number(inv1.totalAmount),
        paymentDate: new Date('2026-09-05'),
        method: 'bank_transfer',
        reference: 'ACH-WIRE-889104-APEX',
        notes: 'Full settlement received via Ecobank Corporate Transfer.',
      },
      adminActor,
      { notify: false }
    );

    // Invoice 2 (Partially Paid): For Metro Hospitality Group
    const inv2 = await invoiceService.create(
      {
        clientId: client2.id,
        issueDate: new Date('2026-09-10'),
        dueDate: new Date('2026-09-30'),
        notes: 'Hotel surveillance hardware upgrade package.',
        terms: '50% advance upon contract signing, balance upon final handover.',
        discountAmount: 50,
        lineItems: [
          {
            productServiceId: product1.id,
            description: product1.name,
            quantity: 2,
            unitPrice: 285.0,
            taxRate: 15.0,
          },
          {
            productServiceId: product2.id,
            description: product2.name,
            quantity: 1,
            unitPrice: 890.0,
            taxRate: 15.0,
          },
        ],
        issue: true,
      },
      adminActor,
      { notify: false }
    );

    // Payment 2: 50% partial advance for Invoice 2
    const halfAmount = Math.round((Number(inv2.totalAmount) / 2) * 100) / 100;
    await paymentService.record(
      {
        invoiceId: inv2.id,
        amount: halfAmount,
        paymentDate: new Date('2026-09-12'),
        method: 'mobile_money',
        reference: 'MTN-MOMO-METRO-0912',
        notes: '50% project mobilisation advance via MTN Mobile Money Corporate.',
      },
      adminActor,
      { notify: false }
    );

    // Exactly 2 Expenses
    console.log('💳 Creating 2 Brand It expenses...');
    await prisma.expense.createMany({
      data: [
        {
          description: 'Warehouse facility lease & security (Q3)',
          category: 'Facilities',
          vendor: 'Accra Industrial Parks Ltd',
          amount: 3500.0,
          expenseDate: new Date('2026-09-01'),
        },
        {
          description: 'Arkesel SMS Gateway notification credits top-up',
          category: 'Software & Telecoms',
          vendor: 'Arkesel Communications',
          amount: 450.0,
          expenseDate: new Date('2026-09-08'),
        },
      ],
    });
  });

  // =========================================================================
  // 4. SEED STOIC COMPANY
  // =========================================================================
  await runWithCompany(stoic.id, async () => {
    console.log('\n--- Seeding Stoic Company ---');

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

    // Tax Rates (2 rates)
    console.log('📊 Creating Stoic tax rates...');
    await prisma.taxRate.createMany({
      data: [
        { name: 'US Standard Sales Tax', rate: 8.875, isDefault: true, isActive: true },
        { name: 'State Surcharge', rate: 1.5, isDefault: false, isActive: true },
      ],
    });

    // Exactly 1 Admin & 1 Staff
    console.log('👤 Provisioning Stoic Admin and Staff...');
    const stoicAdminUser = await prisma.user.create({
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

    const stoicAdminActor = { userId: stoicAdminUser.id, ip: '127.0.0.1' };

    // Exactly 2 Clients
    console.log('👥 Creating 2 Stoic clients...');
    const stoicClient1 = await prisma.client.create({
      data: {
        name: 'Stoic Design Studio',
        companyName: 'Stoic Design Studio LLC',
        email: 'operations@stoicdesign.com',
        phone: '+1 415 555 2401',
        billingAddress: '500 Howard Street, San Francisco, CA 94105',
        shippingAddress: '500 Howard Street, Floor 3, San Francisco, CA',
        taxIdentifier: 'US-CA-889102',
        segment: 'Design Agency',
        notes: 'Modern architectural & interior workspace studio client.',
        isActive: true,
        createdById: stoicAdminActor.userId,
      },
    });

    await prisma.clientContact.create({
      data: {
        clientId: stoicClient1.id,
        name: 'Marcus Vance',
        email: 'm.vance@stoicdesign.com',
        phone: '+1 415 555 2402',
        designation: 'Managing Partner',
        isPrimary: true,
      },
    });

    const stoicClient2 = await prisma.client.create({
      data: {
        name: 'Stoic Retail Enterprise',
        companyName: 'Stoic Retail Enterprise Inc',
        email: 'purchasing@stoicretail.com',
        phone: '+1 312 555 8933',
        billingAddress: '233 S Wacker Dr, Chicago, IL 60606',
        shippingAddress: 'Central Distribution Hub, 100 Industrial Pkwy, Chicago, IL',
        taxIdentifier: 'US-IL-445109',
        segment: 'Retail Enterprise',
        notes: 'Multi-location retail furnishing and workspace chain.',
        isActive: true,
        createdById: stoicAdminActor.userId,
      },
    });

    await prisma.clientContact.create({
      data: {
        clientId: stoicClient2.id,
        name: 'Chloe Dupont',
        email: 'c.dupont@stoicretail.com',
        phone: '+1 312 555 8934',
        designation: 'Procurement Lead',
        isPrimary: true,
      },
    });

    // Exactly 2 Products & Inventory
    console.log('📦 Creating 2 Stoic products & inventory items...');
    const stoicProduct1 = await prisma.productService.create({
      data: {
        name: 'Ergonomic Executive Office Desk (Solid Walnut)',
        description: 'Motorized height-adjustable standing desk with integrated power ports and cable management.',
        type: 'product',
        group: 'Furniture',
        sku: 'STK-DESK-ERGO',
        unitPrice: 1250.0,
        costPrice: 720.0,
        taxRate: 8.875,
        trackInventory: true,
        isActive: true,
      },
    });

    const stoicInvItem1 = await prisma.inventoryItem.create({
      data: {
        productServiceId: stoicProduct1.id,
        quantityOnHand: 35,
        reorderThreshold: 5,
        unitCost: 720.0,
        location: 'Stoic Hub - Aisle 1',
        isArchived: false,
      },
    });

    await prisma.stockMovement.create({
      data: {
        inventoryItemId: stoicInvItem1.id,
        userId: stoicAdminActor.userId,
        quantityChange: 35,
        previousQuantity: 0,
        balanceAfter: 35,
        reason: 'Initial opening stock allocation',
        reasonCode: 'opening',
      },
    });

    const stoicProduct2 = await prisma.productService.create({
      data: {
        name: 'High-Back Lumbar Mesh Ergonomic Chair',
        description: '3D adjustable armrests, breathable elastomeric mesh, dynamic lumbar support system.',
        type: 'product',
        group: 'Furniture',
        sku: 'STK-CHAIR-MESH',
        unitPrice: 480.0,
        costPrice: 260.0,
        taxRate: 8.875,
        trackInventory: true,
        isActive: true,
      },
    });

    const stoicInvItem2 = await prisma.inventoryItem.create({
      data: {
        productServiceId: stoicProduct2.id,
        quantityOnHand: 50,
        reorderThreshold: 10,
        unitCost: 260.0,
        location: 'Stoic Hub - Aisle 2',
        isArchived: false,
      },
    });

    await prisma.stockMovement.create({
      data: {
        inventoryItemId: stoicInvItem2.id,
        userId: stoicAdminActor.userId,
        quantityChange: 50,
        previousQuantity: 0,
        balanceAfter: 50,
        reason: 'Initial opening stock allocation',
        reasonCode: 'opening',
      },
    });

    // Exactly 2 Invoices & 2 Payments
    console.log('📑 Creating 2 Stoic invoices & payments...');
    // Invoice 1 (Paid): For Stoic Design Studio
    const stoicInv1 = await invoiceService.create(
      {
        clientId: stoicClient1.id,
        issueDate: new Date('2026-09-02'),
        dueDate: new Date('2026-09-16'),
        notes: 'Executive suite standing desks and ergonomic mesh chairs delivery.',
        terms: 'Net 30 days payable upon receipt.',
        discountAmount: 100,
        lineItems: [
          {
            productServiceId: stoicProduct1.id,
            description: stoicProduct1.name,
            quantity: 2,
            unitPrice: 1250.0,
            taxRate: 8.875,
          },
          {
            productServiceId: stoicProduct2.id,
            description: stoicProduct2.name,
            quantity: 4,
            unitPrice: 480.0,
            taxRate: 8.875,
          },
        ],
        issue: true,
      },
      stoicAdminActor,
      { notify: false }
    );

    // Payment 1: Full settlement for Invoice 1
    await paymentService.record(
      {
        invoiceId: stoicInv1.id,
        amount: Number(stoicInv1.totalAmount),
        paymentDate: new Date('2026-09-06'),
        method: 'bank_transfer',
        reference: 'WIRE-US-9921-STOIC',
        notes: 'Full payment settled via Chase Corporate Wire Transfer.',
      },
      stoicAdminActor,
      { notify: false }
    );

    // Invoice 2 (Partially Paid): For Stoic Retail Enterprise
    const stoicInv2 = await invoiceService.create(
      {
        clientId: stoicClient2.id,
        issueDate: new Date('2026-09-12'),
        dueDate: new Date('2026-09-28'),
        notes: 'Commercial workstation batch fulfillment phase 1.',
        terms: '50% mobilization deposit required.',
        discountAmount: 150,
        lineItems: [
          {
            productServiceId: stoicProduct1.id,
            description: stoicProduct1.name,
            quantity: 4,
            unitPrice: 1250.0,
            taxRate: 8.875,
          },
        ],
        issue: true,
      },
      stoicAdminActor,
      { notify: false }
    );

    // Payment 2: 50% partial deposit for Invoice 2
    const stoicHalfAmount = Math.round((Number(stoicInv2.totalAmount) / 2) * 100) / 100;
    await paymentService.record(
      {
        invoiceId: stoicInv2.id,
        amount: stoicHalfAmount,
        paymentDate: new Date('2026-09-14'),
        method: 'credit_card',
        reference: 'STRIPE-CHG-STK-0922',
        notes: '50% procurement deposit charged to Corporate Visa.',
      },
      stoicAdminActor,
      { notify: false }
    );

    // Exactly 2 Expenses
    console.log('💳 Creating 2 Stoic expenses...');
    await prisma.expense.createMany({
      data: [
        {
          description: 'Cloud Infrastructure & High-Availability Hosting',
          category: 'IT & Hosting',
          vendor: 'AWS Cloud Services',
          amount: 1200.0,
          expenseDate: new Date('2026-09-02'),
        },
        {
          description: 'Showroom Display & Hardware Maintenance',
          category: 'Operations',
          vendor: 'Global Logistics Supplies',
          amount: 650.0,
          expenseDate: new Date('2026-09-14'),
        },
      ],
    });
  });

  console.log('\n======================================================');
  console.log('✅ PostgreSQL database seeded successfully with 2 companies!');
  console.log('======================================================');
  console.log('🏢 Brand It Company (slug: brand-it):');
  console.log('   Admin: admin@brand-it.com / Admin!2026 (Brand It Admin)');
  console.log('   Staff: staff@brand-it.com / Staff!2026 (Brand It Staff)');
  console.log('   Data:  2 Clients, 2 Products/Inventory, 2 Invoices, 2 Payments, 2 Expenses, 2 Tax Rates');
  console.log('------------------------------------------------------');
  console.log('🏢 Stoic Company (slug: stoic):');
  console.log('   Admin: admin@stoic.com / Admin!2026 (Stoic Admin)');
  console.log('   Staff: staff@stoic.com / Staff!2026 (Stoic Staff)');
  console.log('   Data:  2 Clients, 2 Products/Inventory, 2 Invoices, 2 Payments, 2 Expenses, 2 Tax Rates');
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
