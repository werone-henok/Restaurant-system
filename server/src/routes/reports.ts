import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';

export const reportRouter = Router();

// Dashboard Metrics (Today or Custom Range)
reportRouter.get('/dashboard', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const branchId = req.query.branchId as string; // if not provided or 'ALL', consolidated across all branches (Owner)
  const isConsolidated = !branchId || branchId === 'ALL';
  const range = (req.query.range as string) || 'today';
  const from = req.query.from as string;
  const to = req.query.to as string;

  // Date filters
  let orderDateClause = "date(o.created_at) = date('now')";
  let expenseDateClause = "date(expense_date) = date('now')";
  let dateParamsOrders: any[] = [];
  let dateParamsExpenses: any[] = [];

  if (from && to) {
    orderDateClause = "date(o.created_at) BETWEEN date(?) AND date(?)";
    expenseDateClause = "date(expense_date) BETWEEN date(?) AND date(?)";
    dateParamsOrders = [from, to];
    dateParamsExpenses = [from, to];
  } else if (range === 'yesterday') {
    orderDateClause = "date(o.created_at) = date('now', '-1 day')";
    expenseDateClause = "date(expense_date) = date('now', '-1 day')";
  } else if (range === 'week') {
    orderDateClause = "date(o.created_at) >= date('now', '-7 days')";
    expenseDateClause = "date(expense_date) >= date('now', '-7 days')";
  } else if (range === 'month') {
    orderDateClause = "date(o.created_at) >= date('now', '-30 days')";
    expenseDateClause = "date(expense_date) >= date('now', '-30 days')";
  }

  let branchFilterOrders = '';
  let branchFilterExpenses = '';
  const branchParamsOrders: any[] = [];
  const branchParamsExpenses: any[] = [];

  if (!isConsolidated) {
    branchFilterOrders = 'AND o.branch_id = ?';
    branchParamsOrders.push(branchId);
    branchFilterExpenses = 'AND branch_id = ?';
    branchParamsExpenses.push(branchId);
  }

  // 1. Sales & Order Stats in Date Range
  const salesStats = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END), 0) as total_sales,
      COALESCE(AVG(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE NULL END), 0) as avg_order_value
    FROM orders o
    WHERE ${orderDateClause} ${branchFilterOrders}
  `).get(...dateParamsOrders, ...branchParamsOrders) as any;

  // 2. Expenses in Date Range
  const expenseStats = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_expenses
    FROM expenses
    WHERE ${expenseDateClause} ${branchFilterExpenses}
  `).get(...dateParamsExpenses, ...branchParamsExpenses) as any;

  // 3. Top Selling Menu Items
  const topSellers = db.prepare(`
    SELECT mi.name, mi.name_amharic, SUM(oi.quantity) as quantity_sold, SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.status = 'COMPLETED' AND ${orderDateClause} ${branchFilterOrders}
    GROUP BY mi.id
    ORDER BY quantity_sold DESC LIMIT 10
  `).all(...dateParamsOrders, ...branchParamsOrders);

  // 4. Waiter Performance in Date Range
  const waiterStats = db.prepare(`
    SELECT u.full_name as waiter_name, COUNT(o.id) as orders_count, COALESCE(SUM(o.total_amount), 0) as sales_total
    FROM orders o
    JOIN users u ON o.waiter_id = u.id
    WHERE o.status = 'COMPLETED' AND ${orderDateClause} ${branchFilterOrders}
    GROUP BY u.id
    ORDER BY sales_total DESC LIMIT 5
  `).all(...dateParamsOrders, ...branchParamsOrders);

  // 5. Daily Trend for Visual Charts
  const dailyTrend = db.prepare(`
    SELECT date(o.created_at) as date,
           COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END), 0) as sales,
           COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE NULL END) as orders
    FROM orders o
    WHERE ${orderDateClause} ${branchFilterOrders}
    GROUP BY date(o.created_at)
    ORDER BY date ASC
  `).all(...dateParamsOrders, ...branchParamsOrders);

  // 6. Hourly Sales & Rush-Hour Peak Heatmap
  const hourlyTrend = db.prepare(`
    SELECT strftime('%H:00', o.created_at) as hour,
           COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END), 0) as sales,
           COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE NULL END) as orders
    FROM orders o
    WHERE ${orderDateClause} ${branchFilterOrders}
    GROUP BY strftime('%H:00', o.created_at)
    ORDER BY hour ASC
  `).all(...dateParamsOrders, ...branchParamsOrders);

  // 7. Payment Methods Breakdown (Cash, Telebirr, CBE Birr, Card)
  let paymentDateClause = "date(p.created_at) = date('now')";
  let paymentDateParams: any[] = [];
  if (from && to) {
    paymentDateClause = "date(p.created_at) BETWEEN date(?) AND date(?)";
    paymentDateParams = [from, to];
  } else if (range === 'yesterday') {
    paymentDateClause = "date(p.created_at) = date('now', '-1 day')";
  } else if (range === 'week') {
    paymentDateClause = "date(p.created_at) >= date('now', '-7 days')";
  } else if (range === 'month') {
    paymentDateClause = "date(p.created_at) >= date('now', '-30 days')";
  }

  let branchFilterPayments = '';
  const branchParamsPayments: any[] = [];
  if (!isConsolidated) {
    branchFilterPayments = 'AND p.branch_id = ?';
    branchParamsPayments.push(branchId);
  }

  const paymentMethods = db.prepare(`
    SELECT 
      p.method,
      COUNT(*) as tx_count,
      COALESCE(SUM(p.amount), 0) as total_amount
    FROM payments p
    WHERE ${paymentDateClause} ${branchFilterPayments}
    GROUP BY p.method
    ORDER BY total_amount DESC
  `).all(...paymentDateParams, ...branchParamsPayments);

  // 8. BOM Cost & Gross Profit Margin per Menu Item
  const menuProfitMargins = db.prepare(`
    SELECT 
      mi.id,
      mi.name,
      mi.name_amharic,
      mi.price,
      ROUND(COALESCE(bom.cost, 0), 2) as cogs_cost,
      ROUND(mi.price - COALESCE(bom.cost, 0), 2) as profit_per_unit,
      ROUND(((mi.price - COALESCE(bom.cost, 0)) / MAX(mi.price, 1)) * 100, 1) as margin_percent,
      COALESCE(sales.units_sold, 0) as units_sold,
      ROUND(COALESCE(sales.total_revenue, 0), 2) as total_revenue,
      ROUND(COALESCE(sales.units_sold, 0) * (mi.price - COALESCE(bom.cost, 0)), 2) as total_gross_profit
    FROM menu_items mi
    LEFT JOIN (
      SELECT r.menu_item_id, SUM(ri.quantity_required * ing.unit_cost) / MAX(COALESCE(r.yield_portions, 1)) as cost
      FROM recipes r
      JOIN recipe_items ri ON r.id = ri.recipe_id
      JOIN ingredients ing ON ri.ingredient_id = ing.id
      GROUP BY r.menu_item_id
    ) bom ON mi.id = bom.menu_item_id
    LEFT JOIN (
      SELECT oi.menu_item_id, SUM(oi.quantity) as units_sold, SUM(oi.quantity * oi.price) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'COMPLETED' AND ${orderDateClause} ${branchFilterOrders}
      GROUP BY oi.menu_item_id
    ) sales ON mi.id = sales.menu_item_id
    GROUP BY mi.id
    ORDER BY total_revenue DESC LIMIT 20
  `).all(...dateParamsOrders, ...branchParamsOrders);

  // 9. Voids, Cancellations & Discounts Audit
  const auditLosses = db.prepare(`
    SELECT 
      COUNT(CASE WHEN o.status = 'CANCELLED' THEN 1 END) as cancelled_count,
      COALESCE(SUM(CASE WHEN o.status = 'CANCELLED' THEN o.total_amount ELSE 0 END), 0) as cancelled_loss,
      COUNT(CASE WHEN o.discount_amount > 0 THEN 1 END) as discounted_count,
      COALESCE(SUM(o.discount_amount), 0) as total_discounts
    FROM orders o
    WHERE ${orderDateClause} ${branchFilterOrders}
  `).get(...dateParamsOrders, ...branchParamsOrders) as any;

  // 10. Low Stock Count
  let lowStockQuery = `
    SELECT COUNT(*) as count 
    FROM inventory_stock s
    JOIN ingredients i ON s.ingredient_id = i.id
    WHERE s.current_quantity <= i.min_stock_level
  `;
  const lowStockParams: any[] = [];
  if (!isConsolidated) {
    lowStockQuery += ` AND s.branch_id = ?`;
    lowStockParams.push(branchId);
  }
  const lowStockCount = (db.prepare(lowStockQuery).get(...lowStockParams) as any)?.count || 0;

  // 11. Branch Comparison (Consolidated view for Owner)
  const branchComparison = db.prepare(`
    SELECT b.id, b.name, b.city,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END), 0) as sales,
      COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE NULL END) as orders_count
    FROM branches b
    LEFT JOIN orders o ON b.id = o.branch_id AND ${orderDateClause}
    GROUP BY b.id
  `).all(...dateParamsOrders);

  const netProfit = +(salesStats.total_sales - expenseStats.total_expenses).toFixed(2);
  const grossProfitMargin = salesStats.total_sales > 0 
    ? Math.round(((salesStats.total_sales - expenseStats.total_expenses) / salesStats.total_sales) * 100) 
    : 0;

  res.json({
    isConsolidated,
    selectedBranch: branchId || 'ALL',
    range,
    kpis: {
      totalSales: salesStats.total_sales,
      totalExpenses: expenseStats.total_expenses,
      netProfit,
      grossProfitMargin,
      totalOrders: salesStats.total_orders,
      completedOrders: salesStats.completed_orders,
      cancelledOrders: salesStats.cancelled_orders,
      avgOrderValue: +salesStats.avg_order_value.toFixed(2),
      lowStockCount,
      totalDiscounts: auditLosses?.total_discounts || 0,
      cancelledLoss: auditLosses?.cancelled_loss || 0
    },
    dailyTrend,
    hourlyTrend,
    paymentMethods,
    menuProfitMargins,
    auditLosses,
    topSellers,
    waiterStats,
    branchComparison
  });
});

