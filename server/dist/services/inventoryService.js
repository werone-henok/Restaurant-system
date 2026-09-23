import { db } from '../database/schema.js';
import { v4 as uuidv4 } from 'uuid';
import { broadcastEvent } from './websocket.js';
/**
 * Deducts stock for all BOM-linked ingredients when a confirmed order is sent
 * to production. Runs as a single SQLite transaction so it's all-or-nothing.
 *
 * @param orderId    The order that was just confirmed
 * @param branchId   Branch whose stock to deduct
 * @param cashierId  The cashier who triggered the confirmation (for movement logs)
 * @returns          Array of low-stock alerts (ingredients that dropped below min)
 */
export function deductBomStock(orderId, branchId, cashierId) {
    // 1. Fetch all order items
    const orderItems = db
        .prepare('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?')
        .all(orderId);
    if (orderItems.length === 0) {
        return { lowStockAlerts: [] };
    }
    // 2. Resolve BOM for each order item, joining recipe → recipe_items → ingredients → stock
    const getBomStmt = db.prepare(`
    SELECT
      ri.ingredient_id,
      i.name        AS ingredient_name,
      i.unit,
      i.unit_cost,
      i.min_stock_level,
      ri.quantity_required,
      COALESCE(s.current_quantity, 0) AS current_quantity
    FROM recipes r
    JOIN recipe_items ri ON ri.recipe_id = r.id
    JOIN ingredients  i  ON i.id = ri.ingredient_id
    LEFT JOIN inventory_stock s
      ON s.ingredient_id = ri.ingredient_id AND s.branch_id = ?
    WHERE r.menu_item_id = ?
      AND i.is_active = 1
  `);
    // Accumulate total deduction per ingredient (multiple items may share ingredients)
    const totals = new Map();
    for (const oi of orderItems) {
        const bomRows = getBomStmt.all(branchId, oi.menu_item_id);
        for (const row of bomRows) {
            const deduct = row.quantity_required * oi.quantity;
            if (totals.has(row.ingredient_id)) {
                totals.get(row.ingredient_id).quantity_to_deduct += deduct;
            }
            else {
                totals.set(row.ingredient_id, { ...row, quantity_to_deduct: deduct });
            }
        }
    }
    if (totals.size === 0) {
        // No recipes defined — nothing to deduct (graceful degradation)
        return { lowStockAlerts: [] };
    }
    const updateStockStmt = db.prepare(`
    UPDATE inventory_stock
    SET current_quantity = current_quantity - ?,
        updated_at       = CURRENT_TIMESTAMP
    WHERE branch_id = ? AND ingredient_id = ?
  `);
    const insertMovStmt = db.prepare(`
    INSERT INTO inventory_movements
      (id, branch_id, ingredient_id, user_id, movement_type, quantity_change, resulting_quantity, reference_id, notes)
    VALUES
      (?, ?, ?, ?, 'ORDER_CONSUMPTION', ?, ?, ?, ?)
  `);
    const getResultingQtyStmt = db.prepare(`
    SELECT COALESCE(current_quantity, 0) AS qty
    FROM inventory_stock
    WHERE branch_id = ? AND ingredient_id = ?
  `);
    const lowStockAlerts = [];
    // 3. Pre-flight check: ensure no ingredient would go negative before committing any deductions
    for (const line of totals.values()) {
        if (line.current_quantity < line.quantity_to_deduct) {
            throw new Error(`Insufficient stock for "${line.ingredient_name}": required ${line.quantity_to_deduct} ${line.unit}, ` +
                `available ${line.current_quantity} ${line.unit}. Restock before confirming this order.`);
        }
    }
    // 4. Execute all deductions inside a single transaction
    const tx = db.transaction(() => {
        for (const line of totals.values()) {
            updateStockStmt.run(line.quantity_to_deduct, branchId, line.ingredient_id);
            const resulting = getResultingQtyStmt.get(branchId, line.ingredient_id)?.qty ?? 0;
            insertMovStmt.run(`mov_${uuidv4().substring(0, 8)}`, branchId, line.ingredient_id, cashierId, -line.quantity_to_deduct, resulting, orderId, `Order #${orderId} consumption`);
            if (resulting <= line.min_stock_level) {
                lowStockAlerts.push({
                    ingredient_id: line.ingredient_id,
                    name: line.ingredient_name,
                    unit: line.unit,
                    current: resulting,
                    min: line.min_stock_level
                });
            }
        }
    });
    tx();
    // 4. Persist and Broadcast low-stock alerts
    const insertNotif = db.prepare(`
    INSERT INTO notifications (id, branch_id, target_role, title, title_amharic, message, message_amharic, type, link_ref)
    VALUES (?, ?, 'storekeeper', ?, ?, ?, ?, 'LOW_STOCK', ?)
  `);
    for (const alert of lowStockAlerts) {
        const notifId = `notif_${uuidv4().substring(0, 8)}`;
        const title = 'Low Stock Alert';
        const titleAmharic = 'ዝቅተኛ የዕቃ ክምችት ማስጠንቀቂያ';
        const msg = `⚠️ ${alert.name} is low on stock (${alert.current} ${alert.unit} remaining, minimum is ${alert.min})`;
        const msgAmharic = `⚠️ ${alert.name} ክምችቱ ዝቅ ብሏል (${alert.current} ${alert.unit} ቀርቷል፣ ዝቅተኛው ወለል ${alert.min} ነው)`;
        try {
            insertNotif.run(notifId, branchId, title, titleAmharic, msg, msgAmharic, orderId);
        }
        catch (e) {
            console.error('Failed to insert notification:', e);
        }
        broadcastEvent({
            type: 'LOW_STOCK_ALERT',
            branchId,
            targetRole: ['storekeeper', 'admin', 'owner'],
            payload: {
                id: notifId,
                ingredient_id: alert.ingredient_id,
                name: alert.name,
                unit: alert.unit,
                current_quantity: alert.current,
                min_stock_level: alert.min,
                triggered_by_order: orderId
            }
        });
    }
    return { lowStockAlerts };
}
