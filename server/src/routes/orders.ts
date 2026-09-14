import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { broadcastEvent } from '../services/websocket.js';
import { v4 as uuidv4 } from 'uuid';

export const orderRouter = Router();

// 1. Get Orders for Branch & Filter
orderRouter.get('/', authenticate, (req: AuthenticatedRequest, res) => {
  const branchId = (req.query.branchId as string) || req.user!.branch_id;
  const status = req.query.status as string;
  const role = req.user!.role;

  let query = `
    SELECT o.*, t.table_number, t.name as table_name, u.full_name as waiter_name, c.full_name as cashier_name
    FROM orders o
    LEFT JOIN restaurant_tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.waiter_id = u.id
    LEFT JOIN users c ON o.cashier_id = c.id
    WHERE o.branch_id = ?
  `;
  const params: any[] = [branchId];

  if (status) {
    query += ` AND o.status = ?`;
    params.push(status);
  }

  // Filter for specific roles: Waiter can see their active or recent orders
  if (role === 'waiter' && req.query.myOrders === 'true') {
    query += ` AND o.waiter_id = ?`;
    params.push(req.user!.id);
  }

  query += ` ORDER BY o.created_at DESC LIMIT 100`;

  const orders = db.prepare(query).all(...params) as any[];

  // Fetch items for these orders
  const getItemStmt = db.prepare(`
    SELECT oi.*, mi.name as menu_name, mi.photo_url
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ?
  `);

  const populated = orders.map(order => ({
    ...order,
    items: getItemStmt.all(order.id)
  }));

  res.json(populated);
});

