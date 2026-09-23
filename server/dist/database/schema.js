import { dbWrapper } from './connection.js';
export const db = dbWrapper;
export function initDatabase() {
    const schema = `
    -- Branches
    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      tax_number TEXT,
      vat_rate REAL DEFAULT 0.15,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      pin_hash TEXT,
      phone TEXT,
      employee_id TEXT,
      profile_photo TEXT,
      role TEXT NOT NULL,
      branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'PENDING_APPROVAL', -- 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- User Custom Permissions Overrides
    CREATE TABLE IF NOT EXISTS user_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL,
      is_granted INTEGER NOT NULL, -- 1 granted, 0 explicitly revoked
      UNIQUE(user_id, permission)
    );

    -- Tables & Areas
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      table_number TEXT NOT NULL,
      name TEXT NOT NULL,
      section TEXT DEFAULT 'Main Dining',
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'OCCUPIED', 'RESERVED'
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Menu Categories
    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_amharic TEXT,
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    -- Menu Items
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      name_amharic TEXT,
      description TEXT,
      price REAL NOT NULL,
      photo_url TEXT,
      prep_time_minutes INTEGER DEFAULT 15,
      routing_destination TEXT NOT NULL, -- 'KITCHEN', 'BAR', 'BOTH'
      is_tax_inclusive INTEGER DEFAULT 1,
      is_available INTEGER DEFAULT 1,
      deleted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Ingredients Master
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_amharic TEXT,
      category TEXT NOT NULL, -- 'Meat', 'Dairy', 'Vegetables', 'Dry Goods', 'Beverages', 'Packaging', 'Cleaning'
      sku TEXT,
      unit TEXT NOT NULL, -- 'kg', 'g', 'l', 'ml', 'piece', 'bottle', 'box'
      unit_cost REAL DEFAULT 0,
      min_stock_level REAL DEFAULT 5,
      max_stock_level REAL DEFAULT 100,
      photo_url TEXT,
      shelf_location TEXT, -- e.g. 'Main Store / Shelf A2'
      expiration_date DATE,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Branch Inventory Stock
    CREATE TABLE IF NOT EXISTS inventory_stock (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      current_quantity REAL NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(branch_id, ingredient_id)
    );

    -- Recipes (BOM - Bill of Materials)
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT UNIQUE NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
      instructions TEXT,
      yield_portions INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS recipe_items (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
      quantity_required REAL NOT NULL, -- in ingredient's base unit
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER NOT NULL,
      client_tx_id TEXT UNIQUE, -- for offline idempotency
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      table_id TEXT REFERENCES restaurant_tables(id) ON DELETE SET NULL,
      waiter_id TEXT NOT NULL REFERENCES users(id),
      cashier_id TEXT REFERENCES users(id),
      order_type TEXT NOT NULL, -- 'DINE_IN', 'TAKEAWAY', 'DELIVERY'
      status TEXT NOT NULL DEFAULT 'PENDING_CASHIER',
      -- Statuses: 'DRAFT', 'PENDING_CASHIER', 'CONFIRMED', 'PREPARING', 'PARTIALLY_READY', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'
      subtotal REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      discount_reason TEXT,
      discount_approver_id TEXT REFERENCES users(id),
      total_amount REAL NOT NULL DEFAULT 0,
      special_notes TEXT,
      delivered_at DATETIME,
      completed_at DATETIME,
      cancelled_at DATETIME,
      cancellation_reason TEXT,
      cancelled_by_id TEXT REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Order Items
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      notes TEXT,
      routing_destination TEXT NOT NULL, -- 'KITCHEN' or 'BAR'
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PREPARING', 'READY'
      prepared_by_id TEXT REFERENCES users(id),
      ready_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Order Status Audit Log
    CREATE TABLE IF NOT EXISTS order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id),
      previous_status TEXT,
      new_status TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Payments & Splits
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      cashier_id TEXT NOT NULL REFERENCES users(id),
      method TEXT NOT NULL, -- 'CASH', 'TELEBIRR', 'CBE_BIRR', 'CARD', 'OTHER'
      amount REAL NOT NULL,
      reference_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Receipts
    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      order_id TEXT UNIQUE NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      receipt_number TEXT NOT NULL,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      total_amount REAL NOT NULL,
      tax_amount REAL NOT NULL,
      discount_amount REAL NOT NULL,
      content_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Inventory Movements Log (Audit for every stock change)
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id),
      movement_type TEXT NOT NULL, -- 'PURCHASE_RECEIVE', 'ORDER_CONSUMPTION', 'WASTE', 'TRANSFER_IN', 'TRANSFER_OUT', 'MANUAL_ADJUSTMENT'
      quantity_change REAL NOT NULL,
      resulting_quantity REAL NOT NULL,
      reference_id TEXT, -- order_id or purchase_id or waste_id
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Suppliers & Purchases
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      tax_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT NOT NULL,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      supplier_id TEXT NOT NULL REFERENCES suppliers(id),
      storekeeper_id TEXT NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'RECEIVED', -- 'DRAFT', 'ORDERED', 'RECEIVED'
      total_cost REAL NOT NULL,
      invoice_number TEXT,
      receiving_date DATE DEFAULT CURRENT_DATE,
      receipt_photo_url TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      purchase_order_id TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL
    );

    -- Waste Records
    CREATE TABLE IF NOT EXISTS waste_records (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      reason TEXT NOT NULL, -- 'Spoiled', 'Expired', 'Burned', 'Damaged', 'Preparation waste', 'Customer return', 'Other'
      photo_url TEXT,
      estimated_cost REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Stock Transfers
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id TEXT PRIMARY KEY,
      transfer_number TEXT NOT NULL,
      source_branch_id TEXT NOT NULL REFERENCES branches(id),
      destination_branch_id TEXT NOT NULL REFERENCES branches(id),
      requested_by_id TEXT NOT NULL REFERENCES users(id),
      approved_by_id TEXT REFERENCES users(id),
      status TEXT DEFAULT 'COMPLETED', -- 'REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS stock_transfer_items (
      id TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
      ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
      quantity REAL NOT NULL
    );

    -- Operational Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      branch_id TEXT NOT NULL REFERENCES branches(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      category TEXT NOT NULL, -- 'Food purchases', 'Beverages', 'Salaries', 'Electricity', 'Water', 'Rent', 'Transportation', 'Maintenance', 'Cleaning', 'Equipment', 'Marketing', 'Other'
      amount REAL NOT NULL,
      expense_date DATE NOT NULL,
      description TEXT NOT NULL,
      receipt_photo_url TEXT,
      supplier_id TEXT REFERENCES suppliers(id),
      reference_number TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Employee Attendance (Clock in / Clock out)
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      clock_in DATETIME NOT NULL,
      clock_out DATETIME,
      total_hours REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- System Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      branch_id TEXT REFERENCES branches(id),
      target_role TEXT, -- 'owner', 'admin', 'cashier', 'chef', 'barista', 'waiter', 'storekeeper' or 'all'
      target_user_id TEXT REFERENCES users(id),
      title TEXT NOT NULL,
      title_amharic TEXT,
      message TEXT NOT NULL,
      message_amharic TEXT,
      type TEXT NOT NULL, -- 'ORDER_NEW', 'ORDER_READY', 'LOW_STOCK', 'USER_PENDING', 'EXPENSE', 'INFO'
      link_ref TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- System Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      branch_id TEXT REFERENCES branches(id),
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Restaurant and Branding Settings
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      id TEXT PRIMARY KEY,
      restaurant_name TEXT NOT NULL DEFAULT 'GourmetOS Restaurant & Lounge',
      slogan TEXT DEFAULT 'Exquisite Taste & Seamless Hospitality',
      logo_url TEXT,
      primary_color TEXT DEFAULT '#f97316',
      secondary_color TEXT DEFAULT '#0f172a',
      vat_enabled INTEGER DEFAULT 1,
      vat_percentage REAL DEFAULT 15.0,
      tax_number TEXT DEFAULT 'TIN-0098471201',
      receipt_footer TEXT DEFAULT 'Thank you for dining with us! Come again soon.',
      receipt_footer_amharic TEXT DEFAULT 'ስለመረጡን እናመሰግናለን! እንደገና ይምጡ።',
      default_currency TEXT DEFAULT 'ETB',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Atomic Order Number Generation Counter
    CREATE TABLE IF NOT EXISTS order_counters (
      branch_id TEXT NOT NULL,
      counter_date DATE NOT NULL,
      last_number INTEGER DEFAULT 100,
      PRIMARY KEY (branch_id, counter_date)
    );

    -- Performance Indexes
    CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
    CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_inventory_branch ON inventory_stock(branch_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_ingredient ON inventory_stock(ingredient_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON audit_logs(branch_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_movements_branch ON inventory_movements(branch_id);
  `;
    db.exec(schema);
    runMigrations();
}
export function runMigrations() {
    const migrations = [
        // Soft deletes
        "ALTER TABLE users ADD COLUMN deleted_at DATETIME",
        "ALTER TABLE restaurant_tables ADD COLUMN deleted_at DATETIME",
        "ALTER TABLE menu_items ADD COLUMN deleted_at DATETIME",
        // Security and auth
        "ALTER TABLE users ADD COLUMN pin_attempts INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN pin_locked_until DATETIME",
        "ALTER TABLE users ADD COLUMN reset_token TEXT",
        "ALTER TABLE users ADD COLUMN reset_expiry DATETIME",
        // Inventory purchase order receipt details (DATE without non-constant DEFAULT to support all SQLite versions)
        "ALTER TABLE purchase_orders ADD COLUMN receiving_date DATE",
        "ALTER TABLE purchase_orders ADD COLUMN receipt_photo_url TEXT",
        // Operational expenses columns
        "ALTER TABLE expenses ADD COLUMN receipt_photo_url TEXT",
        "ALTER TABLE expenses ADD COLUMN supplier_id TEXT",
        "ALTER TABLE expenses ADD COLUMN reference_number TEXT"
    ];
    for (const sql of migrations) {
        try {
            db.exec(sql);
            console.log(`[Migration] ✓ Executed: ${sql}`);
        }
        catch (_) {
            // Column already exists or table not yet initialized
        }
    }
    // Backfill receiving_date on existing purchase orders if null
    try {
        db.exec("UPDATE purchase_orders SET receiving_date = date(created_at) WHERE receiving_date IS NULL");
    }
    catch (_) { }
}
