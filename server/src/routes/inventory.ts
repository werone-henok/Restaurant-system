import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../database/schema.js';
import { CONFIG } from '../config/env.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createIngredientSchema, updateIngredientSchema } from '../schemas/api.schemas.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';
import { notifyRoles } from '../services/notificationService.js';
import { requestDebouncedSync, uploadImageToCloud } from '../services/cloudSyncService.js';
import { v4 as uuidv4 } from 'uuid';

export const inventoryRouter = Router();

async function saveReceiptPhoto(dataUrlOrUrl: string | null): Promise<string | null> {
  if (!dataUrlOrUrl || typeof dataUrlOrUrl !== 'string') return null;
  if (!dataUrlOrUrl.startsWith('data:image/')) return dataUrlOrUrl;

  try {
    const matches = dataUrlOrUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    let ext = 'jpg';
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';

    const outFileName = `receipt_${Date.now()}_${uuidv4().substring(0, 6)}.${ext}`;
    const filePath = path.join(CONFIG.UPLOAD_DIR, outFileName);

    if (!fs.existsSync(CONFIG.UPLOAD_DIR)) {
      fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
    }

    fs.writeFileSync(filePath, buffer);
    uploadImageToCloud(outFileName, buffer, mimeType).catch(() => {});
    return `/uploads/${outFileName}`;
  } catch (e) {
    console.warn('[Inventory] Failed to save receipt photo buffer:', e);
    return null;
  }
}