// 2. Kitchen Queue (Chef view: all food items)
orderRouter.get('/queue/kitchen', authenticate, authorizeRole(['chef', 'admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const branchId = (req.query.branchId as string) || req.user!.branch_id;

  const orders = db.prepare(`
    SELECT DISTINCT o.*, t.table_number, u.full_name as waiter_name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN restaurant_tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.waiter_id = u.id
    WHERE o.branch_id = ? 
      AND o.status IN ('CONFIRMED', 'PREPARING', 'PARTIALLY_READY')
      AND oi.routing_destination IN ('KITCHEN', 'BOTH')
    ORDER BY o.created_at ASC
  `).all(branchId) as any[];

  const getKitchenItems = db.prepare(`
    SELECT oi.*
    FROM order_items oi
    WHERE oi.order_id = ? AND oi.routing_destination IN ('KITCHEN', 'BOTH')
  `);

  const result = orders.map(order => ({
    ...order,
    items: getKitchenItems.all(order.id)
  }));

  res.json(result);
});

// 3. Bar Queue (Barista view: all drink items)
orderRouter.get('/queue/bar', authenticate, authorizeRole(['barista', 'admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const branchId = (req.query.branchId as string) || req.user!.branch_id;

  const orders = db.prepare(`
    SELECT DISTINCT o.*, t.table_number, u.full_name as waiter_name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN restaurant_tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.waiter_id = u.id
    WHERE o.branch_id = ? 
      AND o.status IN ('CONFIRMED', 'PREPARING', 'PARTIALLY_READY')
      AND oi.routing_destination IN ('BAR', 'BOTH')
    ORDER BY o.created_at ASC
  `).all(branchId) as any[];

  const getBarItems = db.prepare(`
    SELECT oi.*
    FROM order_items oi
    WHERE oi.order_id = ? AND oi.routing_destination IN ('BAR', 'BOTH')
  `);

  const result = orders.map(order => ({
    ...order,
    items: getBarItems.all(order.id)
  }));

  res.json(result);
});

// 4. Create Order (Waiter)
orderRouter.post('/', authenticate, (req: AuthenticatedRequest, res) => {
  const { branch_id, table_id, order_type, items, special_notes, client_tx_id } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must have at least one item' });
  }

  const targetBranch = branch_id || req.user!.branch_id;

  // Idempotency check for offline sync
  if (client_tx_id) {
    const existing = db.prepare('SELECT id, order_number, status FROM orders WHERE client_tx_id = ?').get(client_tx_id);
    if (existing) {
      return res.status(200).json({ message: 'Order already synchronized (idempotent)', order: existing });
    }
  }

  // Get next sequential order number for today
  const orderNumRow = db.prepare(`
    SELECT COALESCE(MAX(order_number), 100) + 1 as next_num
    FROM orders
    WHERE branch_id = ? AND date(created_at) = date('now')
  `).get(targetBranch) as { next_num: number };

  const orderNumber = orderNumRow.next_num;
  const orderId = `ord_${uuidv4().substring(0, 8)}`;

  // Calculate totals
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.price * item.quantity;
  }

  // Get branch tax settings
  const branchInfo = db.prepare('SELECT vat_rate FROM branches WHERE id = ?').get(targetBranch) as any;
  const vatRate = branchInfo?.vat_rate ?? 0.15;
  const taxAmount = +(subtotal * vatRate).toFixed(2);
  const totalAmount = +(subtotal + taxAmount).toFixed(2);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO orders (
        id, order_number, client_tx_id, branch_id, table_id, waiter_id, order_type,
        status, subtotal, tax_amount, total_amount, special_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING_CASHIER', ?, ?, ?, ?)
    `).run(
      orderId, orderNumber, client_tx_id || null, targetBranch, table_id || null, req.user!.id,
      order_type || 'DINE_IN', subtotal, taxAmount, totalAmount, special_notes || null
    );

    const insertItem = db.prepare(`
      INSERT INTO order_items (id, order_id, menu_item_id, name, price, quantity, notes, routing_destination, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `);

    for (const it of items) {
      insertItem.run(
        `item_${uuidv4().substring(0, 8)}`,
        orderId,
        it.menu_item_id,
        it.name,
        it.price,
        it.quantity,
        it.notes || null,
        it.routing_destination || 'KITCHEN'
      );
    }

    // Mark table occupied if dine-in
    if (table_id) {
      db.prepare("UPDATE restaurant_tables SET status = 'OCCUPIED' WHERE id = ?").run(table_id);
    }

    // Log status history
    db.prepare(`
      INSERT INTO order_status_history (id, order_id, user_id, previous_status, new_status, notes)
      VALUES (?, ?, ?, 'DRAFT', 'PENDING_CASHIER', 'Waiter created order')
    `).run(uuidv4(), orderId, req.user!.id);
  });

  tx();

  logAudit({
    branchId: targetBranch,
    userId: req.user!.id,
    action: 'ORDER_CREATED',
    entityType: 'ORDER',
    entityId: orderId,
    details: { orderNumber, totalAmount, itemsCount: items.length }
  });

  // Broadcast real-time notification to Cashier
  broadcastEvent({
    type: 'ORDER_PENDING_CASHIER',
    branchId: targetBranch,
    targetRole: ['cashier', 'admin', 'owner'],
    payload: {
      orderId,
      orderNumber,
      waiter: req.user!.full_name,
      totalAmount,
      orderType: order_type
    }
  });

  res.status(201).json({
    orderId,
    orderNumber,
    status: 'PENDING_CASHIER',
    totalAmount,
    message: 'Order placed and sent to Cashier for confirmation.'
  });
});

// 5. Cashier Confirms Order (Routes to Chef and Barista)
orderRouter.post('/:id/confirm', authenticate, authorizeRole(['cashier', 'admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const orderId = req.params.id;
  const { discount_amount, discount_reason } = req.body;

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'PENDING_CASHIER') {
    return res.status(400).json({ error: `Cannot confirm order in status: ${order.status}` });
  }

  const tx = db.transaction(() => {
    let finalDiscount = discount_amount || 0;
    let newTotal = order.subtotal + order.tax_amount - finalDiscount;

    db.prepare(`
      UPDATE orders
      SET status = 'CONFIRMED',
          cashier_id = ?,
          discount_amount = ?,
          discount_reason = ?,
          total_amount = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, finalDiscount, discount_reason || null, newTotal, orderId);

    db.prepare(`
      INSERT INTO order_status_history (id, order_id, user_id, previous_status, new_status, notes)
      VALUES (?, ?, ?, 'PENDING_CASHIER', 'CONFIRMED', 'Cashier reviewed and confirmed order')
    `).run(uuidv4(), orderId, req.user!.id);
  });

  tx();

  logAudit({
    branchId: order.branch_id,
    userId: req.user!.id,
    action: 'ORDER_CONFIRMED',
    entityType: 'ORDER',
    entityId: orderId,
    details: { orderNumber: order.order_number, cashier: req.user!.full_name }
  });

  // Get items to route
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
  const hasFood = items.some(i => i.routing_destination === 'KITCHEN' || i.routing_destination === 'BOTH');
  const hasDrink = items.some(i => i.routing_destination === 'BAR' || i.routing_destination === 'BOTH');

  // Broadcast to Kitchen
  if (hasFood) {
    broadcastEvent({
      type: 'KITCHEN_NEW_ORDER',
      branchId: order.branch_id,
      targetRole: ['chef'],
      payload: { orderId, orderNumber: order.order_number, notes: order.special_notes }
    });
  }

  // Broadcast to Bar
  if (hasDrink) {
    broadcastEvent({
      type: 'BAR_NEW_ORDER',
      branchId: order.branch_id,
      targetRole: ['barista'],
      payload: { orderId, orderNumber: order.order_number, notes: order.special_notes }
    });
  }

  // Broadcast to Waiter
  broadcastEvent({
    type: 'ORDER_CONFIRMED',
    branchId: order.branch_id,
    payload: { orderId, orderNumber: order.order_number, status: 'CONFIRMED' }
  });

  res.json({ message: 'Order confirmed and routed to production', status: 'CONFIRMED' });
});

