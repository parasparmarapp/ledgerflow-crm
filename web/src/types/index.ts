export interface User {
  id: number;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
  [key: string]: any;
}
export type CreateUserDTO = CreateUserInput;
export type UserInput = CreateUserInput;

export interface UpdateUserInput {
  id?: number;
  email?: string;
  name?: string;
  passwordHash?: string;
  role?: string;
  isActive?: boolean;
  [key: string]: any;
}
export type UpdateUserDTO = UpdateUserInput;

export type UserView = User;
export type UserResponse = User;

export interface Client {
  id: number;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  taxIdentifier?: string;
  notes?: string;
  segment?: string;
  smsOptOut?: boolean;
  emailOptOut?: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface ClientContact {
  id: number;
  clientId: number;
  name: string;
  email?: string;
  phone?: string;
  designation?: string;
  isPrimary?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateClientInput {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  taxIdentifier?: string;
  notes?: string;
  segment?: string;
  smsOptOut?: boolean;
  emailOptOut?: boolean;
  isActive?: boolean;
  [key: string]: any;
}
export type CreateClientDTO = CreateClientInput;
export type ClientInput = CreateClientInput;

export interface UpdateClientInput {
  id?: number;
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  shippingAddress?: string;
  taxIdentifier?: string;
  notes?: string;
  segment?: string;
  smsOptOut?: boolean;
  emailOptOut?: boolean;
  isActive?: boolean;
  [key: string]: any;
}
export type UpdateClientDTO = UpdateClientInput;

export type ClientView = Client;
export type ClientResponse = Client;

export interface ProductService {
  id: number;
  name: string;
  description?: string;
  type: string;
  group?: 'Commodities' | 'CCTV' | 'Folding Partition' | string;
  sku?: string;
  imageUrl?: string | null;
  unitPrice: number;
  costPrice?: number;
  taxRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateProductServiceInput {
  name: string;
  description?: string;
  type: string;
  group?: 'Commodities' | 'CCTV' | 'Folding Partition' | string;
  sku?: string;
  imageUrl?: string | null;
  unitPrice: number;
  costPrice?: number;
  taxRate: number;
  isActive: boolean;
  initialStock?: number;
  [key: string]: any;
}
export type CreateProductServiceDTO = CreateProductServiceInput;
export type ProductServiceInput = CreateProductServiceInput;

export interface UpdateProductServiceInput {
  id?: number;
  name?: string;
  description?: string;
  type?: string;
  sku?: string;
  imageUrl?: string | null;
  unitPrice?: number;
  costPrice?: number;
  taxRate?: number;
  isActive?: boolean;
  [key: string]: any;
}
export type UpdateProductServiceDTO = UpdateProductServiceInput;

export type ProductServiceView = ProductService;
export type ProductServiceResponse = ProductService;

export interface InventoryItem {
  id: number;
  productServiceId: number;
  quantityOnHand: number;
  reorderThreshold: number;
  unitCost: number;
  location?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateInventoryItemInput {
  productServiceId: number;
  quantityOnHand: number;
  reorderThreshold: number;
  unitCost: number;
  location?: string;
  isArchived: boolean;
  [key: string]: any;
}
export type CreateInventoryItemDTO = CreateInventoryItemInput;
export type InventoryItemInput = CreateInventoryItemInput;

export interface UpdateInventoryItemInput {
  id?: number;
  productServiceId?: number;
  quantityOnHand?: number;
  reorderThreshold?: number;
  unitCost?: number;
  location?: string;
  isArchived?: boolean;
  [key: string]: any;
}
export type UpdateInventoryItemDTO = UpdateInventoryItemInput;

export type InventoryItemView = InventoryItem;
export type InventoryItemResponse = InventoryItem;

export interface StockMovement {
  id: number;
  inventoryItemId: number;
  userId: number;
  quantityChange: number;
  reason: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateStockMovementInput {
  inventoryItemId: number;
  userId: number;
  quantityChange: number;
  reason: string;
  notes?: string;
  [key: string]: any;
}
export type CreateStockMovementDTO = CreateStockMovementInput;
export type StockMovementInput = CreateStockMovementInput;

export interface UpdateStockMovementInput {
  id?: number;
  inventoryItemId?: number;
  userId?: number;
  quantityChange?: number;
  reason?: string;
  notes?: string;
  [key: string]: any;
}
export type UpdateStockMovementDTO = UpdateStockMovementInput;

export type StockMovementView = StockMovement;
export type StockMovementResponse = StockMovement;

export interface Invoice {
  id: number;
  clientId: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  notes?: string;
  terms?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateInvoiceInput {
  clientId: number;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  status?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  notes?: string;
  terms?: string;
  sentAt?: string;
  [key: string]: any;
}
export type CreateInvoiceDTO = CreateInvoiceInput;
export type InvoiceInput = CreateInvoiceInput;

export interface UpdateInvoiceInput {
  id?: number;
  clientId?: number;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  status?: string;
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  amountPaid?: number;
  notes?: string;
  terms?: string;
  sentAt?: string;
  [key: string]: any;
}
export type UpdateInvoiceDTO = UpdateInvoiceInput;

export type InvoiceView = Invoice;
export type InvoiceResponse = Invoice;

export interface InvoiceLineItem {
  id: number;
  invoiceId: number;
  productServiceId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  lineTotal: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateInvoiceLineItemInput {
  invoiceId: number;
  productServiceId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  lineTotal: number;
  [key: string]: any;
}
export type CreateInvoiceLineItemDTO = CreateInvoiceLineItemInput;
export type InvoiceLineItemInput = CreateInvoiceLineItemInput;

export interface UpdateInvoiceLineItemInput {
  id?: number;
  invoiceId?: number;
  productServiceId?: number;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  discountAmount?: number;
  taxRate?: number;
  lineTotal?: number;
  [key: string]: any;
}
export type UpdateInvoiceLineItemDTO = UpdateInvoiceLineItemInput;

export type InvoiceLineItemView = InvoiceLineItem;
export type InvoiceLineItemResponse = InvoiceLineItem;

export interface RecurringInvoice {
  id: number;
  clientId: number;
  frequency: string;
  nextRunAt: string;
  amount: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateRecurringInvoiceInput {
  clientId: number;
  frequency: string;
  nextRunAt: string;
  amount: number;
  isActive: boolean;
  notes?: string;
  [key: string]: any;
}
export type CreateRecurringInvoiceDTO = CreateRecurringInvoiceInput;
export type RecurringInvoiceInput = CreateRecurringInvoiceInput;

export interface UpdateRecurringInvoiceInput {
  id?: number;
  clientId?: number;
  frequency?: string;
  nextRunAt?: string;
  amount?: number;
  isActive?: boolean;
  notes?: string;
  [key: string]: any;
}
export type UpdateRecurringInvoiceDTO = UpdateRecurringInvoiceInput;

export type RecurringInvoiceView = RecurringInvoice;
export type RecurringInvoiceResponse = RecurringInvoice;

export interface Expense {
  id: number;
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
  vendor?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateExpenseInput {
  description: string;
  category: string;
  amount: number;
  expenseDate: string;
  vendor?: string;
  notes?: string;
  [key: string]: any;
}
export type CreateExpenseDTO = CreateExpenseInput;
export type ExpenseInput = CreateExpenseInput;

export interface UpdateExpenseInput {
  id?: number;
  description?: string;
  category?: string;
  amount?: number;
  expenseDate?: string;
  vendor?: string;
  notes?: string;
  [key: string]: any;
}
export type UpdateExpenseDTO = UpdateExpenseInput;

export type ExpenseView = Expense;
export type ExpenseResponse = Expense;

export interface Payment {
  id: number;
  invoiceId: number;
  clientId: number;
  amount: number;
  paymentDate: string;
  method: string;
  reference?: string;
  status: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreatePaymentInput {
  invoiceId: number;
  clientId: number;
  amount: number;
  paymentDate: string;
  method: string;
  reference?: string;
  status?: string;
  notes?: string;
  [key: string]: any;
}
export type CreatePaymentDTO = CreatePaymentInput;
export type PaymentInput = CreatePaymentInput;

export interface UpdatePaymentInput {
  id?: number;
  invoiceId?: number;
  clientId?: number;
  amount?: number;
  paymentDate?: string;
  method?: string;
  reference?: string;
  status?: string;
  notes?: string;
  [key: string]: any;
}
export type UpdatePaymentDTO = UpdatePaymentInput;

export type PaymentView = Payment;
export type PaymentResponse = Payment;

export interface Reminder {
  id: number;
  invoiceId?: number;
  channel: string;
  triggerType: string;
  daysOffset: number;
  isActive: boolean;
  message?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateReminderInput {
  invoiceId?: number;
  channel: string;
  triggerType: string;
  daysOffset: number;
  isActive: boolean;
  message?: string;
  [key: string]: any;
}
export type CreateReminderDTO = CreateReminderInput;
export type ReminderInput = CreateReminderInput;

export interface UpdateReminderInput {
  id?: number;
  invoiceId?: number;
  channel?: string;
  triggerType?: string;
  daysOffset?: number;
  isActive?: boolean;
  message?: string;
  [key: string]: any;
}
export type UpdateReminderDTO = UpdateReminderInput;

export type ReminderView = Reminder;
export type ReminderResponse = Reminder;

export interface Alert {
  id: number;
  invoiceId?: number;
  inventoryItemId?: number;
  channel: string;
  alertType: string;
  status: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface CreateAlertInput {
  invoiceId?: number;
  inventoryItemId?: number;
  channel: string;
  alertType: string;
  status?: string;
  sentAt?: string;
  [key: string]: any;
}
export type CreateAlertDTO = CreateAlertInput;
export type AlertInput = CreateAlertInput;

export interface UpdateAlertInput {
  id?: number;
  invoiceId?: number;
  inventoryItemId?: number;
  channel?: string;
  alertType?: string;
  status?: string;
  sentAt?: string;
  [key: string]: any;
}
export type UpdateAlertDTO = UpdateAlertInput;

export type AlertView = Alert;
export type AlertResponse = Alert;
