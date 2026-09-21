import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createIngredientSchema, updateIngredientSchema } from '../schemas/api.schemas.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';
import { v4 as uuidv4 } from 'uuid';

export const inventoryRouter = Router();

// 1. Get Ingredients & Stock Levels for a Branch
inventoryRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const branchId = (req.query.branchId as string) || req.user!.branch_id;

  const stockList = db.prepare(`
    SELECT 
      i.*,
      COALESCE(s.current_quantity, 0) as current_quantity,
      CASE 
        WHEN COALESCE(s.current_quantity, 0) <= i.min_stock_level THEN 1 
        ELSE 0 
      END as is_low_stock,
      CASE
        WHEN i.expiration_date IS NOT NULL AND date(i.expiration_date) <= date('now') THEN 'EXPIRED'
        WHEN i.expiration_date IS NOT NULL AND date(i.expiration_date) <= date('now', '+3 days') THEN 'EXPIRING_SOON'
        ELSE 'OK'
      END as expiration_status
    FROM ingredients i
    LEFT JOIN inventory_stock s ON i.id = s.ingredient_id AND s.branch_id = ?
    WHERE i.is_active = 1
    ORDER BY is_low_stock DESC, i.name ASC
  `).all(branchId);

  res.json(stockList);
});

// 2. Receive Stock (Storekeeper purchases/deliveries)
inventoryRouter.post('/receive', authenticate, authorizeRole(['storekeeper', 'admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { branch_id, supplier_id, invoice_number, items, notes } = req.body;
  // items: Array of { ingredient_id: string, quantity: number, unit_price: number }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items list is required for receiving stock' });
  }

  const targetBranch = branch_id || req.user!.branch_id;
  const poId = `po_${uuidv4().substring(0, 8)}`;
  const poNumber = `PO-${Date.now().toString().slice(-6)}`;

  let totalCost = 0;
  for (const it of items) {
    totalCost += it.quantity * it.unit_price;
  }

  const tx = db.transaction(() => {
    // 1. Create Purchase Order
    db.prepare(`
      INSERT INTO purchase_orders (id, po_number, branch_id, supplier_id, storekeeper_id, total_cost, invoice_number, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(poId, poNumber, targetBranch, supplier_id || 'sup_01', req.user!.id, totalCost, invoice_number || null, notes || null);

    const insertPoItem = db.prepare(`
      INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      INSERT INTO inventory_stock (id, branch_id, ingredient_id, current_quantity)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(branch_id, ingredient_id)
      DO UPDATE SET current_quantity = current_quantity + excluded.current_quantity, updated_at = CURRENT_TIMESTAMP
    `);

    const insertMov = db.prepare(`
      INSERT INTO inventory_movements (id, branch_id, ingredient_id, user_id, movement_type, quantity_change, resulting_quantity, reference_id, notes)
      VALUES (?, ?, ?, ?, 'PURCHASE_RECEIVE', ?, (SELECT current_quantity FROM inventory_stock WHERE branch_id = ? AND ingredient_id = ?), ?, ?)
    `);

    for (const it of items) {
      insertPoItem.run(uuidv4(), poId, it.ingredient_id, it.quantity, it.unit_price, it.quantity * it.unit_price);
      updateStock.run(`stk_${uuidv4().substring(0, 8)}`, targetBranch, it.ingredient_id, it.quantity);
      insertMov.run(uuidv4(), targetBranch, it.ingredient_id, req.user!.id, it.quantity, targetBranch, it.ingredient_id, poId, `Received under ${poNumber}`);
    }
  });

  tx();

  logAudit({
    branchId: targetBranch,
    userId: req.user!.id,
    action: 'STOCK_RECEIVED',
    entityType: 'PURCHASE_ORDER',
    entityId: poId,
    details: { poNumber, totalCost, itemsCount: items.length }
  });

  broadcastEvent({
    type: 'STOCK_UPDATED',
    branchId: targetBranch,
    payload: { poNumber, totalCost }
  });

  res.status(201).json({ message: 'Stock received and inventory successfully incremented', poNumber, totalCost });
});

// 3. Log Waste / Spoilage
inventoryRouter.post('/waste', authenticate, authorizeRole(['storekeeper', 'chef', 'barista', 'admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { branch_id, ingredient_id, quantity, unit, reason, photo_url } = req.body;

  if (!ingredient_id || !quantity || !reason) {
    return res.status(400).json({ error: 'Ingredient, quantity, and reason are required' });
  }

  const targetBranch = branch_id || req.user!.branch_id;
  const wasteId = `wst_${uuidv4().substring(0, 8)}`;

  // Get ingredient cost
  const ing = db.prepare('SELECT unit_cost, name FROM ingredients WHERE id = ?').get(ingredient_id) as any;
  const estCost = (ing?.unit_cost || 0) * quantity;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO waste_records (id, branch_id, ingredient_id, user_id, quantity, unit, reason, photo_url, estimated_cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(wasteId, targetBranch, ingredient_id, req.user!.id, quantity, unit || 'g', reason, photo_url || null, estCost);

    // Deduct stock
    db.prepare(`
      UPDATE inventory_stock
      SET current_quantity = current_quantity - ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND ingredient_id = ?
    `).run(quantity, targetBranch, ingredient_id);

    // Log movement
    db.prepare(`
      INSERT INTO inventory_movements (id, branch_id, ingredient_id, user_id, movement_type, quantity_change, resulting_quantity, reference_id, notes)
      VALUES (?, ?, ?, ?, 'WASTE', ?, (SELECT current_quantity FROM inventory_stock WHERE branch_id = ? AND ingredient_id = ?), ?, ?)
    `).run(uuidv4(), targetBranch, ingredient_id, req.user!.id, -quantity, targetBranch, ingredient_id, wasteId, `Waste: ${reason}`);
  });

  tx();

  logAudit({
    branchId: targetBranch,
    userId: req.user!.id,
    action: 'WASTE_LOGGED',
    entityType: 'WASTE',
    entityId: wasteId,
    details: { ingredient: ing?.name, quantity, reason, estCost }
  });

  res.status(201).json({ message: 'Waste recorded and inventory updated', wasteId, estimatedCost: estCost });
});

// 4. Stock Movement Audit History
inventoryRouter.get('/movements', authenticate, (req: AuthenticatedRequest, res) => {
  const branchId = (req.query.branchId as string) || req.user!.branch_id;
  const movements = db.prepare(`
    SELECT m.*, i.name as ingredient_name, i.unit, u.full_name as user_name
    FROM inventory_movements m
    JOIN ingredients i ON m.ingredient_id = i.id
    JOIN users u ON m.user_id = u.id
    WHERE m.branch_id = ?
    ORDER BY m.created_at DESC LIMIT 100
  `).all(branchId);

  res.json(movements);
});

// 5. Create Ingredient (Storekeeper, Admin, Owner)
inventoryRouter.post('/ingredients', authenticate, authorizeRole(['storekeeper', 'admin', 'owner']), validate(createIngredientSchema), (req: AuthenticatedRequest, res) => {
  const { name, name_amharic, category, sku, unit, unit_cost, min_stock_level, max_stock_level, shelf_location, photo_url, expiration_date } = req.body;

  const id = `ing_${uuidv4().substring(0, 8)}`;
  db.prepare(`
    INSERT INTO ingredients (id, name, name_amharic, category, sku, unit, unit_cost, min_stock_level, max_stock_level, shelf_location, photo_url, expiration_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, name_amharic || null, category, sku || null, unit,
    unit_cost ?? 0, min_stock_level ?? 5, max_stock_level ?? 100, shelf_location || 'Main Store',
    photo_url || null, expiration_date || null
  );

  // Initialize stock for all active branches
  const branches = db.prepare('SELECT id FROM branches WHERE is_active = 1').all() as any[];
  const insertStock = db.prepare(`
    INSERT INTO inventory_stock (id, branch_id, ingredient_id, current_quantity)
    VALUES (?, ?, ?, 0)
    ON CONFLICT(branch_id, ingredient_id) DO NOTHING
  `);
  for (const b of branches) {
    insertStock.run(`stk_${uuidv4().substring(0, 8)}`, b.id, id);
  }

  logAudit({
    branchId: req.user!.branch_id,
    userId: req.user!.id,
    action: 'INGREDIENT_CREATED',
    entityType: 'INGREDIENT',
    entityId: id,
    details: { name, category, unit, unit_cost, min_stock_level }
  });

  broadcastEvent({
    type: 'STOCK_UPDATED',
    branchId: req.user!.branch_id,
    payload: { ingredientId: id, name, action: 'CREATED' }
  });

  res.status(201).json({ id, message: 'Ingredient added to master catalog' });
});

// 6. Update Ingredient (Storekeeper, Admin, Owner)
inventoryRouter.put('/ingredients/:id', authenticate, authorizeRole(['storekeeper', 'admin', 'owner']), validate(updateIngredientSchema), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Ingredient not found' });
  }

  const { name, name_amharic, category, sku, unit, unit_cost, min_stock_level, max_stock_level, shelf_location, photo_url, expiration_date } = req.body;

  db.prepare(`
    UPDATE ingredients
    SET name = COALESCE(?, name),
        name_amharic = ?,
        category = COALESCE(?, category),
        sku = ?,
        unit = COALESCE(?, unit),
        unit_cost = COALESCE(?, unit_cost),
        min_stock_level = COALESCE(?, min_stock_level),
        max_stock_level = COALESCE(?, max_stock_level),
        shelf_location = COALESCE(?, shelf_location),
        photo_url = COALESCE(?, photo_url),
        expiration_date = ?
    WHERE id = ?
  `).run(
    name ?? existing.name,
    name_amharic !== undefined ? name_amharic : existing.name_amharic,
    category ?? existing.category,
    sku !== undefined ? sku : existing.sku,
    unit ?? existing.unit,
    unit_cost !== undefined ? unit_cost : existing.unit_cost,
    min_stock_level !== undefined ? min_stock_level : existing.min_stock_level,
    max_stock_level !== undefined ? max_stock_level : existing.max_stock_level,
    shelf_location ?? existing.shelf_location,
    photo_url !== undefined ? photo_url : existing.photo_url,
    expiration_date !== undefined ? expiration_date : existing.expiration_date,
    id
  );

  logAudit({
    branchId: req.user!.branch_id,
    userId: req.user!.id,
    action: 'INGREDIENT_UPDATED',
    entityType: 'INGREDIENT',
    entityId: id,
    details: { name: name ?? existing.name, category: category ?? existing.category }
  });

  broadcastEvent({
    type: 'STOCK_UPDATED',
    branchId: req.user!.branch_id,
    payload: { ingredientId: id, action: 'UPDATED' }
  });

  res.json({ message: 'Ingredient updated successfully', id });
});

// 7. Delete Ingredient (Admin and Owner ONLY - Storekeeper is forbidden)
inventoryRouter.delete('/ingredients/:id', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT id, name FROM ingredients WHERE id = ?').get(id) as any;
  if (!existing) {
    return res.status(404).json({ error: 'Ingredient not found' });
  }

  // Soft delete by marking is_active = 0
  db.prepare('UPDATE ingredients SET is_active = 0 WHERE id = ?').run(id);

  logAudit({
    branchId: req.user!.branch_id,
    userId: req.user!.id,
    action: 'INGREDIENT_DELETED',
    entityType: 'INGREDIENT',
    entityId: id,
    details: { name: existing.name }
  });

  broadcastEvent({
    type: 'STOCK_UPDATED',
    branchId: req.user!.branch_id,
    payload: { ingredientId: id, action: 'DELETED' }
  });

  res.json({ message: 'Ingredient removed from active catalog', id });
});