// 6. Update Item Status (Chef / Barista marks item PREPARING or READY)
orderRouter.patch('/:orderId/items/:itemId/status', authenticate, authorizeRole(['chef', 'barista', 'admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { orderId, itemId } = req.params;
  const { status } = req.body; // 'PREPARING' or 'READY'

  if (!['PREPARING', 'READY'].includes(status)) {
    return res.status(400).json({ error: 'Status must be PREPARING or READY' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare(`
    UPDATE order_items
    SET status = ?,
        prepared_by_id = ?,
        ready_at = CASE WHEN ? = 'READY' THEN CURRENT_TIMESTAMP ELSE ready_at END
    WHERE id = ? AND order_id = ?
  `).run(status, req.user!.id, status, itemId, orderId);

  // Check overall order readiness
  const allItems = db.prepare('SELECT status FROM order_items WHERE order_id = ?').all(orderId) as { status: string }[];
  const allReady = allItems.every(i => i.status === 'READY');
  const someReady = allItems.some(i => i.status === 'READY');
  const somePreparing = allItems.some(i => i.status === 'PREPARING');

  let newOrderStatus = order.status;
  if (allReady) {
    newOrderStatus = 'READY';
  } else if (someReady) {
    newOrderStatus = 'PARTIALLY_READY';
  } else if (somePreparing) {
    newOrderStatus = 'PREPARING';
  }

  if (newOrderStatus !== order.status) {
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newOrderStatus, orderId);

    db.prepare(`
      INSERT INTO order_status_history (id, order_id, user_id, previous_status, new_status, notes)
      VALUES (?, ?, ?, ?, ?, 'Item readiness transition')
    `).run(uuidv4(), orderId, req.user!.id, order.status, newOrderStatus);

    if (newOrderStatus === 'READY') {
      // Notify Waiter!
      broadcastEvent({
        type: 'ORDER_READY',
        branchId: order.branch_id,
        targetRole: ['waiter', 'admin', 'owner'],
        payload: {
          orderId,
          orderNumber: order.order_number,
          waiterId: order.waiter_id,
          message: `Order #${order.order_number} is fully ready for delivery!`
        }
      });
    }
  }

  res.json({ message: 'Item status updated', itemStatus: status, orderStatus: newOrderStatus });
});

// 7. Waiter Delivers Order
orderRouter.post('/:id/deliver', authenticate, (req: AuthenticatedRequest, res) => {
  const orderId = req.params.id;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  db.prepare(`
    UPDATE orders
    SET status = 'DELIVERED',
        delivered_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(orderId);

  db.prepare(`
    INSERT INTO order_status_history (id, order_id, user_id, previous_status, new_status, notes)
    VALUES (?, ?, ?, ?, 'DELIVERED', 'Waiter delivered order to customer/table')
  `).run(uuidv4(), orderId, req.user!.id, order.status);

  logAudit({
    branchId: order.branch_id,
    userId: req.user!.id,
    action: 'ORDER_DELIVERED',
    entityType: 'ORDER',
    entityId: orderId,
    details: { orderNumber: order.order_number, waiter: req.user!.full_name }
  });

  broadcastEvent({
    type: 'ORDER_DELIVERED',
    branchId: order.branch_id,
    payload: { orderId, orderNumber: order.order_number, status: 'DELIVERED' }
  });

  res.json({ message: 'Order marked delivered', status: 'DELIVERED' });
});

// 8. Cancel Order (with Reason & Audit)
orderRouter.post('/:id/cancel', authenticate, (req: AuthenticatedRequest, res) => {
  const orderId = req.params.id;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: 'Cancellation reason is required' });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (order.status === 'COMPLETED') {
    return res.status(400).json({ error: 'Completed orders cannot be cancelled directly. Void/Refund required.' });
  }

  // If order was confirmed/preparing, check permission
  if (['CONFIRMED', 'PREPARING', 'READY'].includes(order.status)) {
    if (!['admin', 'owner', 'cashier'].includes(req.user!.role)) {
      return res.status(403).json({ error: 'Cancelling confirmed or in-progress order requires Cashier, Admin or Owner authorization.' });
    }
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE orders
      SET status = 'CANCELLED',
          cancelled_at = CURRENT_TIMESTAMP,
          cancelled_by_id = ?,
          cancellation_reason = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user!.id, reason, orderId);

    // Release table if occupied
    if (order.table_id) {
      db.prepare("UPDATE restaurant_tables SET status = 'AVAILABLE' WHERE id = ?").run(order.table_id);
    }

    db.prepare(`
      INSERT INTO order_status_history (id, order_id, user_id, previous_status, new_status, notes)
      VALUES (?, ?, ?, ?, 'CANCELLED', ?)
    `).run(uuidv4(), orderId, req.user!.id, order.status, reason);
  });

  tx();

  logAudit({
    branchId: order.branch_id,
    userId: req.user!.id,
    action: 'ORDER_CANCELLED',
    entityType: 'ORDER',
    entityId: orderId,
    details: { orderNumber: order.order_number, reason, cancelledBy: req.user!.full_name }
  });

  broadcastEvent({
    type: 'ORDER_CANCELLED',
    branchId: order.branch_id,
    payload: { orderId, orderNumber: order.order_number, reason }
  });

  res.json({ message: 'Order cancelled successfully', status: 'CANCELLED' });
});
