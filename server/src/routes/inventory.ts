import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';
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

// 5. Add / Update Ingredient Master with Camera Photo & Shelf Location
inventoryRouter.post('/ingredients', authenticate, authorizeRole(['storekeeper', 'admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { name, name_amharic, category, unit, unit_cost, min_stock_level, shelf_location, photo_url, expiration_date } = req.body;

  if (!name || !category || !unit) {
    return res.status(400).json({ error: 'Name, category, and unit are required' });
  }

  const id = `ing_${uuidv4().substring(0, 8)}`;
  db.prepare(`
    INSERT INTO ingredients (id, name, name_amharic, category, unit, unit_cost, min_stock_level, shelf_location, photo_url, expiration_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, name, name_amharic || null, category, unit,
    unit_cost || 0, min_stock_level || 5, shelf_location || 'Main Store',
    photo_url || null, expiration_date || null
  );

  // Initialize 0 stock for branch
  db.prepare(`
    INSERT INTO inventory_stock (id, branch_id, ingredient_id, current_quantity)
    VALUES (?, ?, ?, 0)
  `).run(`stk_${uuidv4().substring(0, 8)}`, req.user!.branch_id, id);

  res.status(201).json({ id, message: 'Ingredient added to master catalog' });
});
