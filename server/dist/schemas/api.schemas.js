import { z } from 'zod';
// ─── Auth Schemas ────────────────────────────────────────────────────
export const loginSchema = z.object({
    username: z.string().min(1, 'Username is required').trim(),
    password: z.string().min(1).optional(),
    pin: z.string().min(1).optional()
}).refine(data => data.password || data.pin, { message: 'Password or PIN is required', path: ['password'] });
export const registerSchema = z.object({
    full_name: z.string().min(2, 'Full name must be at least 2 characters').trim(),
    username: z.string().min(3, 'Username must be at least 3 characters').trim().toLowerCase(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    pin: z.string().length(4, 'PIN must be exactly 4 digits').regex(/^\d{4}$/, 'PIN must be 4 digits').optional(),
    phone: z.string().optional(),
    employee_id: z.string().optional(),
    requested_role: z.enum(['owner', 'admin', 'cashier', 'chef', 'barista', 'waiter', 'storekeeper']),
    branch_id: z.string().min(1, 'Branch is required'),
    profile_photo: z.string().url().optional().nullable()
});
export const verifyPinSchema = z.object({
    pin: z.string().min(1, 'PIN is required'),
    userId: z.string().optional()
});
// ─── Order Schemas ───────────────────────────────────────────────────
const orderItemSchema = z.object({
    menu_item_id: z.string().min(1),
    name: z.string().min(1),
    price: z.number().positive(),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
    routing_destination: z.enum(['KITCHEN', 'BAR', 'BOTH']).default('KITCHEN')
});
export const createOrderSchema = z.object({
    branch_id: z.string().optional(),
    table_id: z.string().optional().nullable(),
    order_type: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).default('DINE_IN'),
    items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
    special_notes: z.string().optional().nullable(),
    client_tx_id: z.string().optional().nullable()
});
export const confirmOrderSchema = z.object({
    discount_amount: z.number().min(0).default(0),
    discount_reason: z.string().optional().nullable()
});
export const updateItemStatusSchema = z.object({
    status: z.enum(['PREPARING', 'READY'])
});
export const cancelOrderSchema = z.object({
    reason: z.string().min(1, 'Cancellation reason is required')
});
// ─── Payment Schemas ─────────────────────────────────────────────────
const paymentSplitSchema = z.object({
    method: z.enum(['CASH', 'TELEBIRR', 'CBE_BIRR', 'CARD', 'OTHER']),
    amount: z.number().positive('Amount must be positive'),
    reference_number: z.string().optional().nullable()
});
export const processPaymentSchema = z.object({
    order_id: z.string().min(1, 'Order ID is required'),
    splits: z.array(paymentSplitSchema).min(1, 'At least one payment split is required')
});
// ─── Admin Schemas ───────────────────────────────────────────────────
export const createStaffSchema = z.object({
    full_name: z.string().min(2).trim(),
    username: z.string().min(3).trim().toLowerCase(),
    password: z.string().min(6),
    pin: z.string().length(4).regex(/^\d{4}$/).optional(),
    phone: z.string().optional(),
    employee_id: z.string().optional(),
    role: z.enum(['owner', 'admin', 'cashier', 'chef', 'barista', 'waiter', 'storekeeper']),
    branch_id: z.string().min(1)
});
export const updateUserStatusSchema = z.object({
    status: z.enum(['ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED', 'DEACTIVATED']),
    role: z.enum(['owner', 'admin', 'cashier', 'chef', 'barista', 'waiter', 'storekeeper']).optional(),
    branch_id: z.string().optional()
});
// ─── Inventory Schemas ───────────────────────────────────────────────
const receiveStockItemSchema = z.object({
    ingredient_id: z.string().min(1),
    quantity: z.number().positive(),
    unit_price: z.number().min(0)
});
export const receiveStockSchema = z.object({
    branch_id: z.string().optional(),
    supplier_id: z.string().optional(),
    invoice_number: z.string().optional(),
    items: z.array(receiveStockItemSchema).min(1, 'Items list is required for receiving stock'),
    notes: z.string().optional()
});
export const logWasteSchema = z.object({
    branch_id: z.string().optional(),
    ingredient_id: z.string().min(1, 'Ingredient is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unit: z.string().default('g'),
    reason: z.string().min(1, 'Reason is required'),
    photo_url: z.string().optional().nullable()
});
export const createIngredientSchema = z.object({
    name: z.string().min(1, 'Ingredient name is required').trim(),
    name_amharic: z.string().optional().nullable(),
    category: z.string().min(1, 'Category is required'),
    sku: z.string().optional().nullable(),
    unit: z.string().min(1, 'Unit is required'),
    unit_cost: z.number().min(0).default(0),
    min_stock_level: z.number().min(0).default(5),
    max_stock_level: z.number().min(0).default(100),
    shelf_location: z.string().optional().nullable(),
    photo_url: z.string().optional().nullable(),
    expiration_date: z.string().optional().nullable()
});
export const updateIngredientSchema = z.object({
    name: z.string().min(1, 'Ingredient name is required').trim().optional(),
    name_amharic: z.string().optional().nullable(),
    category: z.string().min(1).optional(),
    sku: z.string().optional().nullable(),
    unit: z.string().min(1).optional(),
    unit_cost: z.number().min(0).optional(),
    min_stock_level: z.number().min(0).optional(),
    max_stock_level: z.number().min(0).optional(),
    shelf_location: z.string().optional().nullable(),
    photo_url: z.string().optional().nullable(),
    expiration_date: z.string().optional().nullable()
});
// ─── Menu / Recipe Schemas ───────────────────────────────────────────
const recipeIngredientSchema = z.object({
    ingredient_id: z.string().min(1),
    quantity_required: z.number().positive()
});
export const upsertRecipeSchema = z.object({
    instructions: z.string().optional().nullable(),
    yield_portions: z.number().int().positive().default(1),
    ingredients: z.array(recipeIngredientSchema).min(1, 'At least one ingredient is required')
});
export const createCategorySchema = z.object({
    name: z.string().min(1, 'Category name is required').trim(),
    name_amharic: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    sort_order: z.number().int().optional().nullable()
});
export const updateCategorySchema = z.object({
    name: z.string().min(1).trim().optional(),
    name_amharic: z.string().optional().nullable(),
    icon: z.string().optional().nullable(),
    sort_order: z.number().int().optional().nullable(),
    is_active: z.boolean().optional()
});
