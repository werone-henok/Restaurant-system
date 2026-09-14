import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';

export const reportRouter = Router();

// Dashboard Metrics (Today or Custom Range)
reportRouter.get('/dashboard', authenticate, authorizeRole(['admin', 'owner']), (req: AuthenticatedRequest, res) => {
  const branchId = req.query.branchId as string; // if not provided or 'ALL', consolidated across all branches (Owner)
  const isConsolidated = !branchId || branchId === 'ALL';

  let branchFilterOrders = '';
  let branchFilterExpenses = '';
  let paramsOrders: any[] = [];
  let paramsExpenses: any[] = [];

  if (!isConsolidated) {
    branchFilterOrders = 'AND o.branch_id = ?';
    paramsOrders.push(branchId);
    branchFilterExpenses = 'AND branch_id = ?';
    paramsExpenses.push(branchId);
  }

  // 1. Sales & Order Stats Today
  const salesToday = db.prepare(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_orders,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled_orders,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE 0 END), 0) as total_sales,
      COALESCE(AVG(CASE WHEN status = 'COMPLETED' THEN total_amount ELSE NULL END), 0) as avg_order_value
    FROM orders o
    WHERE date(created_at) = date('now') ${branchFilterOrders}
  `).get(...paramsOrders) as any;

  // 2. Expenses Today
  const expensesToday = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total_expenses
    FROM expenses
    WHERE date(expense_date) = date('now') ${branchFilterExpenses}
  `).get(...paramsExpenses) as any;

  // 3. Top Selling Menu Items
  const topSellers = db.prepare(`
    SELECT mi.name, SUM(oi.quantity) as quantity_sold, SUM(oi.quantity * oi.price) as revenue
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE o.status = 'COMPLETED' ${branchFilterOrders}
    GROUP BY mi.id
    ORDER BY quantity_sold DESC LIMIT 5
  `).all(...paramsOrders);

  // 4. Waiter Performance
  const waiterStats = db.prepare(`
    SELECT u.full_name as waiter_name, COUNT(o.id) as orders_count, COALESCE(SUM(o.total_amount), 0) as sales_total
    FROM orders o
    JOIN users u ON o.waiter_id = u.id
    WHERE o.status = 'COMPLETED' ${branchFilterOrders}
    GROUP BY u.id
    ORDER BY sales_total DESC LIMIT 5
  `).all(...paramsOrders);

  // 5. Low Stock Count
  let lowStockQuery = `
    SELECT COUNT(*) as count 
    FROM inventory_stock s
    JOIN ingredients i ON s.ingredient_id = i.id
    WHERE s.current_quantity <= i.min_stock_level
  `;
  if (!isConsolidated) {
    lowStockQuery += ` AND s.branch_id = '${branchId}'`;
  }
  const lowStockCount = (db.prepare(lowStockQuery).get() as any)?.count || 0;

  // 6. Branch Comparison (Consolidated view for Owner)
  const branchComparison = db.prepare(`
    SELECT b.id, b.name, b.city,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END), 0) as sales,
      COUNT(o.id) as orders_count
    FROM branches b
    LEFT JOIN orders o ON b.id = o.branch_id AND date(o.created_at) = date('now')
    GROUP BY b.id
  `).all();

  const netProfit = +(salesToday.total_sales - expensesToday.total_expenses).toFixed(2);

  res.json({
    isConsolidated,
    selectedBranch: branchId || 'ALL',
    kpis: {
      totalSales: salesToday.total_sales,
      totalExpenses: expensesToday.total_expenses,
      netProfit,
      totalOrders: salesToday.total_orders,
      completedOrders: salesToday.completed_orders,
      cancelledOrders: salesToday.cancelled_orders,
      avgOrderValue: +salesToday.avg_order_value.toFixed(2),
      lowStockCount
    },
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
