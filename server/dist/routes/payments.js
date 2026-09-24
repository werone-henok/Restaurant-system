import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';
import { requestDebouncedSync } from '../services/cloudSyncService.js';
import { v4 as uuidv4 } from 'uuid';
export const paymentRouter = Router();
// Process Payment (supports split payment methods: Cash, Telebirr, CBE Birr, Card)
paymentRouter.post('/', authenticate, authorizeRole(['cashier', 'admin', 'owner']), (req, res) => {
    const { order_id, splits, client_tx_id } = req.body;
    // splits: Array of { method: 'CASH' | 'TELEBIRR' | 'CBE_BIRR' | 'CARD', amount: number, reference_number?: string }
    if (!order_id || !splits || !Array.isArray(splits) || splits.length === 0) {
        return res.status(400).json({ error: 'Order ID and payment splits are required.' });
    }
    // Idempotency check: if client_tx_id already recorded for this transaction, return existing receipt
    if (client_tx_id) {
        const existingPayment = db.prepare('SELECT p.*, r.receipt_number, r.content_json, r.verification_hash FROM payments p LEFT JOIN receipts r ON p.order_id = r.order_id WHERE p.client_tx_id = ?').get(client_tx_id);
        if (existingPayment) {
            return res.status(200).json({
                message: 'Payment already processed (idempotent)',
                receiptNumber: existingPayment.receipt_number,
                receiptContent: existingPayment.content_json ? JSON.parse(existingPayment.content_json) : null,
                verificationHash: existingPayment.verification_hash
            });
        }
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
    if (!order)
        return res.status(404).json({ error: 'Order not found' });
    // Prevent payment on orders that are not in a payable state
    const PAYABLE_STATUSES = ['CONFIRMED', 'PREPARING', 'PARTIALLY_READY', 'READY', 'DELIVERED'];
    if (!PAYABLE_STATUSES.includes(order.status)) {
        return res.status(400).json({
            error: `Cannot process payment for order in status "${order.status}". Order must be confirmed by cashier before payment.`
        });
    }
    // Prevent double-payment: check if a receipt already exists for this order
    const existingReceipt = db.prepare('SELECT id, receipt_number, content_json, verification_hash FROM receipts WHERE order_id = ?').get(order_id);
    if (existingReceipt) {
        return res.status(409).json({
            error: `Payment already processed. Receipt ${existingReceipt.receipt_number} was issued for this order.`,
            receiptNumber: existingReceipt.receipt_number,
            receiptContent: existingReceipt.content_json ? JSON.parse(existingReceipt.content_json) : null,
            verificationHash: existingReceipt.verification_hash
        });
    }
    const totalPaid = splits.reduce((sum, s) => sum + Number(s.amount), 0);
    if (Math.abs(totalPaid - order.total_amount) > 0.05) {
        return res.status(400).json({
            error: `Payment sum (${totalPaid} ETB) does not match order total amount (${order.total_amount} ETB)`
        });
    }
    const receiptNumber = `REC-${new Date().getFullYear()}-${order.order_number}-${uuidv4().substring(0, 4).toUpperCase()}`;
    // Generate tamper-evident cryptographic hash for receipt validation
    const verificationPayload = `${receiptNumber}|${order.id}|${order.order_number}|${order.total_amount}|${req.user.id}|${order.branch_id}|${new Date().toISOString()}`;
    const verificationHash = crypto.createHash('sha256').update(verificationPayload).digest('hex');
    const tx = db.transaction(() => {
        // 1. Record Payments
        const insertPay = db.prepare(`
      INSERT INTO payments (id, order_id, branch_id, cashier_id, method, amount, reference_number, client_tx_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        for (const s of splits) {
            insertPay.run(uuidv4(), order_id, order.branch_id, req.user.id, s.method, s.amount, s.reference_number || null, client_tx_id || null);
        }
        // 2. Mark Order COMPLETED
        db.prepare(`
      UPDATE orders
      SET status = 'COMPLETED',
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(order_id);
        // 3. Free Table if Dine-In
        if (order.table_id) {
            db.prepare("UPDATE restaurant_tables SET status = 'AVAILABLE' WHERE id = ?").run(order.table_id);
        }
        // 4. AUTOMATIC RECIPE / INVENTORY STOCK DEDUCTION
        // Check if stock was already safely deducted when the order was confirmed
        const alreadyDeducted = db.prepare("SELECT COUNT(*) as count FROM inventory_movements WHERE reference_id = ? AND movement_type = 'ORDER_CONSUMPTION'").get(order_id);
        const lowStockAlerts = [];
        // Only deduct if not previously deducted during order confirmation
        if (!alreadyDeducted || alreadyDeducted.count === 0) {
            const orderItems = db.prepare('SELECT menu_item_id, quantity FROM order_items WHERE order_id = ?').all(order_id);
            const getRecipeItems = db.prepare(`
        SELECT ri.ingredient_id, ri.quantity_required, i.name as ingredient_name
        FROM recipes r
        JOIN recipe_items ri ON r.id = ri.recipe_id
        JOIN ingredients i ON ri.ingredient_id = i.id
        WHERE r.menu_item_id = ?
      `);
            const updateStockStmt = db.prepare(`
        UPDATE inventory_stock
        SET current_quantity = current_quantity - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE branch_id = ? AND ingredient_id = ?
      `);
            const logMovementStmt = db.prepare(`
        INSERT INTO inventory_movements (id, branch_id, ingredient_id, user_id, movement_type, quantity_change, resulting_quantity, reference_id, notes)
        VALUES (?, ?, ?, ?, 'ORDER_CONSUMPTION', ?, ?, ?, ?)
      `);
            for (const oi of orderItems) {
                const ingredients = getRecipeItems.all(oi.menu_item_id);
                for (const ing of ingredients) {
                    const totalDeduction = ing.quantity_required * oi.quantity;
                    // Ensure stock record exists
                    let currentStock = db.prepare('SELECT current_quantity FROM inventory_stock WHERE branch_id = ? AND ingredient_id = ?').get(order.branch_id, ing.ingredient_id);
                    if (!currentStock) {
                        db.prepare('INSERT INTO inventory_stock (id, branch_id, ingredient_id, current_quantity) VALUES (?, ?, ?, 0)').run(`stk_${uuidv4().substring(0, 8)}`, order.branch_id, ing.ingredient_id);
                        currentStock = { current_quantity: 0 };
                    }
                    const newQty = currentStock.current_quantity - totalDeduction;
                    updateStockStmt.run(totalDeduction, order.branch_id, ing.ingredient_id);
                    logMovementStmt.run(uuidv4(), order.branch_id, ing.ingredient_id, req.user.id, -totalDeduction, newQty, order_id, `Auto-deduction for Order #${order.order_number}`);
                    // Check low stock threshold
                    const ingMaster = db.prepare('SELECT min_stock_level, name FROM ingredients WHERE id = ?').get(ing.ingredient_id);
                    if (ingMaster && newQty <= ingMaster.min_stock_level) {
                        lowStockAlerts.push({
                            ingredient: ingMaster.name,
                            currentQuantity: newQty,
                            minStockLevel: ingMaster.min_stock_level
                        });
                    }
                }
            }
        }
        // 5. Generate Receipt
        const receiptContent = {
            orderNumber: order.order_number,
            receiptNumber,
            date: new Date().toISOString(),
            cashier: req.user.full_name,
            subtotal: order.subtotal,
            taxAmount: order.tax_amount,
            discountAmount: order.discount_amount,
            totalAmount: order.total_amount,
            paymentMethods: splits,
            verificationHash
        };
        db.prepare(`
      INSERT OR REPLACE INTO receipts (id, order_id, receipt_number, branch_id, total_amount, tax_amount, discount_amount, content_json, verification_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), order_id, receiptNumber, order.branch_id, order.total_amount, order.tax_amount, order.discount_amount, JSON.stringify(receiptContent), verificationHash);
        // 6. Log Status History
        db.prepare(`
      INSERT INTO order_status_history (id, order_id, user_id, previous_status, new_status, notes)
      VALUES (?, ?, ?, ?, 'COMPLETED', 'Payment settled and receipt generated')
    `).run(uuidv4(), order_id, req.user.id, order.status);
        return { receiptNumber, receiptContent, lowStockAlerts, verificationHash };
    });
    const result = tx();
    logAudit({
        branchId: order.branch_id,
        userId: req.user.id,
        action: 'PAYMENT_RECEIVED',
        entityType: 'ORDER',
        entityId: order_id,
        details: { totalPaid, splits, receiptNumber: result.receiptNumber, verificationHash: result.verificationHash }
    });
    // Broadcast completion
    broadcastEvent({
        type: 'ORDER_COMPLETED',
        branchId: order.branch_id,
        payload: { orderId: order_id, orderNumber: order.order_number, receiptNumber: result.receiptNumber }
    });
    // If any ingredient reached low stock, broadcast alert to Storekeeper, Admin, Owner
    if (result.lowStockAlerts.length > 0) {
        for (const alert of result.lowStockAlerts) {
            broadcastEvent({
                type: 'LOW_STOCK_ALERT',
                branchId: order.branch_id,
                targetRole: ['storekeeper', 'admin', 'owner'],
                payload: alert
            });
        }
    }
    // Trigger automated cloud sync to persist latest payments and inventory state
    requestDebouncedSync();
    res.json({
        message: 'Payment recorded, receipt issued with authenticity verification hash.',
        receiptNumber: result.receiptNumber,
        receiptContent: result.receiptContent,
        verificationHash: result.verificationHash
    });
});
// Get Receipt by orderId or receiptId
paymentRouter.get('/receipt/:orderId', authenticate, (req, res) => {
    const receipt = db.prepare('SELECT * FROM receipts WHERE order_id = ?').get(req.params.orderId);
    if (!receipt)
        return res.status(404).json({ error: 'Receipt not found' });
    res.json({
        ...receipt,
        content: JSON.parse(receipt.content_json)
    });
});
// Verify Receipt Authenticity (Public or Auditor Check)
paymentRouter.get('/verify/:receiptNumber', (req, res) => {
    const { receiptNumber } = req.params;
    const receipt = db.prepare(`
    SELECT r.*, o.order_number, o.created_at as order_created_at, b.name as branch_name
    FROM receipts r
    JOIN orders o ON r.order_id = o.id
    LEFT JOIN branches b ON r.branch_id = b.id
    WHERE r.receipt_number = ?
  `).get(receiptNumber);
    if (!receipt) {
        return res.status(404).json({ valid: false, error: 'Receipt not found in system records' });
    }
    res.json({
        valid: true,
        receiptNumber: receipt.receipt_number,
        orderNumber: receipt.order_number,
        branchName: receipt.branch_name,
        totalAmount: receipt.total_amount,
        taxAmount: receipt.tax_amount,
        discountAmount: receipt.discount_amount,
        issuedAt: receipt.created_at,
        verificationHash: receipt.verification_hash,
        content: receipt.content_json ? JSON.parse(receipt.content_json) : null
    });
});
