import 'dotenv/config';
import prisma from './lib/prisma';
import { runWithCompany } from './lib/company-context';
import { getSettings, updateSettings } from './services/settings.service';
import { ensureDefaultTemplates } from './services/template.service';

async function main() {
  const brandIt = await prisma.company.upsert({
    where: { slug: 'brand-it' },
    create: { slug: 'brand-it', name: 'Brand It Company' },
    update: { name: 'Brand It Company', isActive: true },
  });
  const stoic = await prisma.company.upsert({
    where: { slug: 'stoic' },
    create: { slug: 'stoic', name: 'Stoic Company' },
    update: { name: 'Stoic Company', isActive: true },
  });

  const existingStoicAdmins = await runWithCompany(stoic.id, async () =>
    await prisma.user.count({ where: { role: 'admin', isActive: true } }),
  );
  if (existingStoicAdmins === 0) {
    const admins = await runWithCompany(brandIt.id, () =>
      prisma.user.findMany({ where: { role: 'admin', isActive: true }, select: { email: true, name: true, passwordHash: true } }),
    );
    for (const admin of admins) {
      await runWithCompany(stoic.id, () =>
        prisma.user.create({ data: { ...admin, role: 'admin', isActive: true } }),
      );
    }
    if (admins.length) console.log(`Provisioned ${admins.length} initial Stoic admin account(s).`);
    else console.warn('No active Brand It admin was found to bootstrap Stoic; add a Stoic admin before using that workspace.');
  } else {
    console.log(`Stoic already has ${existingStoicAdmins} active admin account(s).`);
  }

  for (const company of [brandIt, stoic]) {
    await runWithCompany(company.id, async () => {
      const settings = await getSettings();
      if (settings.companyName === 'LedgerFlow CRM' || (company.slug === 'brand-it' && settings.companyName === 'LedgerFlow Solutions Ltd')) {
        await updateSettings({ companyName: company.name });
      }
      await ensureDefaultTemplates();
    });
  }

  console.log('Brand It Company and Stoic Company are ready. Existing CRM records remain assigned to Brand It Company.');
}

main()
  .catch((error) => {
    console.error('Company bootstrap failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