// 1. Get Ingredients & Stock Levels for a Branch
inventoryRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const rawBranchId = req.query.branchId as string;
  const isAll = rawBranchId === 'ALL' || (!rawBranchId && (req.user?.role === 'owner' || req.user?.role === 'admin') && !req.user?.branch_id);
  const branchId = isAll ? null : (rawBranchId || req.user!.branch_id);

  let stockList: any[];
  if (branchId) {
    stockList = db.prepare(`
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
  } else {
    stockList = db.prepare(`
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
      LEFT JOIN (
        SELECT ingredient_id, SUM(current_quantity) as current_quantity 
        FROM inventory_stock 
        GROUP BY ingredient_id
      ) s ON i.id = s.ingredient_id
      WHERE i.is_active = 1
      ORDER BY is_low_stock DESC, i.name ASC
    `).all();
  }

  res.json(stockList);
});

// 2. Receive Stock (Storekeeper purchases/deliveries)
inventoryRouter.post('/receive', authenticate, authorizeRole(['storekeeper', 'admin', 'owner']), async (req: AuthenticatedRequest, res) => {
  try {
    const { branch_id, supplier_id, invoice_number, items, notes, receiving_date, receipt_photo_url } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items list is required for receiving stock' });
    }

    const targetBranch = branch_id || req.user!.branch_id;
    const poId = `po_${uuidv4().substring(0, 8)}`;
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const receivingDate = receiving_date && receiving_date.trim() ? receiving_date.trim() : new Date().toISOString().split('T')[0];
    
    // Save photo to file if base64 dataUrl, preserving URL reference
    const receiptPhoto = await saveReceiptPhoto(receipt_photo_url);

    // Verify or ensure supplier exists to avoid Foreign Key violations
    let finalSupplierId = supplier_id;
    if (!finalSupplierId) {
      const anySup = db.prepare('SELECT id FROM suppliers LIMIT 1').get() as any;
      if (anySup) {
        finalSupplierId = anySup.id;
      } else {
        finalSupplierId = 'sup_01';
        try {
          db.prepare(`
            INSERT INTO suppliers (id, name, contact_person, phone, email, address)
            VALUES ('sup_01', 'Abyssinia Fresh Agro Farms', 'Kenenisa Bekele', '+251911887766', 'sales@abyssiniafresh.et', 'Debre Zeit Road')
          `).run();
        } catch (_) {}
      }
    } else {
      const supExists = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(finalSupplierId);
      if (!supExists) {
        const anySup = db.prepare('SELECT id FROM suppliers LIMIT 1').get() as any;
        finalSupplierId = anySup?.id || 'sup_01';
      }
    }

    let totalCost = 0;
    for (const it of items) {
      totalCost += Number(it.quantity) * Number(it.unit_price);
    }

    const expenseId = `exp_${uuidv4().substring(0, 8)}`;

    const tx = db.transaction(() => {
      // 1. Create Purchase Order with receiving date and receipt photo
      db.prepare(`
        INSERT INTO purchase_orders (id, po_number, branch_id, supplier_id, storekeeper_id, total_cost, invoice_number, receiving_date, receipt_photo_url, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(poId, poNumber, targetBranch, finalSupplierId, req.user!.id, totalCost, invoice_number || null, receivingDate, receiptPhoto, notes || null);

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
        const lineCost = Number(it.quantity) * Number(it.unit_price);
        insertPoItem.run(uuidv4(), poId, it.ingredient_id, it.quantity, it.unit_price, lineCost);
        updateStock.run(`stk_${uuidv4().substring(0, 8)}`, targetBranch, it.ingredient_id, it.quantity);
        insertMov.run(uuidv4(), targetBranch, it.ingredient_id, req.user!.id, it.quantity, targetBranch, it.ingredient_id, poId, `Received under ${poNumber}`);
      }

      // 2. Automatically record this inventory intake as an operational expense
      const sampleIng = db.prepare('SELECT category FROM ingredients WHERE id = ?').get(items[0].ingredient_id) as any;
      const expenseCategory = (sampleIng?.category === 'Beverages' && items.every(it => {
        const c = db.prepare('SELECT category FROM ingredients WHERE id = ?').get(it.ingredient_id) as any;
        return c?.category === 'Beverages';
      })) ? 'Beverages' : 'Food purchases';

      const expenseDesc = `Stock Intake: ${poNumber} (${items.length} item${items.length > 1 ? 's' : ''}${invoice_number ? `, Inv: ${invoice_number}` : ''})`;

      db.prepare(`
        INSERT INTO expenses (id, branch_id, user_id, category, amount, expense_date, description, receipt_photo_url, supplier_id, reference_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        expenseId,
        targetBranch,
        req.user!.id,
        expenseCategory,
        totalCost,
        receivingDate,
        expenseDesc,
        receiptPhoto,
        finalSupplierId,
        invoice_number || poNumber
      );
    });

    tx();

    logAudit({
      branchId: targetBranch,
      userId: req.user!.id,
      action: 'STOCK_RECEIVED_EXPENSE_RECORDED',
      entityType: 'PURCHASE_ORDER',
      entityId: poId,
      details: { poNumber, totalCost, expenseId, itemsCount: items.length, receivingDate }
    });

    // Notify Admin & Owner in real-time
    notifyRoles({
      branchId: targetBranch,
      targetRoles: ['admin', 'owner'],
      title: '📦 Stock Intake & Expense Recorded',
      titleAmharic: '📦 ዕቃ ተረክቧል እና ወጪ ተመዝግቧል',
      message: `${req.user!.full_name || 'Storekeeper'} received ${items.length} inventory item(s) (${poNumber}, ${totalCost.toLocaleString()} ETB). Automatically recorded under expenses.`,
      messageAmharic: `በ ${req.user!.full_name || 'ስቶር ኪፐር'} ${items.length} ግብዓት ተረክቧል (${poNumber}፣ ${totalCost.toLocaleString()} ብር)። በወጪዎች መዝገብ ላይ ተመዝግቧል።`,
      type: 'EXPENSE',
      linkRef: poId
    });

    broadcastEvent({
      type: 'STOCK_UPDATED',
      branchId: targetBranch,
      payload: { poNumber, totalCost, expenseId }
    });

    requestDebouncedSync();

    res.status(201).json({
      message: 'Stock received and automatically recorded as expense',
      poNumber,
      totalCost,
      expenseId,
      receivingDate,
      receiptPhotoUrl: receiptPhoto
    });
  } catch (err: any) {
    console.error('[Inventory Receive Error]:', err);
    res.status(500).json({
      success: false,
      error: {
        message: err.message || 'Failed to receive stock',
        code: 'ERR_RECEIVE_STOCK'
      }
    });
  }
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

  notifyRoles({
    branchId: targetBranch,
    targetRoles: ['admin', 'owner'],
    title: '⚠️ Waste / Spoilage Recorded',
    titleAmharic: '⚠️ የዕቃ ብክነት ተመዝግቧል',
    message: `${req.user!.full_name || 'Staff'} logged waste: ${quantity} ${unit || ''} of ${ing?.name || 'item'} (${reason}, est. ${estCost.toLocaleString()} ETB).`,
    messageAmharic: `በ ${req.user!.full_name || 'ሰራተኛ'} ብክነት ተመዝግቧል: ${quantity} ${unit || ''} ${ing?.name_amharic || ing?.name || 'ግብዓት'} (${reason}፣ ግምታዊ ${estCost.toLocaleString()} ብር)።`,
    type: 'LOW_STOCK',
    linkRef: wasteId
  });

  requestDebouncedSync();

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

  notifyRoles({
    branchId: req.user!.branch_id,
    targetRoles: ['admin', 'owner'],
    title: '✨ New Ingredient Catalog Item',
    titleAmharic: '✨ አዲስ ግብዓት ተፈጠረ',
    message: `${req.user!.full_name || 'Staff'} added "${name}" (${category}) to the master inventory catalog.`,
    messageAmharic: `በ ${req.user!.full_name || 'ሰራተኛ'} አዲስ ግብዓት "${name_amharic || name}" (${category}) ወደ ካታሎግ ተጨምሯል።`,
    type: 'INFO',
    linkRef: id
  });

  broadcastEvent({
    type: 'STOCK_UPDATED',
    branchId: req.user!.branch_id,
    payload: { ingredientId: id, name, action: 'CREATED' }
  });

  requestDebouncedSync();

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

  notifyRoles({
    branchId: req.user!.branch_id,
    targetRoles: ['admin', 'owner'],
    title: '📝 Ingredient Updated',
    titleAmharic: '📝 ግብዓት ተሻሽሏል',
    message: `${req.user!.full_name || 'Staff'} updated details for "${name ?? existing.name}".`,
    messageAmharic: `በ ${req.user!.full_name || 'ሰራተኛ'} የግብዓት መረጃ "${name ?? existing.name}" ተሻሽሏል።`,
    type: 'INFO',
    linkRef: String(id)
  });

  broadcastEvent({
    type: 'STOCK_UPDATED',
    branchId: req.user!.branch_id,
    payload: { ingredientId: id, action: 'UPDATED' }
  });

  requestDebouncedSync();

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

  notifyRoles({
    branchId: req.user!.branch_id,
    targetRoles: ['admin', 'owner'],
    title: '🗑️ Ingredient Removed',
    titleAmharic: '🗑️ ግብዓት ተሰርዟል',
    message: `${req.user!.full_name || 'Admin'} removed "${existing.name}" from active inventory.`,
    messageAmharic: `በ ${req.user!.full_name || 'አስተዳዳሪ'} ግብዓት "${existing.name}" ከካታሎግ ተሰርዟል።`,
    type: 'INFO',
    linkRef: String(id)
  });

  broadcastEvent({
    type: 'STOCK_UPDATED',
    branchId: req.user!.branch_id,
    payload: { ingredientId: id, action: 'DELETED' }
  });

  requestDebouncedSync();

  res.json({ message: 'Ingredient removed from active catalog', id });
});

// 8. Get Purchase Orders / Receiving History
inventoryRouter.get('/purchases', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const branchId = (req.query.branchId as string) || req.user!.branch_id;
    const isOwner = req.user!.role === 'owner';

    let query = `
      SELECT po.*, s.name as supplier_name, u.full_name as storekeeper_name
      FROM purchase_orders po
      LEFT JOIN suppliers s ON po.supplier_id = s.id
      LEFT JOIN users u ON po.storekeeper_id = u.id
    `;
    const params: any[] = [];
    if (!isOwner && branchId) {
      query += ` WHERE po.branch_id = ?`;
      params.push(branchId);
    }
    query += ` ORDER BY po.created_at DESC LIMIT 50`;

    const purchases = db.prepare(query).all(...params);
    res.json(purchases);
  } catch (err: any) {
    console.error('[Inventory Purchases Error]:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve purchases' });
  }
});

