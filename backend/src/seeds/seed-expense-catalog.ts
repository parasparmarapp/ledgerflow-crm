import 'dotenv/config';
import { prismaRoot } from '../lib/prisma';

export interface CategorySeed {
  name: string;
  group: string;
  sortOrder: number;
  items: string[];
}

export const EXPENSE_CATALOG: CategorySeed[] = [
  {
    name: 'General & Operating',
    group: 'General & Operating Expenses',
    sortOrder: 1,
    items: [
      'Electricity and water',
      'Airtime & Data',
      'Office stationery and printing',
      'Accounting and audit fees',
      'Legal and professional fees',
      'Advertising and marketing',
      'Vehicle fuel',
      'Vehicle servicing and repairs',
      'Vehicle insurance and registration',
      'Travel and accommodation for business purposes',
      'Repairs and maintenance of the office, warehouse, and factory',
      'Staff training',
      'Bank & Momo charges',
      'Software and accounting-system subscriptions',
    ],
  },
  {
    name: 'Building',
    group: 'Building Expenses',
    sortOrder: 2,
    items: [
      'Building maintenance',
      'Repairs',
      'Security',
      'Cleaning',
      'Electricity and water',
    ],
  },
  {
    name: 'Casual Labour / Loading & Offloading',
    group: 'Warehouse Expenses',
    sortOrder: 3,
    items: [
      'Payments to non-staff boys for unloading new consignments',
      'Labour for loading goods when customers make purchases',
      'Other temporary warehouse labour',
    ],
  },
  {
    name: 'Warehouse Utilities',
    group: 'Warehouse Expenses',
    sortOrder: 4,
    items: [
      'Electricity',
      'Water',
    ],
  },
  {
    name: 'Warehouse Security',
    group: 'Warehouse Expenses',
    sortOrder: 5,
    items: [
      'Security guards',
      'Security services',
      'Security equipment maintenance',
    ],
  },
  {
    name: 'Warehouse Cleaning & Sanitation',
    group: 'Warehouse Expenses',
    sortOrder: 6,
    items: [
      'Cleaning services',
      'Cleaning materials',
      'Waste disposal',
      'Pest control/fumigation',
    ],
  },
  {
    name: 'Warehouse Repairs & Maintenance',
    group: 'Warehouse Expenses',
    sortOrder: 7,
    items: [
      'Repairs to doors, locks, roofing, floors, etc.',
      'Maintenance of warehouse equipment',
      'Electrical/plumbing repairs',
      'Pallets and other handling materials',
    ],
  },
  {
    name: 'Warehouse Insurance',
    group: 'Warehouse Expenses',
    sortOrder: 8,
    items: [
      'Insurance relating to goods/inventory',
    ],
  },
  {
    name: 'Other Warehouse Expenses',
    group: 'Warehouse Expenses',
    sortOrder: 9,
    items: [
      'Warehouse handling and general running costs',
      'Protective clothing/PPE for warehouse workers',
      'Stationery used specifically for warehouse operations',
    ],
  },
  {
    name: 'Company Cars',
    group: 'Company Cars Expenses',
    sortOrder: 10,
    items: [
      'Fuel',
      'Repairs and servicing',
      'Spare parts',
      'Insurance & Roadworthy of vehicles',
      'Registration/licensing',
      'Tyres',
      'Vehicle cleaning',
    ],
  },
  {
    name: 'Block Factory',
    group: 'Block Factory Expenses',
    sortOrder: 11,
    items: [
      'Cement',
      'Sand',
      'Water used in production',
      "Direct production workers' wages",
      'Electricity used in production',
      'Factory machinery maintenance',
      'Factory supplies',
    ],
  },
  {
    name: 'Property & Assets',
    group: 'Property & Assets Expenses',
    sortOrder: 12,
    items: [
      'Property insurance (covering office, warehouse, and factory buildings)',
      'Property taxes/rates',
      'Depreciation of warehouse equipment',
      'Depreciation of block-making machines',
      'Land and property',
      'Buildings and factories',
      'Machinery and heavy equipment',
      'Office furniture and computers',
      'Vehicles',
    ],
  },
  // Legacy / existing categories for backwards compatibility
  {
    name: 'Facilities',
    group: 'General Expenses',
    sortOrder: 20,
    items: ['Facility lease & security', 'Rent', 'Utilities'],
  },
  {
    name: 'Software & Telecoms',
    group: 'General Expenses',
    sortOrder: 21,
    items: ['SMS Gateway credits', 'Internet service', 'Cloud hosting'],
  },
  {
    name: 'IT & Hosting',
    group: 'General Expenses',
    sortOrder: 22,
    items: ['Cloud Infrastructure', 'Server hosting', 'Domain registration'],
  },
  {
    name: 'Operations',
    group: 'General Expenses',
    sortOrder: 23,
    items: ['Hardware Maintenance', 'Logistics Supplies', 'General Operations'],
  },
];

export async function seedExpenseCatalog() {
  console.log('📦 Seeding expense categories and items from Excel schedule...');

  for (const cat of EXPENSE_CATALOG) {
    const categoryRecord = await prismaRoot.expenseCategory.upsert({
      where: { name: cat.name },
      update: {
        group: cat.group,
        sortOrder: cat.sortOrder,
      },
      create: {
        name: cat.name,
        group: cat.group,
        sortOrder: cat.sortOrder,
      },
    });

    let itemOrder = 1;
    for (const itemName of cat.items) {
      await prismaRoot.expenseItem.upsert({
        where: {
          categoryId_name: {
            categoryId: categoryRecord.id,
            name: itemName,
          },
        },
        update: {
          sortOrder: itemOrder++,
        },
        create: {
          categoryId: categoryRecord.id,
          name: itemName,
          sortOrder: itemOrder++,
        },
      });
    }
  }

  const categoryCount = await prismaRoot.expenseCategory.count();
  const itemCount = await prismaRoot.expenseItem.count();
  console.log(`✅ Seeded ${categoryCount} categories and ${itemCount} items.`);
}

if (require.main === module) {
  seedExpenseCatalog()
    .then(() => {
      console.log('Expense catalog seed complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to seed expense catalog:', err);
      process.exit(1);
    });
}