// Detailed Waiter Performance Report (No tip fields as requested)
reportRouter.get('/waiters', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const branchId = req.query.branchId as string;
  let query = `
    SELECT 
      u.id, u.full_name, u.employee_id,
      COUNT(o.id) as total_orders,
      SUM(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END), 0) as total_sales,
      COALESCE(AVG(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE NULL END), 0) as avg_order_value,
      COALESCE(SUM(o.discount_amount), 0) as total_discounts_applied
    FROM users u
    LEFT JOIN orders o ON u.id = o.waiter_id
    WHERE u.role = 'waiter'
  `;
  const params: any[] = [];
  if (branchId && branchId !== 'ALL') {
    query += ` AND u.branch_id = ?`;
    params.push(branchId);
  }
  query += ` GROUP BY u.id ORDER BY total_sales DESC`;

  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// CSV Export for Sales
reportRouter.get('/export/sales', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const { from, to, branchId } = req.query as { from?: string; to?: string; branchId?: string };

  let sql = `
    SELECT o.order_number, COALESCE(b.name, 'Unknown') as branch, o.created_at, o.total_amount, o.status,
           COALESCE(GROUP_CONCAT(mi.name || ' x' || oi.quantity, '; '), '') as items
    FROM orders o
    LEFT JOIN branches b ON o.branch_id = b.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (from) { sql += ' AND date(o.created_at) >= date(?)'; params.push(from); }
  if (to) { sql += ' AND date(o.created_at) <= date(?)'; params.push(to); }
  if (branchId && branchId !== 'ALL') { sql += ' AND o.branch_id = ?'; params.push(branchId); }
  sql += ' GROUP BY o.id ORDER BY o.created_at DESC';

  const rows = db.prepare(sql).all(...params) as any[];

  const filename = `sales_${from || 'start'}_to_${to || 'now'}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Write UTF-8 BOM for Excel compatibility
  res.write('\uFEFF');
  res.write('Order Number,Branch,Date,Total Amount (ETB),Status,Items\n');

  for (const row of rows) {
    const orderNumber = `"${String(row.order_number || '').replace(/"/g, '""')}"`;
    const branch = `"${String(row.branch || '').replace(/"/g, '""')}"`;
    const createdAt = `"${String(row.created_at || '').replace(/"/g, '""')}"`;
    const totalAmount = Number(row.total_amount || 0).toFixed(2);
    const status = `"${String(row.status || '').replace(/"/g, '""')}"`;
    const items = `"${String(row.items || '').replace(/"/g, '""')}"`;

    res.write(`${orderNumber},${branch},${createdAt},${totalAmount},${status},${items}\n`);
  }
  res.end();
});

