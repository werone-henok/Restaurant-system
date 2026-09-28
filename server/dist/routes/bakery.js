import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';
import { notifyRoles } from '../services/notificationService.js';
import { requestDebouncedSync } from '../services/cloudSyncService.js';
import { v4 as uuidv4 } from 'uuid';
export const bakeryRouter = Router();
function getBranch(req) {
    const queryBranch = req.query.branchId;
    if (queryBranch && queryBranch !== 'ALL')
        return queryBranch;
    return req.user?.branch_id || 'branch_addis';
}
// ─────────────────────────────────────────────────────────────────────────────
// 1. PRODUCTS & VARIATIONS
// ─────────────────────────────────────────────────────────────────────────────
// Get all bakery products with variations and stock
bakeryRouter.get('/products', authenticate, (req, res) => {
    const branchId = getBranch(req);
    const category = req.query.category;
    const search = (req.query.search || '').trim().toLowerCase();
    let sql = `SELECT * FROM bakery_products WHERE is_active = 1`;
    const params = [];
    if (category && category !== 'ALL') {
        sql += ` AND category = ?`;
        params.push(category);
    }
    if (search) {
        sql += ` AND (LOWER(name) LIKE ? OR LOWER(COALESCE(name_amharic, '')) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    sql += ` ORDER BY name ASC`;
    const products = db.prepare(sql).all(...params);
    const getVariations = db.prepare(`
    SELECT v.*,
      v.variation_name as name,
      v.price as selling_price,
      CASE
        WHEN v.counter_stock <= 0 THEN 'OUT_OF_STOCK'
        WHEN v.counter_stock <= v.min_stock_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END as stock_status
    FROM bakery_product_variations v
    WHERE v.product_id = ? AND v.is_available = 1
    ORDER BY v.price ASC
  `);
    const populated = products.map(p => ({
        ...p,
        variations: getVariations.all(p.id)
    }));
    res.json(populated);
});
// Get single product with variations
bakeryRouter.get('/products/:id', authenticate, (req, res) => {
    const product = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(req.params.id);
    if (!product)
        return res.status(404).json({ error: 'Product not found' });
    const variations = db.prepare(`
    SELECT v.*,
      v.variation_name as name,
      v.price as selling_price,
      CASE
        WHEN v.counter_stock <= 0 THEN 'OUT_OF_STOCK'
        WHEN v.counter_stock <= v.min_stock_level THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
      END as stock_status
    FROM bakery_product_variations v
    WHERE v.product_id = ?
    ORDER BY v.price ASC
  `).all(product.id);
    res.json({ ...product, variations });
});
// Create product (Bakery, Admin, Owner)
bakeryRouter.post('/products', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { name, name_amharic, description, category, photo_url } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Product name is required' });
    }
    const id = `bp_${uuidv4().substring(0, 8)}`;
    db.prepare(`
    INSERT INTO bakery_products (id, name, name_amharic, description, category, photo_url, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(id, name.trim(), name_amharic?.trim() || null, description?.trim() || null, category || 'Cake', photo_url || null);
    logAudit({
        branchId: getBranch(req),
        userId: req.user.id,
        action: 'BAKERY_PRODUCT_CREATED',
        entityType: 'BAKERY_PRODUCT',
        entityId: id,
        details: { name, category: category || 'Cake' }
    });
    requestDebouncedSync();
    const created = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(id);
    res.status(201).json(created);
});
// Update product (Bakery, Admin, Owner)
bakeryRouter.put('/products/:id', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { name, name_amharic, description, category, photo_url, is_active } = req.body;
    const existing = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(req.params.id);
    if (!existing)
        return res.status(404).json({ error: 'Product not found' });
    db.prepare(`
    UPDATE bakery_products
    SET name = COALESCE(?, name),
        name_amharic = COALESCE(?, name_amharic),
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        photo_url = COALESCE(?, photo_url),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name ?? null, name_amharic ?? null, description ?? null, category ?? null, photo_url ?? null, is_active !== undefined ? (is_active ? 1 : 0) : null, req.params.id);
    requestDebouncedSync();
    const updated = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(req.params.id);
    res.json(updated);
});
// Create complete cake with variations (Bakery, Admin, Owner)
bakeryRouter.post('/complete-cake', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { name, name_amharic, description, category, photo_url, variations } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Product name is required' });
    }
    const productId = `bp_${uuidv4().substring(0, 8)}`;
    const tx = db.transaction(() => {
        db.prepare(`
      INSERT INTO bakery_products (id, name, name_amharic, description, category, photo_url, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(productId, name.trim(), name_amharic?.trim() || null, description?.trim() || null, category || 'Cake', photo_url || null);
        // Ensure a "Bakery & Desserts" menu category exists for Waiter POS
        let cat = db.prepare("SELECT id FROM menu_categories WHERE name = 'Bakery & Pastries' OR name = 'Cakes & Bakery' OR name = 'Bakery & Cakes' LIMIT 1").get();
        if (!cat) {
            const catId = `cat_bakery_${uuidv4().substring(0, 6)}`;
            db.prepare(`
        INSERT INTO menu_categories (id, name, name_amharic, icon, sort_order, is_active)
        VALUES (?, 'Bakery & Cakes', 'ኬክና ዳቦ መጋገሪያ', 'Cake', 6, 1)
      `).run(catId);
            cat = { id: catId };
        }
        const vars = Array.isArray(variations) && variations.length > 0
            ? variations
            : [{ variation_name: 'Single Slice', size: 'Slice', price: 150, min_stock_level: 5 }];
        for (const v of vars) {
            const varId = `bpv_${uuidv4().substring(0, 8)}`;
            const price = Number(v.price || 150);
            db.prepare(`
        INSERT INTO bakery_product_variations (
          id, product_id, variation_name, flavor_type, size, weight_kg, price,
          min_stock_level, bakery_stock, counter_stock, in_transit_stock, photo_url, is_available
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 1)
      `).run(varId, productId, v.variation_name?.trim() || 'Standard', v.flavor_type || null, v.size?.trim() || null, v.weight_kg ? Number(v.weight_kg) : null, price, v.min_stock_level !== undefined ? Number(v.min_stock_level) : 3, v.photo_url || photo_url || null);
            // Auto-create menu item for waiter POS
            const menuItemName = `${name.trim()} - ${v.variation_name}`;
            const menuItemAmharic = name_amharic ? `${name_amharic} (${v.variation_name})` : null;
            const menuItemId = `menu_bakery_${varId.substring(4)}`;
            db.prepare(`
        INSERT INTO menu_items (id, category_id, name, name_amharic, description, price, photo_url, prep_time_minutes, routing_destination, is_available, bakery_variation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, 5, 'FRONT_COUNTER', 1, ?)
        ON CONFLICT(id) DO UPDATE SET price = excluded.price, photo_url = excluded.photo_url
      `).run(menuItemId, cat.id, menuItemName, menuItemAmharic, `${description || ''} (${v.size || ''})`.trim(), price, v.photo_url || photo_url || null, varId);
        }
    });
    tx();
    logAudit({
        branchId: getBranch(req),
        userId: req.user.id,
        action: 'BAKERY_PRODUCT_CREATED',
        entityType: 'BAKERY_PRODUCT',
        entityId: productId,
        details: { name, category: category || 'Cake' }
    });
    requestDebouncedSync();
    const created = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(productId);
    res.status(201).json(created);
});
// Delete product (Admin, Owner ONLY - Bakery staff cannot delete)
bakeryRouter.delete('/products/:id', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(id);
    if (!existing)
        return res.status(404).json({ error: 'Product not found' });
    // Soft delete / deactivate
    db.prepare('UPDATE bakery_products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    db.prepare('UPDATE bakery_product_variations SET is_available = 0, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?').run(id);
    db.prepare('UPDATE menu_items SET is_available = 0 WHERE bakery_variation_id IN (SELECT id FROM bakery_product_variations WHERE product_id = ?)').run(id);
    logAudit({
        branchId: getBranch(req),
        userId: req.user.id,
        action: 'BAKERY_PRODUCT_DELETED',
        entityType: 'BAKERY_PRODUCT',
        entityId: id,
        details: { name: existing.name, deletedBy: req.user.full_name }
    });
    requestDebouncedSync();
    res.json({ message: 'Product successfully deleted', id });
});
// Create product variation (Bakery, Admin, Owner)
bakeryRouter.post('/products/:productId/variations', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { productId } = req.params;
    const { variation_name, flavor_type, size, weight_kg, price, min_stock_level, photo_url } = req.body;
    const product = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(productId);
    if (!product)
        return res.status(404).json({ error: 'Parent product not found' });
    if (!variation_name || price === undefined || price === null || Number(price) <= 0) {
        return res.status(400).json({ error: 'Variation name and positive selling price are required' });
    }
    const varId = `bpv_${uuidv4().substring(0, 8)}`;
    const tx = db.transaction(() => {
        db.prepare(`
      INSERT INTO bakery_product_variations (
        id, product_id, variation_name, flavor_type, size, weight_kg, price,
        min_stock_level, bakery_stock, counter_stock, in_transit_stock, photo_url, is_available
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 1)
    `).run(varId, productId, variation_name.trim(), flavor_type?.trim() || null, size?.trim() || null, weight_kg ? Number(weight_kg) : null, Number(price), min_stock_level !== undefined ? Number(min_stock_level) : 3, photo_url || product.photo_url || null);
        // Ensure a "Bakery & Desserts" menu category exists for Waiter POS integration
        let cat = db.prepare("SELECT id FROM menu_categories WHERE name = 'Bakery & Pastries' OR name = 'Cakes & Bakery' LIMIT 1").get();
        if (!cat) {
            const catId = `cat_bakery_${uuidv4().substring(0, 6)}`;
            db.prepare(`
        INSERT INTO menu_categories (id, name, name_amharic, icon, sort_order, is_active)
        VALUES (?, 'Bakery & Cakes', 'ኬክና ዳቦ መጋገሪያ', 'Cake', 6, 1)
      `).run(catId);
            cat = { id: catId };
        }
        // Auto-create or link a menu item for restaurant waiter POS ordering
        const menuItemName = `${product.name} - ${variation_name}`;
        const menuItemAmharic = product.name_amharic ? `${product.name_amharic} (${variation_name})` : null;
        const menuItemId = `menu_bakery_${varId.substring(4)}`;
        db.prepare(`
      INSERT INTO menu_items (id, category_id, name, name_amharic, description, price, photo_url, prep_time_minutes, routing_destination, is_available, bakery_variation_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 5, 'FRONT_COUNTER', 1, ?)
      ON CONFLICT(id) DO UPDATE SET price = excluded.price, photo_url = excluded.photo_url
    `).run(menuItemId, cat.id, menuItemName, menuItemAmharic, `${product.description || ''} (${flavor_type || ''} ${size || ''})`.trim(), Number(price), photo_url || product.photo_url || null, varId);
    });
    tx();
    logAudit({
        branchId: getBranch(req),
        userId: req.user.id,
        action: 'BAKERY_VARIATION_CREATED',
        entityType: 'BAKERY_VARIATION',
        entityId: varId,
        details: { product: product.name, variation: variation_name, price }
    });
    requestDebouncedSync();
    const created = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(varId);
    res.status(201).json(created);
});
// Update variation details (Admin/Owner can change all; Bakery cannot change price directly without suggestion)
bakeryRouter.put('/variations/:id', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(id);
    if (!existing)
        return res.status(404).json({ error: 'Variation not found' });
    const { variation_name, flavor_type, size, weight_kg, price, min_stock_level, photo_url, is_available } = req.body;
    const isManagement = req.user.role === 'admin' || req.user.role === 'owner';
    // If bakery tries to change price directly, enforce price suggestion rule
    if (!isManagement && price !== undefined && Number(price) !== Number(existing.price)) {
        return res.status(403).json({
            error: 'Bakery staff cannot change official selling prices directly. Please submit a price suggestion for Admin/Owner review.'
        });
    }
    const effectivePrice = isManagement && price !== undefined ? Number(price) : existing.price;
    db.prepare(`
    UPDATE bakery_product_variations
    SET variation_name = COALESCE(?, variation_name),
        flavor_type = COALESCE(?, flavor_type),
        size = COALESCE(?, size),
        weight_kg = COALESCE(?, weight_kg),
        price = ?,
        min_stock_level = COALESCE(?, min_stock_level),
        photo_url = COALESCE(?, photo_url),
        is_available = COALESCE(?, is_available),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(variation_name ?? null, flavor_type ?? null, size ?? null, weight_kg !== undefined ? Number(weight_kg) : null, effectivePrice, min_stock_level !== undefined ? Number(min_stock_level) : null, photo_url ?? null, is_available !== undefined ? (is_available ? 1 : 0) : null, id);
    // Sync price with menu item if price was changed by management
    if (isManagement && price !== undefined) {
        db.prepare('UPDATE menu_items SET price = ?, photo_url = COALESCE(?, photo_url) WHERE bakery_variation_id = ?').run(effectivePrice, photo_url ?? null, id);
    }
    requestDebouncedSync();
    const updated = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(id);
    res.json(updated);
});
// ─────────────────────────────────────────────────────────────────────────────
// 2. PRODUCTION WORKFLOW & BATCHES
// ─────────────────────────────────────────────────────────────────────────────
// Create a new production batch (Bakery, Admin, Owner)
bakeryRouter.post('/batches', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { product_id, variation_id, quantity_produced, selling_price, photo_url, production_date, expiration_date, batch_number, notes, mark_ready } = req.body;
    const branchId = getBranch(req);
    if (!product_id || !variation_id || !quantity_produced || Number(quantity_produced) <= 0) {
        return res.status(400).json({ error: 'Product, variation, and positive quantity produced are required' });
    }
    const variation = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(variation_id);
    if (!variation)
        return res.status(404).json({ error: 'Product variation not found' });
    const product = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(product_id);
    const batchId = `bb_${uuidv4().substring(0, 8)}`;
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const finalBatchNumber = batch_number?.trim() || `BATCH-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    // Default expiration date: 3 days for fresh cakes if not provided
    const expDate = expiration_date || new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const prodDate = production_date || now.toISOString();
    const price = selling_price !== undefined ? Number(selling_price) : variation.price;
    const qty = Number(quantity_produced);
    const status = mark_ready ? 'READY' : 'BAKING';
    const tx = db.transaction(() => {
        db.prepare(`
      INSERT INTO bakery_batches (
        id, batch_number, product_id, variation_id, branch_id, produced_by_id,
        quantity_produced, quantity_transferred, quantity_sold, quantity_wasted,
        quantity_remaining, selling_price, photo_url, production_date, expiration_date, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?)
    `).run(batchId, finalBatchNumber, product_id, variation_id, branchId, req.user.id, qty, qty, price, photo_url || variation.photo_url || null, prodDate, expDate, status, notes || null);
        // If marked ready immediately, increase Bakery stock (remains in Bakery until physical transfer)
        if (mark_ready) {
            db.prepare(`
        UPDATE bakery_product_variations
        SET bakery_stock = bakery_stock + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(qty, variation_id);
            const updatedVar = db.prepare('SELECT bakery_stock FROM bakery_product_variations WHERE id = ?').get(variation_id);
            db.prepare(`
        INSERT INTO bakery_inventory_transactions (
          id, branch_id, product_id, variation_id, batch_id, user_id,
          department, transaction_type, quantity_change, resulting_quantity, reference_id, reason
        ) VALUES (?, ?, ?, ?, ?, ?, 'BAKERY', 'PRODUCTION_IN', ?, ?, ?, 'Fresh production ready for sale')
      `).run(uuidv4(), branchId, product_id, variation_id, batchId, req.user.id, qty, updatedVar.bakery_stock, batchId);
        }
    });
    tx();
    logAudit({
        branchId,
        userId: req.user.id,
        action: mark_ready ? 'BAKERY_PRODUCTION_READY' : 'BAKERY_PRODUCTION_STARTED',
        entityType: 'BAKERY_BATCH',
        entityId: batchId,
        details: { batchNumber: finalBatchNumber, product: product?.name, quantity: qty, status }
    });
    broadcastEvent({
        type: 'BAKERY_BATCH_CREATED',
        branchId,
        targetRole: ['bakery', 'front_counter', 'admin', 'owner'],
        payload: { batchId, batchNumber: finalBatchNumber, status, product: product?.name, variation: variation.variation_name, quantity: qty }
    });
    requestDebouncedSync();
    const created = db.prepare('SELECT * FROM bakery_batches WHERE id = ?').get(batchId);
    res.status(201).json(created);
});
// Mark batch ready for sale (Eligible for physical transfer)
bakeryRouter.patch('/batches/:id/ready', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { id } = req.params;
    const batch = db.prepare('SELECT * FROM bakery_batches WHERE id = ?').get(id);
    if (!batch)
        return res.status(404).json({ error: 'Batch not found' });
    if (batch.status === 'READY') {
        return res.json({ message: 'Batch is already marked ready', batch });
    }
    const tx = db.transaction(() => {
        db.prepare("UPDATE bakery_batches SET status = 'READY' WHERE id = ?").run(id);
        // Increase Bakery stock (NOT Front Counter inventory!)
        db.prepare(`
      UPDATE bakery_product_variations
      SET bakery_stock = bakery_stock + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(batch.quantity_remaining, batch.variation_id);
        const updatedVar = db.prepare('SELECT bakery_stock FROM bakery_product_variations WHERE id = ?').get(batch.variation_id);
        db.prepare(`
      INSERT INTO bakery_inventory_transactions (
        id, branch_id, product_id, variation_id, batch_id, user_id,
        department, transaction_type, quantity_change, resulting_quantity, reference_id, reason
      ) VALUES (?, ?, ?, ?, ?, ?, 'BAKERY', 'PRODUCTION_IN', ?, ?, ?, 'Batch marked ready in Bakery')
    `).run(uuidv4(), batch.branch_id, batch.product_id, batch.variation_id, id, req.user.id, batch.quantity_remaining, updatedVar.bakery_stock, id);
    });
    tx();
    notifyRoles({
        branchId: batch.branch_id,
        targetRoles: ['front_counter', 'bakery', 'admin', 'owner'],
        title: '🍰 Fresh Bakery Batch Ready',
        titleAmharic: '🍰 አዲስ የኬክ ምርት ዝግጁ ሆኗል',
        message: `Batch #${batch.batch_number} (${batch.quantity_remaining} units) is ready in Bakery for transfer.`,
        type: 'INFO',
        linkRef: String(id)
    });
    broadcastEvent({
        type: 'BAKERY_BATCH_READY',
        branchId: batch.branch_id,
        payload: { batchId: id, batchNumber: batch.batch_number }
    });
    requestDebouncedSync();
    res.json({ message: 'Batch marked ready for transfer', id });
});
// Get batches (FIFO ordered)
bakeryRouter.get('/batches', authenticate, (req, res) => {
    const branchId = getBranch(req);
    const status = req.query.status;
    let query = `
    SELECT b.*, p.name as product_name, p.name_amharic as product_name_amharic,
           v.variation_name, v.flavor_type, v.size, u.full_name as baker_name,
           CASE
             WHEN date(b.expiration_date) < date('now', 'localtime') THEN 'EXPIRED'
             WHEN date(b.expiration_date) <= date('now', 'localtime', '+2 days') THEN 'EXPIRING_SOON'
             ELSE 'FRESH'
           END as freshness_status
    FROM bakery_batches b
    JOIN bakery_products p ON b.product_id = p.id
    JOIN bakery_product_variations v ON b.variation_id = v.id
    JOIN users u ON b.produced_by_id = u.id
    WHERE b.branch_id = ?
  `;
    const params = [branchId];
    if (status && status !== 'ALL') {
        query += ` AND b.status = ?`;
        params.push(status);
    }
    // FIFO prioritization: oldest production and earliest expiration first
    query += ` ORDER BY b.expiration_date ASC, b.production_date ASC LIMIT 100`;
    const batches = db.prepare(query).all(...params);
    res.json(batches);
});
// ─────────────────────────────────────────────────────────────────────────────
// 3. PHYSICAL TRANSFER WORKFLOW (BAKERY ↔ FRONT CAKE COUNTER)
// ─────────────────────────────────────────────────────────────────────────────
// Initiate Physical Transfer (Bakery sends -> Status PENDING)
bakeryRouter.post('/transfers', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { product_id, variation_id, batch_id, quantity_sent, notes } = req.body;
    const branchId = getBranch(req);
    const qty = Number(quantity_sent);
    if (!variation_id || !qty || qty <= 0) {
        return res.status(400).json({ error: 'Variation and positive quantity sent are required' });
    }
    const variation = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(variation_id);
    if (!variation)
        return res.status(404).json({ error: 'Variation not found' });
    // Prevent negative inventory deduction: must have sufficient bakery stock
    if (variation.bakery_stock < qty) {
        return res.status(400).json({
            error: `Insufficient Bakery inventory. Available in Bakery: ${variation.bakery_stock}, requested transfer: ${qty}`
        });
    }
    const transferId = `trf_${uuidv4().substring(0, 8)}`;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const transferNumber = `TRF-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    const tx = db.transaction(() => {
        // 1. Move stock from bakery_stock to in_transit_stock (Reservation step: prevents double transfers)
        db.prepare(`
      UPDATE bakery_product_variations
      SET bakery_stock = bakery_stock - ?,
          in_transit_stock = in_transit_stock + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(qty, qty, variation_id);
        const updatedVar = db.prepare('SELECT bakery_stock, counter_stock, in_transit_stock FROM bakery_product_variations WHERE id = ?').get(variation_id);
        // 2. Create transfer record
        db.prepare(`
      INSERT INTO bakery_transfers (
        id, transfer_number, branch_id, product_id, variation_id, batch_id,
        quantity_sent, quantity_received, source_department, destination_department,
        created_by_id, sent_by_id, sent_at, status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Bakery', 'Front Cake Counter', ?, ?, CURRENT_TIMESTAMP, 'PENDING', ?)
    `).run(transferId, transferNumber, branchId, variation.product_id, variation_id, batch_id || null, qty, req.user.id, req.user.id, notes || null);
        // 3. Log auditable transfer out transaction
        db.prepare(`
      INSERT INTO bakery_inventory_transactions (
        id, branch_id, product_id, variation_id, batch_id, user_id,
        department, transaction_type, quantity_change, resulting_quantity, reference_id, reason
      ) VALUES (?, ?, ?, ?, ?, ?, 'BAKERY', 'TRANSFER_OUT', ?, ?, ?, ?)
    `).run(uuidv4(), branchId, variation.product_id, variation_id, batch_id || null, req.user.id, -qty, updatedVar.bakery_stock, transferId, `Dispatched to Front Counter (${transferNumber})`);
        // 4. Update batch if specified
        if (batch_id) {
            db.prepare(`
        UPDATE bakery_batches
        SET quantity_transferred = quantity_transferred + ?,
            quantity_remaining = quantity_remaining - ?
        WHERE id = ?
      `).run(qty, qty, batch_id);
        }
    });
    tx();
    logAudit({
        branchId,
        userId: req.user.id,
        action: 'BAKERY_TRANSFER_DISPATCHED',
        entityType: 'BAKERY_TRANSFER',
        entityId: transferId,
        details: { transferNumber, quantity: qty, variation: variation.variation_name }
    });
    // Notify Front Cake Counter to physically receive products
    notifyRoles({
        branchId,
        targetRoles: ['front_counter', 'admin', 'owner'],
        title: '🚚 Cake Delivery Arrived for Confirmation',
        titleAmharic: '🚚 የኬክ ዕቃ ለርክክብ ደርሷል',
        message: `Bakery transferred ${qty} units of ${variation.variation_name} (${transferNumber}). Please physically count and confirm receipt.`,
        type: 'INFO',
        linkRef: transferId
    });
    broadcastEvent({
        type: 'BAKERY_TRANSFER_PENDING',
        branchId,
        targetRole: ['front_counter', 'bakery', 'admin', 'owner'],
        payload: { transferId, transferNumber, quantity: qty }
    });
    requestDebouncedSync();
    const created = db.prepare('SELECT * FROM bakery_transfers WHERE id = ?').get(transferId);
    res.status(201).json(created);
});
// Front Cake Counter explicitly confirms physical receipt
bakeryRouter.patch('/transfers/:id/confirm', authenticate, authorizeRole(['front_counter', 'admin', 'owner']), (req, res) => {
    const { id } = req.params;
    const { quantity_received, notes } = req.body;
    const transfer = db.prepare('SELECT * FROM bakery_transfers WHERE id = ?').get(id);
    if (!transfer)
        return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status === 'RECEIVED' || transfer.status === 'CANCELLED') {
        return res.status(400).json({ error: `Transfer is already in ${transfer.status} state` });
    }
    const qtySent = Number(transfer.quantity_sent);
    const qtyRecv = quantity_received !== undefined ? Number(quantity_received) : qtySent;
    if (qtyRecv < 0 || qtyRecv > qtySent) {
        return res.status(400).json({ error: `Received quantity must be between 0 and sent quantity (${qtySent})` });
    }
    const finalStatus = qtyRecv === qtySent ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
    const discrepancy = qtySent - qtyRecv;
    const tx = db.transaction(() => {
        // 1. Update transfer record
        db.prepare(`
      UPDATE bakery_transfers
      SET status = ?,
          quantity_received = ?,
          received_by_id = ?,
          received_at = CURRENT_TIMESTAMP,
          notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(finalStatus, qtyRecv, req.user.id, notes || null, id);
        // 2. Increase Front Counter inventory by physically received quantity, clear in_transit
        db.prepare(`
      UPDATE bakery_product_variations
      SET counter_stock = counter_stock + ?,
          in_transit_stock = in_transit_stock - ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(qtyRecv, qtySent, transfer.variation_id);
        // If partial receipt, return unreceived discrepancy back to bakery stock (or flag transit loss)
        if (discrepancy > 0) {
            db.prepare(`
        UPDATE bakery_product_variations
        SET bakery_stock = bakery_stock + ?
        WHERE id = ?
      `).run(discrepancy, transfer.variation_id);
        }
        const updatedVar = db.prepare('SELECT counter_stock, bakery_stock FROM bakery_product_variations WHERE id = ?').get(transfer.variation_id);
        // 3. Log auditable transfer in transaction for Front Counter
        db.prepare(`
      INSERT INTO bakery_inventory_transactions (
        id, branch_id, product_id, variation_id, batch_id, user_id,
        department, transaction_type, quantity_change, resulting_quantity, reference_id, reason
      ) VALUES (?, ?, ?, ?, ?, ?, 'FRONT_COUNTER', 'TRANSFER_IN', ?, ?, ?, ?)
    `).run(uuidv4(), transfer.branch_id, transfer.product_id, transfer.variation_id, transfer.batch_id, req.user.id, qtyRecv, updatedVar.counter_stock, id, `Confirmed receipt from Bakery (${transfer.transfer_number})`);
    });
    tx();
    logAudit({
        branchId: transfer.branch_id,
        userId: req.user.id,
        action: 'BAKERY_TRANSFER_RECEIVED',
        entityType: 'BAKERY_TRANSFER',
        entityId: id,
        details: { transferNumber: transfer.transfer_number, qtySent, qtyRecv, status: finalStatus }
    });
    notifyRoles({
        branchId: transfer.branch_id,
        targetRoles: ['bakery', 'admin', 'owner'],
        title: '✅ Transfer Received by Front Counter',
        titleAmharic: '✅ የኬክ ዕቃ በሽያጭ ቆጣሪ ተረክቧል',
        message: `${req.user.full_name} confirmed receipt of ${qtyRecv} cakes (${transfer.transfer_number}). Front Counter inventory updated.`,
        type: 'INFO',
        linkRef: String(id)
    });
    broadcastEvent({
        type: 'BAKERY_STOCK_UPDATED',
        branchId: transfer.branch_id,
        payload: { transferId: id, status: finalStatus }
    });
    requestDebouncedSync();
    res.json({ message: 'Transfer receipt confirmed. Front Counter stock updated.', status: finalStatus, quantityReceived: qtyRecv });
});
// Front Cake Counter rejects transfer
bakeryRouter.patch('/transfers/:id/reject', authenticate, authorizeRole(['front_counter', 'admin', 'owner']), (req, res) => {
    const { id } = req.params;
    const { rejection_reason } = req.body;
    const transfer = db.prepare('SELECT * FROM bakery_transfers WHERE id = ?').get(id);
    if (!transfer)
        return res.status(404).json({ error: 'Transfer not found' });
    if (transfer.status !== 'PENDING' && transfer.status !== 'IN_TRANSIT') {
        return res.status(400).json({ error: `Cannot reject transfer in ${transfer.status} state` });
    }
    const qty = Number(transfer.quantity_sent);
    const tx = db.transaction(() => {
        // Return reserved stock from in_transit back to bakery_stock
        db.prepare(`
      UPDATE bakery_product_variations
      SET bakery_stock = bakery_stock + ?,
          in_transit_stock = in_transit_stock - ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(qty, qty, transfer.variation_id);
        db.prepare(`
      UPDATE bakery_transfers
      SET status = 'REJECTED',
          rejection_reason = ?,
          received_by_id = ?,
          received_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rejection_reason || 'Rejected by Front Counter', req.user.id, id);
    });
    tx();
    logAudit({
        branchId: transfer.branch_id,
        userId: req.user.id,
        action: 'BAKERY_TRANSFER_REJECTED',
        entityType: 'BAKERY_TRANSFER',
        entityId: id,
        details: { transferNumber: transfer.transfer_number, reason: rejection_reason }
    });
    notifyRoles({
        branchId: transfer.branch_id,
        targetRoles: ['bakery', 'admin', 'owner'],
        title: '❌ Transfer Rejected by Front Counter',
        titleAmharic: '❌ የኬክ ዕቃ ዝውውር በቆጣሪው ተቀባይነት አላገኘም',
        message: `Transfer #${transfer.transfer_number} (${qty} units) was rejected: ${rejection_reason || 'Quality or condition issue'}. Stock returned to Bakery.`,
        type: 'LOW_STOCK',
        linkRef: String(id)
    });
    broadcastEvent({
        type: 'BAKERY_STOCK_UPDATED',
        branchId: transfer.branch_id,
        payload: { transferId: id, status: 'REJECTED' }
    });
    requestDebouncedSync();
    res.json({ message: 'Transfer rejected. Inventory returned to Bakery.', id });
});
// List transfers
bakeryRouter.get('/transfers', authenticate, (req, res) => {
    const branchId = getBranch(req);
    const status = req.query.status;
    let query = `
    SELECT t.*, p.name as product_name, v.variation_name, v.flavor_type, v.size,
           u1.full_name as created_by_name, u2.full_name as received_by_name
    FROM bakery_transfers t
    JOIN bakery_products p ON t.product_id = p.id
    JOIN bakery_product_variations v ON t.variation_id = v.id
    JOIN users u1 ON t.created_by_id = u1.id
    LEFT JOIN users u2 ON t.received_by_id = u2.id
    WHERE t.branch_id = ?
  `;
    const params = [branchId];
    if (status && status !== 'ALL') {
        query += ` AND t.status = ?`;
        params.push(status);
    }
    query += ` ORDER BY t.created_at DESC LIMIT 100`;
    const transfers = db.prepare(query).all(...params);
    res.json(transfers);
});
// ─────────────────────────────────────────────────────────────────────────────
// 4. REORDER & BAKE REQUEST SYSTEM (FRONT COUNTER ↔ BAKERY)
// ─────────────────────────────────────────────────────────────────────────────
// Front Counter submits reorder / bake request
bakeryRouter.post('/requests', authenticate, authorizeRole(['front_counter', 'admin', 'owner']), (req, res) => {
    const { product_id, variation_id, quantity_requested, urgency, notes } = req.body;
    const branchId = getBranch(req);
    const qty = Number(quantity_requested);
    if (!variation_id || !qty || qty <= 0) {
        return res.status(400).json({ error: 'Product variation and positive requested quantity are required' });
    }
    const variation = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(variation_id);
    if (!variation)
        return res.status(404).json({ error: 'Variation not found' });
    const product = db.prepare('SELECT * FROM bakery_products WHERE id = ?').get(variation.product_id);
    const reqId = `req_${uuidv4().substring(0, 8)}`;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const reqNumber = `REQ-${dateStr}-${Math.floor(100 + Math.random() * 900)}`;
    db.prepare(`
    INSERT INTO bakery_requests (
      id, request_number, branch_id, product_id, variation_id, requested_by_id,
      current_counter_stock, min_stock_level, quantity_requested, quantity_fulfilled,
      urgency, status, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'REQUESTED', ?)
  `).run(reqId, reqNumber, branchId, variation.product_id, variation_id, req.user.id, variation.counter_stock, variation.min_stock_level, qty, urgency || 'NORMAL', notes || null);
    logAudit({
        branchId,
        userId: req.user.id,
        action: 'BAKERY_REQUEST_CREATED',
        entityType: 'BAKERY_REQUEST',
        entityId: reqId,
        details: { requestNumber: reqNumber, product: product?.name, variation: variation.variation_name, quantity: qty }
    });
    notifyRoles({
        branchId,
        targetRoles: ['bakery', 'admin', 'owner'],
        title: '🧁 Front Cake Counter Requested Bake/Reorder',
        titleAmharic: '🧁 የኬክ ቆጣሪ አዲስ ምርት ጠይቋል',
        message: `Front Cake Counter requested ${qty} units of ${product?.name} (${variation.variation_name}). Current Stock: ${variation.counter_stock}, Min: ${variation.min_stock_level}.`,
        type: 'ORDER_NEW',
        linkRef: reqId
    });
    broadcastEvent({
        type: 'BAKERY_REQUEST_NEW',
        branchId,
        targetRole: ['bakery', 'front_counter', 'admin', 'owner'],
        payload: { requestId: reqId, requestNumber: reqNumber, product: product?.name, variation: variation.variation_name, quantity: qty, urgency: urgency || 'NORMAL' }
    });
    requestDebouncedSync();
    const created = db.prepare('SELECT * FROM bakery_requests WHERE id = ?').get(reqId);
    res.status(201).json(created);
});
// Update request status (Bakery responds: Accept, Start Baking, Ready, Fulfill, Reject)
bakeryRouter.patch('/requests/:id/status', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { id } = req.params;
    const { status, notes, quantity_fulfilled } = req.body;
    const validStatuses = ['ACCEPTED', 'REJECTED', 'IN_PRODUCTION', 'PARTIALLY_FULFILLED', 'READY', 'TRANSFERRED', 'COMPLETED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    const existing = db.prepare('SELECT r.*, p.name as product_name, v.variation_name FROM bakery_requests r JOIN bakery_products p ON r.product_id = p.id JOIN bakery_product_variations v ON r.variation_id = v.id WHERE r.id = ?').get(id);
    if (!existing)
        return res.status(404).json({ error: 'Request not found' });
    db.prepare(`
    UPDATE bakery_requests
    SET status = ?,
        handled_by_id = ?,
        quantity_fulfilled = COALESCE(?, quantity_fulfilled),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, req.user.id, quantity_fulfilled !== undefined ? Number(quantity_fulfilled) : null, notes || null, id);
    notifyRoles({
        branchId: existing.branch_id,
        targetRoles: ['front_counter', 'admin', 'owner'],
        title: `🍰 Bake Request Update: ${status}`,
        titleAmharic: `🍰 የኬክ ትዕዛዝ ሁኔታ: ${status}`,
        message: `Bakery marked request #${existing.request_number} (${existing.product_name}) as ${status}.`,
        type: 'INFO',
        linkRef: String(id)
    });
    broadcastEvent({
        type: 'BAKERY_REQUEST_UPDATED',
        branchId: existing.branch_id,
        payload: { requestId: id, status, requestNumber: existing.request_number }
    });
    requestDebouncedSync();
    res.json({ message: `Request status updated to ${status}`, id, status });
});
// List bake requests
bakeryRouter.get('/requests', authenticate, (req, res) => {
    const branchId = getBranch(req);
    const status = req.query.status;
    let query = `
    SELECT r.*, p.name as product_name, p.photo_url as product_photo,
           v.variation_name, v.flavor_type, v.size, v.price,
           u1.full_name as requested_by_name, u2.full_name as handled_by_name
    FROM bakery_requests r
    JOIN bakery_products p ON r.product_id = p.id
    JOIN bakery_product_variations v ON r.variation_id = v.id
    JOIN users u1 ON r.requested_by_id = u1.id
    LEFT JOIN users u2 ON r.handled_by_id = u2.id
    WHERE r.branch_id = ?
  `;
    const params = [branchId];
    if (status && status !== 'ALL') {
        query += ` AND r.status = ?`;
        params.push(status);
    }
    query += ` ORDER BY CASE r.urgency WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END, r.created_at DESC LIMIT 100`;
    const requests = db.prepare(query).all(...params);
    res.json(requests);
});
// ─────────────────────────────────────────────────────────────────────────────
// 5. FRONT COUNTER PHYSICAL STOCK COUNTING & DISCREPANCY AUDITS
// ─────────────────────────────────────────────────────────────────────────────
// Record physical count and auto-adjust with reason
bakeryRouter.post('/stock-count', authenticate, authorizeRole(['front_counter', 'admin', 'owner']), (req, res) => {
    const { variation_id, physical_quantity, reason, notes } = req.body;
    const branchId = getBranch(req);
    const physQty = Number(physical_quantity);
    if (!variation_id || physQty < 0) {
        return res.status(400).json({ error: 'Variation ID and non-negative physical quantity are required' });
    }
    const variation = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(variation_id);
    if (!variation)
        return res.status(404).json({ error: 'Product variation not found' });
    const product = db.prepare('SELECT name FROM bakery_products WHERE id = ?').get(variation.product_id);
    const systemQty = Number(variation.counter_stock);
    const discrepancy = physQty - systemQty;
    if (discrepancy !== 0 && (!reason || !reason.trim())) {
        return res.status(400).json({ error: 'An adjustment reason is mandatory when there is an inventory discrepancy' });
    }
    const countId = `sc_${uuidv4().substring(0, 8)}`;
    const tx = db.transaction(() => {
        // 1. Record stock count audit
        db.prepare(`
      INSERT INTO bakery_stock_counts (
        id, branch_id, counted_by_id, product_id, variation_id,
        system_quantity, physical_quantity, discrepancy, reason, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(countId, branchId, req.user.id, variation.product_id, variation_id, systemQty, physQty, discrepancy, reason || 'Count verified accurate', notes || null);
        // 2. Adjust Front Counter stock to match verified physical count
        db.prepare(`
      UPDATE bakery_product_variations
      SET counter_stock = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(physQty, variation_id);
        // 3. Log transaction if discrepancy exists
        if (discrepancy !== 0) {
            db.prepare(`
        INSERT INTO bakery_inventory_transactions (
          id, branch_id, product_id, variation_id, batch_id, user_id,
          department, transaction_type, quantity_change, resulting_quantity, reference_id, reason
        ) VALUES (?, ?, ?, ?, NULL, ?, 'FRONT_COUNTER', 'DISCREPANCY_ADJUSTMENT', ?, ?, ?, ?)
      `).run(uuidv4(), branchId, variation.product_id, variation_id, req.user.id, discrepancy, physQty, countId, `Physical count adjustment: ${reason} (Diff: ${discrepancy})`);
        }
    });
    tx();
    logAudit({
        branchId,
        userId: req.user.id,
        action: 'BAKERY_STOCK_COUNTED',
        entityType: 'BAKERY_STOCK_COUNT',
        entityId: countId,
        details: { product: product?.name, variation: variation.variation_name, systemQty, physQty, discrepancy, reason }
    });
    if (discrepancy !== 0) {
        notifyRoles({
            branchId,
            targetRoles: ['admin', 'owner'],
            title: '⚠️ Cake Inventory Discrepancy Recorded',
            titleAmharic: '⚠️ በኬክ ቆጠራ ላይ ልዩነት ተመዝግቧል',
            message: `${req.user.full_name} recorded physical count for ${product?.name} (${variation.variation_name}). System: ${systemQty}, Physical: ${physQty} (Difference: ${discrepancy}). Reason: ${reason}`,
            type: 'LOW_STOCK',
            linkRef: countId
        });
    }
    broadcastEvent({
        type: 'BAKERY_STOCK_UPDATED',
        branchId,
        payload: { variationId: variation_id, newStock: physQty }
    });
    requestDebouncedSync();
    res.json({ message: 'Stock count recorded successfully', countId, systemQuantity: systemQty, physicalQuantity: physQty, discrepancy });
});
// ─────────────────────────────────────────────────────────────────────────────
// 6. PRICE SUGGESTIONS WORKFLOW
// ─────────────────────────────────────────────────────────────────────────────
// Bakery submits price suggestion
bakeryRouter.post('/price-suggestions', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    const { variation_id, suggested_price, reason } = req.body;
    const branchId = getBranch(req);
    const price = Number(suggested_price);
    if (!variation_id || !price || price <= 0 || !reason || !reason.trim()) {
        return res.status(400).json({ error: 'Variation ID, positive suggested price, and justification reason are required' });
    }
    const variation = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(variation_id);
    if (!variation)
        return res.status(404).json({ error: 'Product variation not found' });
    const product = db.prepare('SELECT name FROM bakery_products WHERE id = ?').get(variation.product_id);
    const id = `ps_${uuidv4().substring(0, 8)}`;
    db.prepare(`
    INSERT INTO bakery_price_suggestions (
      id, branch_id, variation_id, suggested_by_id, current_price,
      suggested_price, reason, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
  `).run(id, branchId, variation_id, req.user.id, variation.price, price, reason.trim());
    notifyRoles({
        branchId,
        targetRoles: ['admin', 'owner'],
        title: '💡 Bakery Price Change Suggestion',
        titleAmharic: '💡 የዳቦ መጋገሪያ ዋጋ ማሻሻያ ጥያቄ',
        message: `${req.user.full_name} suggested price change for ${product?.name} (${variation.variation_name}): ${variation.price} ETB ➔ ${price} ETB. Reason: ${reason}`,
        type: 'INFO',
        linkRef: String(id)
    });
    logAudit({
        branchId,
        userId: req.user.id,
        action: 'BAKERY_PRICE_SUGGESTED',
        entityType: 'BAKERY_PRICE_SUGGESTION',
        entityId: id,
        details: { product: product?.name, currentPrice: variation.price, suggestedPrice: price, reason }
    });
    requestDebouncedSync();
    res.status(201).json({ message: 'Price suggestion submitted for Owner/Admin review', id });
});
// Admin / Owner reviews price suggestion
bakeryRouter.patch('/price-suggestions/:id/review', authenticate, authorizeRole(['admin', 'owner']), (req, res) => {
    const { id } = req.params;
    const { decision, approved_price, review_notes } = req.body;
    if (!['APPROVED', 'REJECTED', 'MODIFIED'].includes(decision)) {
        return res.status(400).json({ error: "Decision must be 'APPROVED', 'REJECTED', or 'MODIFIED'" });
    }
    const suggestion = db.prepare(`
    SELECT ps.*, v.product_id, v.variation_name, p.name as product_name
    FROM bakery_price_suggestions ps
    JOIN bakery_product_variations v ON ps.variation_id = v.id
    JOIN bakery_products p ON v.product_id = p.id
    WHERE ps.id = ?
  `).get(id);
    if (!suggestion)
        return res.status(404).json({ error: 'Price suggestion not found' });
    const finalPrice = decision === 'APPROVED' ? suggestion.suggested_price : (approved_price ? Number(approved_price) : suggestion.current_price);
    const tx = db.transaction(() => {
        db.prepare(`
      UPDATE bakery_price_suggestions
      SET status = ?,
          reviewed_by_id = ?,
          approved_price = ?,
          review_notes = ?,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(decision, req.user.id, decision !== 'REJECTED' ? finalPrice : null, review_notes || null, id);
        // If approved or modified, update variation official selling price
        if (decision === 'APPROVED' || decision === 'MODIFIED') {
            db.prepare(`
        UPDATE bakery_product_variations
        SET price = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(finalPrice, suggestion.variation_id);
            // Sync menu item price
            db.prepare('UPDATE menu_items SET price = ? WHERE bakery_variation_id = ?').run(finalPrice, suggestion.variation_id);
        }
    });
    tx();
    notifyRoles({
        branchId: suggestion.branch_id,
        targetRoles: ['bakery', 'admin', 'owner'],
        title: `📋 Price Suggestion ${decision}`,
        titleAmharic: `📋 የዋጋ ማሻሻያ ጥያቄ ${decision}`,
        message: `Price suggestion for ${suggestion.product_name} (${suggestion.variation_name}) was ${decision.toLowerCase()} by ${req.user.full_name}. New Price: ${decision !== 'REJECTED' ? finalPrice + ' ETB' : 'Unchanged'}.`,
        type: 'INFO',
        linkRef: String(id)
    });
    logAudit({
        branchId: suggestion.branch_id,
        userId: req.user.id,
        action: `BAKERY_PRICE_SUGGESTION_${decision}`,
        entityType: 'BAKERY_PRICE_SUGGESTION',
        entityId: id,
        details: { decision, finalPrice, notes: review_notes }
    });
    requestDebouncedSync();
    res.json({ message: `Price suggestion reviewed: ${decision}`, decision, finalPrice });
});
// List price suggestions
bakeryRouter.get('/price-suggestions', authenticate, (req, res) => {
    const branchId = getBranch(req);
    const status = req.query.status;
    let query = `
    SELECT ps.*, p.name as product_name, v.variation_name,
           u1.full_name as suggested_by_name, u2.full_name as reviewed_by_name
    FROM bakery_price_suggestions ps
    JOIN bakery_product_variations v ON ps.variation_id = v.id
    JOIN bakery_products p ON v.product_id = p.id
    JOIN users u1 ON ps.suggested_by_id = u1.id
    LEFT JOIN users u2 ON ps.reviewed_by_id = u2.id
    WHERE ps.branch_id = ?
  `;
    const params = [branchId];
    if (status && status !== 'ALL') {
        query += ` AND ps.status = ?`;
        params.push(status);
    }
    query += ` ORDER BY ps.created_at DESC LIMIT 50`;
    const suggestions = db.prepare(query).all(...params);
    res.json(suggestions);
});
// ─────────────────────────────────────────────────────────────────────────────
// 7. DIRECT SALES (FRONT COUNTER WALK-IN SALES)
// ─────────────────────────────────────────────────────────────────────────────
// Process direct walk-in cake sale at Front Counter
bakeryRouter.post('/sales/direct', authenticate, authorizeRole(['front_counter', 'cashier', 'admin', 'owner']), (req, res) => {
    const { items, payment_method, customer_name, customer_phone, notes } = req.body;
    const branchId = getBranch(req);
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one cake item is required for a direct sale' });
    }
    const receiptNumber = `CAKE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    let totalAmount = 0;
    const processedItems = [];
    const lowStockWarnings = [];
    const tx = db.transaction(() => {
        for (const it of items) {
            const variation = db.prepare(`
        SELECT v.*, p.name as product_name
        FROM bakery_product_variations v
        JOIN bakery_products p ON v.product_id = p.id
        WHERE v.id = ?
      `).get(it.variation_id);
            if (!variation)
                throw new Error(`Variation ${it.variation_id} not found`);
            const qty = Number(it.quantity);
            if (qty <= 0)
                throw new Error('Quantity must be greater than zero');
            // STRICT OUT-OF-STOCK PREVENTER: Do not allow negative inventory!
            if (variation.counter_stock < qty) {
                throw new Error(`Out of stock! "${variation.product_name} (${variation.variation_name})" only has ${variation.counter_stock} available at Front Counter.`);
            }
            const unitPrice = it.price !== undefined ? Number(it.price) : variation.price;
            const lineTotal = unitPrice * qty;
            totalAmount += lineTotal;
            const newStock = variation.counter_stock - qty;
            // Deduct Front Counter stock
            db.prepare(`
        UPDATE bakery_product_variations
        SET counter_stock = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newStock, it.variation_id);
            // Record auditable sale deduction
            db.prepare(`
        INSERT INTO bakery_inventory_transactions (
          id, branch_id, product_id, variation_id, batch_id, user_id,
          department, transaction_type, quantity_change, resulting_quantity, reference_id, reason
        ) VALUES (?, ?, ?, ?, NULL, ?, 'FRONT_COUNTER', 'SALE_DEDUCTION', ?, ?, ?, ?)
      `).run(uuidv4(), branchId, variation.product_id, it.variation_id, req.user.id, -qty, newStock, receiptNumber, `Front Counter Direct Sale (${receiptNumber})`);
            processedItems.push({
                product_name: variation.product_name,
                variation_name: variation.variation_name,
                quantity: qty,
                unit_price: unitPrice,
                line_total: lineTotal
            });
            if (newStock <= variation.min_stock_level) {
                lowStockWarnings.push(`${variation.product_name} (${variation.variation_name}) is now ${newStock <= 0 ? 'OUT OF STOCK' : 'LOW STOCK'} (${newStock} remaining)`);
            }
        }
    });
    try {
        tx();
    }
    catch (err) {
        return res.status(400).json({ error: err.message });
    }
    logAudit({
        branchId,
        userId: req.user.id,
        action: 'BAKERY_DIRECT_SALE',
        entityType: 'BAKERY_SALE',
        entityId: receiptNumber,
        details: { receiptNumber, totalAmount, paymentMethod: payment_method || 'CASH', itemsCount: processedItems.length }
    });
    if (lowStockWarnings.length > 0) {
        notifyRoles({
            branchId,
            targetRoles: ['bakery', 'front_counter', 'admin', 'owner'],
            title: '⚠️ Low Cake Inventory Alert',
            titleAmharic: '⚠️ የኬክ ክምችት ዝቅ ብሏል',
            message: lowStockWarnings.join('. '),
            type: 'LOW_STOCK'
        });
    }
    broadcastEvent({
        type: 'BAKERY_STOCK_UPDATED',
        branchId,
        payload: { receiptNumber, totalAmount }
    });
    requestDebouncedSync();
    res.status(201).json({
        message: 'Sale completed successfully',
        receiptNumber,
        date: new Date().toISOString(),
        totalAmount,
        paymentMethod: payment_method || 'CASH',
        cashierName: req.user.full_name,
        customerName: customer_name || 'Walk-in Customer',
        items: processedItems,
        warnings: lowStockWarnings
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 8. RESTAURANT ORDERS INTEGRATION (WAITER ↔ CASHIER ↔ FRONT CAKE COUNTER)
// ─────────────────────────────────────────────────────────────────────────────
// Front Cake Counter view for active cake items from restaurant orders
bakeryRouter.get('/orders/cake-queue', authenticate, authorizeRole(['front_counter', 'cashier', 'bakery', 'admin', 'owner']), (req, res) => {
    const branchId = getBranch(req);
    const query = `
    SELECT oi.*, o.order_number, o.order_type, o.status as order_status,
           o.special_notes, t.table_number, t.name as table_name,
           u.full_name as waiter_name, mi.name as menu_name, mi.name_amharic, mi.photo_url
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    LEFT JOIN restaurant_tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.waiter_id = u.id
    WHERE o.branch_id = ?
      AND o.status IN ('CONFIRMED', 'PREPARING', 'PARTIALLY_READY')
      AND (oi.routing_destination IN ('FRONT_COUNTER', 'BAKERY') OR mi.category_id LIKE '%cake%' OR mi.category_id LIKE '%bakery%')
    ORDER BY o.created_at ASC
  `;
    const cakeItems = db.prepare(query).all(branchId);
    res.json(cakeItems);
});
// Front Cake Counter marks cake item prepared / ready for waiter pickup
bakeryRouter.patch('/orders/cake-queue/:itemId/ready', authenticate, authorizeRole(['front_counter', 'bakery', 'admin', 'owner']), (req, res) => {
    const { itemId } = req.params;
    const item = db.prepare(`
    SELECT oi.*, o.order_number, o.branch_id, o.waiter_id, mi.name as menu_name
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.id = ?
  `).get(itemId);
    if (!item)
        return res.status(404).json({ error: 'Order item not found' });
    db.prepare(`
    UPDATE order_items
    SET status = 'READY',
        prepared_by_id = ?,
        ready_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.id, itemId);
    // Notify Waiter in real time that their cake is ready at Front Cake Counter
    notifyRoles({
        branchId: item.branch_id,
        targetRoles: ['waiter', 'admin', 'owner'],
        title: '🎂 Cake Ready for Pickup',
        titleAmharic: '🎂 ኬክ ለርክክብ ዝግጁ ሆኗል',
        message: `Order #${item.order_number}: "${item.menu_name}" is packaged and ready at the Front Cake Counter!`,
        type: 'ORDER_READY',
        linkRef: item.order_id
    });
    broadcastEvent({
        type: 'ORDER_READY',
        branchId: item.branch_id,
        targetRole: ['waiter', 'cashier'],
        payload: { orderId: item.order_id, orderNumber: item.order_number, itemName: item.menu_name }
    });
    res.json({ message: 'Cake marked ready for pickup', itemId });
});
// ─────────────────────────────────────────────────────────────────────────────
// 9. WASTE, LOSS & RETURNS
// ─────────────────────────────────────────────────────────────────────────────
// Log waste / spoilage / damage (Bakery or Front Counter)
bakeryRouter.post('/waste', authenticate, authorizeRole(['bakery', 'front_counter', 'admin', 'owner']), (req, res) => {
    const { department, variation_id, batch_id, quantity, reason, notes, photo_url } = req.body;
    const branchId = getBranch(req);
    const dept = department || (req.user.role === 'bakery' ? 'BAKERY' : 'FRONT_COUNTER');
    const qty = Number(quantity);
    if (!variation_id || !qty || qty <= 0 || !reason) {
        return res.status(400).json({ error: 'Variation ID, positive quantity, and loss reason are required' });
    }
    const variation = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(variation_id);
    if (!variation)
        return res.status(404).json({ error: 'Variation not found' });
    const product = db.prepare('SELECT name FROM bakery_products WHERE id = ?').get(variation.product_id);
    const currentDeptStock = dept === 'BAKERY' ? variation.bakery_stock : variation.counter_stock;
    if (currentDeptStock < qty) {
        return res.status(400).json({ error: `Cannot record waste of ${qty}. Available in ${dept}: ${currentDeptStock}` });
    }
    const wasteId = `bw_${uuidv4().substring(0, 8)}`;
    const estCost = qty * (variation.price * 0.4); // estimated ingredient cost
    const tx = db.transaction(() => {
        // 1. Deduct stock from appropriate department
        if (dept === 'BAKERY') {
            db.prepare('UPDATE bakery_product_variations SET bakery_stock = bakery_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qty, variation_id);
        }
        else {
            db.prepare('UPDATE bakery_product_variations SET counter_stock = counter_stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qty, variation_id);
        }
        const updatedVar = db.prepare('SELECT bakery_stock, counter_stock FROM bakery_product_variations WHERE id = ?').get(variation_id);
        const newStock = dept === 'BAKERY' ? updatedVar.bakery_stock : updatedVar.counter_stock;
        // 2. Record waste entry
        db.prepare(`
      INSERT INTO bakery_waste_records (
        id, branch_id, product_id, variation_id, batch_id, user_id,
        department, quantity, reason, notes, photo_url, estimated_cost
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(wasteId, branchId, variation.product_id, variation_id, batch_id || null, req.user.id, dept, qty, reason, notes || null, photo_url || null, estCost);
        // 3. Record auditable ledger entry
        db.prepare(`
      INSERT INTO bakery_inventory_transactions (
        id, branch_id, product_id, variation_id, batch_id, user_id,
        department, transaction_type, quantity_change, resulting_quantity, reference_id, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'WASTE', ?, ?, ?, ?)
    `).run(uuidv4(), branchId, variation.product_id, variation_id, batch_id || null, req.user.id, dept, -qty, newStock, wasteId, `Waste (${reason})`);
    });
    tx();
    logAudit({
        branchId,
        userId: req.user.id,
        action: 'BAKERY_WASTE_RECORDED',
        entityType: 'BAKERY_WASTE',
        entityId: wasteId,
        details: { department: dept, product: product?.name, variation: variation.variation_name, quantity: qty, reason }
    });
    notifyRoles({
        branchId,
        targetRoles: ['admin', 'owner'],
        title: '⚠️ Cake Spoilage / Damage Loss',
        titleAmharic: '⚠️ የኬክ ብክነት / ብልሽት ተመዝግቧል',
        message: `${req.user.full_name} logged ${qty} wasted units of ${product?.name} (${variation.variation_name}) in ${dept}. Reason: ${reason}.`,
        type: 'LOW_STOCK',
        linkRef: wasteId
    });
    broadcastEvent({
        type: 'BAKERY_STOCK_UPDATED',
        branchId,
        payload: { variationId: variation_id }
    });
    requestDebouncedSync();
    res.status(201).json({ message: 'Waste recorded and inventory deducted', wasteId });
});
// Process product return
bakeryRouter.post('/returns', authenticate, authorizeRole(['front_counter', 'cashier', 'admin', 'owner']), (req, res) => {
    const { variation_id, order_id, quantity, reason, condition, returned_to_sellable_stock, notes } = req.body;
    const branchId = getBranch(req);
    const qty = Number(quantity);
    if (!variation_id || !qty || qty <= 0 || !reason || !condition) {
        return res.status(400).json({ error: 'Variation ID, quantity, reason, and condition are required' });
    }
    const variation = db.prepare('SELECT * FROM bakery_product_variations WHERE id = ?').get(variation_id);
    if (!variation)
        return res.status(404).json({ error: 'Variation not found' });
    const isSellable = Boolean(returned_to_sellable_stock && condition === 'Intact/Safe');
    const returnId = `ret_${uuidv4().substring(0, 8)}`;
    const tx = db.transaction(() => {
        db.prepare(`
      INSERT INTO bakery_returns (
        id, branch_id, product_id, variation_id, order_id, user_id,
        quantity, reason, condition, returned_to_sellable_stock, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(returnId, branchId, variation.product_id, variation_id, order_id || null, req.user.id, qty, reason, condition, isSellable ? 1 : 0, notes || null);
        // If safe and sellable, restore to Front Counter inventory
        if (isSellable) {
            db.prepare(`
        UPDATE bakery_product_variations
        SET counter_stock = counter_stock + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(qty, variation_id);
            const updatedVar = db.prepare('SELECT counter_stock FROM bakery_product_variations WHERE id = ?').get(variation_id);
            db.prepare(`
        INSERT INTO bakery_inventory_transactions (
          id, branch_id, product_id, variation_id, batch_id, user_id,
          department, transaction_type, quantity_change, resulting_quantity, reference_id, reason
        ) VALUES (?, ?, ?, ?, NULL, ?, 'FRONT_COUNTER', 'RETURN_IN', ?, ?, ?, ?)
      `).run(uuidv4(), branchId, variation.product_id, variation_id, req.user.id, qty, updatedVar.counter_stock, returnId, `Returned in sellable condition (${reason})`);
        }
    });
    tx();
    logAudit({
        branchId,
        userId: req.user.id,
        action: 'BAKERY_RETURN_RECORDED',
        entityType: 'BAKERY_RETURN',
        entityId: returnId,
        details: { variation: variation.variation_name, quantity: qty, condition, isSellable }
    });
    requestDebouncedSync();
    res.status(201).json({ message: 'Return recorded', returnId, isSellableRestored: isSellable });
});
// ─────────────────────────────────────────────────────────────────────────────
// 10. INVENTORY AUDIT TRANSACTIONS & SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
// Comprehensive audit ledger of all bakery inventory changes
bakeryRouter.get('/inventory/transactions', authenticate, (req, res) => {
    const branchId = getBranch(req);
    const department = req.query.department;
    let query = `
    SELECT tx.*, p.name as product_name, v.variation_name, v.flavor_type, v.size, u.full_name as user_name
    FROM bakery_inventory_transactions tx
    JOIN bakery_products p ON tx.product_id = p.id
    JOIN bakery_product_variations v ON tx.variation_id = v.id
    JOIN users u ON tx.user_id = u.id
    WHERE tx.branch_id = ?
  `;
    const params = [branchId];
    if (department && department !== 'ALL') {
        query += ` AND tx.department = ?`;
        params.push(department);
    }
    query += ` ORDER BY tx.created_at DESC LIMIT 100`;
    const transactions = db.prepare(query).all(...params);
    res.json(transactions);
});
// Get department inventory stock summary
bakeryRouter.get('/inventory/summary', authenticate, (req, res) => {
    const branchId = getBranch(req);
    const variations = db.prepare(`
    SELECT v.*, p.name as product_name, p.name_amharic as product_name_amharic, p.category,
           CASE
             WHEN v.counter_stock <= 0 THEN 'OUT_OF_STOCK'
             WHEN v.counter_stock <= v.min_stock_level THEN 'LOW_STOCK'
             ELSE 'IN_STOCK'
           END as counter_status,
           (SELECT COUNT(*) FROM bakery_batches b WHERE b.variation_id = v.id AND b.status = 'READY' AND b.quantity_remaining > 0) as ready_batches_count
    FROM bakery_product_variations v
    JOIN bakery_products p ON v.product_id = p.id
    WHERE p.is_active = 1 AND v.is_available = 1
    ORDER BY p.name ASC, v.price ASC
  `).all();
    // Aggregate department metrics
    const metrics = db.prepare(`
    SELECT
      COALESCE(SUM(bakery_stock), 0) as total_bakery_units,
      COALESCE(SUM(counter_stock), 0) as total_counter_units,
      COALESCE(SUM(in_transit_stock), 0) as total_in_transit_units,
      COUNT(CASE WHEN counter_stock <= 0 THEN 1 END) as out_of_stock_count,
      COUNT(CASE WHEN counter_stock > 0 AND counter_stock <= min_stock_level THEN 1 END) as low_stock_count
    FROM bakery_product_variations v
    JOIN bakery_products p ON v.product_id = p.id
    WHERE p.is_active = 1 AND v.is_available = 1
  `).get();
    res.json({
        metrics,
        variations
    });
});
// ─────────────────────────────────────────────────────────────────────────────
// 8. CAKE ORDERS QUEUE (Waiter Cake Orders)
// ─────────────────────────────────────────────────────────────────────────────
bakeryRouter.get('/cake-queue', authenticate, (req, res) => {
    const branchId = getBranch(req);
    try {
        const items = db.prepare(`
      SELECT 
        oi.id,
        oi.order_id,
        oi.menu_item_id,
        oi.bakery_variation_id,
        oi.quantity,
        oi.notes,
        oi.status,
        oi.created_at,
        o.order_number,
        o.order_type,
        t.table_number,
        u.full_name as waiter_name,
        COALESCE(bp.name, mi.name) as item_name,
        COALESCE(bv.variation_name, 'Standard') as variation_name,
        bv.size,
        bv.weight_kg
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN bakery_product_variations bv ON oi.bakery_variation_id = bv.id
      LEFT JOIN bakery_products bp ON bv.product_id = bp.id
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE (oi.routing_destination IN ('FRONT_COUNTER', 'BAKERY') OR oi.bakery_variation_id IS NOT NULL OR mi.category_id = 'cat_bakery')
        AND o.status IN ('CONFIRMED', 'PREPARING', 'PARTIALLY_READY')
        AND oi.status != 'DELIVERED'
      ORDER BY oi.created_at ASC
    `).all();
        res.json(items);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
bakeryRouter.patch('/cake-queue/:itemId/status', authenticate, (req, res) => {
    const itemId = String(req.params.itemId);
    const { status } = req.body;
    try {
        if (status === 'READY') {
            db.prepare(`UPDATE order_items SET status = ?, ready_at = CURRENT_TIMESTAMP, prepared_by_id = ? WHERE id = ?`).run(status, req.user?.id || null, itemId);
        }
        else {
            db.prepare(`UPDATE order_items SET status = ? WHERE id = ?`).run(status, itemId);
        }
        // Get item order info to update order status and notify waiter
        const itemInfo = db.prepare(`
      SELECT oi.*, o.order_number, o.waiter_id, o.branch_id, o.status as order_status
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE oi.id = ?
    `).get(itemId);
        if (itemInfo) {
            const orderId = itemInfo.order_id;
            const allItems = db.prepare('SELECT status FROM order_items WHERE order_id = ?').all(orderId);
            const allReady = allItems.every(i => i.status === 'READY');
            const someReady = allItems.some(i => i.status === 'READY');
            let newOrderStatus = itemInfo.order_status;
            if (allReady) {
                newOrderStatus = 'READY';
            }
            else if (someReady) {
                newOrderStatus = 'PARTIALLY_READY';
            }
            if (newOrderStatus !== itemInfo.order_status) {
                db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newOrderStatus, orderId);
                db.prepare(`
          INSERT INTO order_status_history (id, order_id, user_id, previous_status, new_status, notes)
          VALUES (?, ?, ?, ?, ?, 'Front counter cake readiness update')
        `).run(uuidv4(), orderId, req.user?.id || null, itemInfo.order_status, newOrderStatus);
            }
            if (status === 'READY') {
                broadcastEvent({
                    type: 'ORDER_READY',
                    branchId: itemInfo.branch_id,
                    targetRole: ['waiter', 'admin', 'owner'],
                    payload: {
                        orderId: itemInfo.order_id,
                        orderNumber: itemInfo.order_number,
                        waiterId: itemInfo.waiter_id,
                        itemId,
                        itemName: itemInfo.name,
                        orderStatus: newOrderStatus,
                        message: `Cake Ready: "${itemInfo.name}" on Order #${itemInfo.order_number} is ready for pickup!`
                    }
                });
            }
        }
        broadcastEvent({
            type: 'CAKE_ORDER_UPDATED',
            payload: { itemId, status }
        });
        res.json({ success: true, message: `Status updated to ${status}` });
    }
    catch (err) {
        console.error('Failed to update cake order item status:', err);
        res.status(500).json({ error: err.message });
    }
});
// Production & Transfer History for Bakery Kitchen
bakeryRouter.get('/history', authenticate, authorizeRole(['bakery', 'admin', 'owner']), (req, res) => {
    try {
        const branchId = getBranch(req);
        const batches = db.prepare(`
      SELECT b.*, p.name as product_name, p.name_amharic as product_name_amharic,
             v.variation_name, v.size, u.full_name as produced_by_name
      FROM bakery_batches b
      JOIN bakery_products p ON b.product_id = p.id
      JOIN bakery_product_variations v ON b.variation_id = v.id
      LEFT JOIN users u ON b.produced_by_id = u.id
      WHERE b.branch_id = ?
      ORDER BY b.created_at DESC
      LIMIT 100
    `).all(branchId);
        const transfers = db.prepare(`
      SELECT t.*, p.name as product_name, p.name_amharic as product_name_amharic,
             v.variation_name, v.size, u1.full_name as sent_by_name, u2.full_name as received_by_name
      FROM bakery_transfers t
      JOIN bakery_products p ON t.product_id = p.id
      JOIN bakery_product_variations v ON t.variation_id = v.id
      LEFT JOIN users u1 ON t.sent_by_id = u1.id
      LEFT JOIN users u2 ON t.received_by_id = u2.id
      WHERE t.branch_id = ?
      ORDER BY t.created_at DESC
      LIMIT 100
    `).all(branchId);
        const waste = db.prepare(`
      SELECT w.*, p.name as product_name, p.name_amharic as product_name_amharic,
             v.variation_name, v.size, u.full_name as recorded_by
      FROM bakery_waste_records w
      JOIN bakery_products p ON w.product_id = p.id
      JOIN bakery_product_variations v ON w.variation_id = v.id
      LEFT JOIN users u ON w.user_id = u.id
      WHERE w.branch_id = ? AND w.department = 'BAKERY'
      ORDER BY w.created_at DESC
      LIMIT 100
    `).all(branchId);
        res.json({ batches, transfers, waste });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Sales & Transfers History for Front Counter
bakeryRouter.get('/counter-history', authenticate, authorizeRole(['front_counter', 'cashier', 'admin', 'owner']), (req, res) => {
    try {
        const branchId = getBranch(req);
        const sales = db.prepare(`
      SELECT o.*, t.payment_method, u.full_name as staff_name
      FROM orders o
      LEFT JOIN (
        SELECT order_id, payment_method FROM payments GROUP BY order_id
      ) t ON o.id = t.order_id
      LEFT JOIN users u ON o.waiter_id = u.id
      WHERE o.branch_id = ? 
        AND o.status IN ('COMPLETED', 'DELIVERED')
        AND (o.order_type = 'COUNTER_SALE' OR o.id IN (
          SELECT DISTINCT order_id FROM order_items 
          WHERE routing_destination IN ('FRONT_COUNTER', 'BAKERY') OR bakery_variation_id IS NOT NULL
        ))
      ORDER BY o.created_at DESC
      LIMIT 100
    `).all(branchId);
        const getItems = db.prepare(`
      SELECT oi.*, COALESCE(bp.name, mi.name) as item_name, COALESCE(bp.name_amharic, mi.name_amharic) as item_name_amharic,
             bv.variation_name, bv.size, bv.photo_url
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN bakery_product_variations bv ON oi.bakery_variation_id = bv.id
      LEFT JOIN bakery_products bp ON bv.product_id = bp.id
      WHERE oi.order_id = ?
    `);
        const populatedSales = sales.map(s => ({
            ...s,
            items: getItems.all(s.id)
        }));
        const transfersReceived = db.prepare(`
      SELECT t.*, p.name as product_name, p.name_amharic as product_name_amharic,
             v.variation_name, v.size, u1.full_name as sent_by_name, u2.full_name as received_by_name
      FROM bakery_transfers t
      JOIN bakery_products p ON t.product_id = p.id
      JOIN bakery_product_variations v ON t.variation_id = v.id
      LEFT JOIN users u1 ON t.sent_by_id = u1.id
      LEFT JOIN users u2 ON t.received_by_id = u2.id
      WHERE t.branch_id = ? AND t.status = 'RECEIVED'
      ORDER BY t.received_at DESC, t.created_at DESC
      LIMIT 100
    `).all(branchId);
        res.json({ sales: populatedSales, transfersReceived });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
