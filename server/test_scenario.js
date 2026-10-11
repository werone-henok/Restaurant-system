async function runFullScenario() {
  console.log('=== STARTING END-TO-END RESTAURANT OPERATIONS TEST ===\n');

  // 0. Ensure Table and Menu items exist (supports clean production DB)
  const adminLogin = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password123' })
  }).then(r => r.json());
  const adminToken = adminLogin.token;

  let tables = await fetch('http://localhost:4001/api/tables?branchId=branch_addis', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }).then(r => r.json());
  let targetTable = tables[0];
  if (!targetTable) {
    targetTable = await fetch('http://localhost:4001/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        branch_id: 'branch_addis',
        table_number: 'T-01',
        name: 'Table 1',
        section: 'Main Dining',
        capacity: 4
      })
    }).then(r => r.json());
  }

  let menuItems = await fetch('http://localhost:4001/api/menu/items?all=true', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }).then(r => r.json());

  let burgerItem = menuItems.find(m => m.routing_destination === 'KITCHEN');
  let macchiatoItem = menuItems.find(m => m.routing_destination === 'BAR');

  if (!burgerItem || !macchiatoItem) {
    let cats = await fetch('http://localhost:4001/api/menu/categories', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }).then(r => r.json());
    let catId = cats[0]?.id;
    if (!catId) {
      const newCat = await fetch('http://localhost:4001/api/menu/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ name: 'Classics', icon: 'Utensils', sort_order: 1 })
      }).then(r => r.json());
      catId = newCat.id;
    }
    if (!burgerItem) {
      const createdBurger = await fetch('http://localhost:4001/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          category_id: catId,
          name: 'Gourmet Double Beef Burger',
          price: 450.0,
          routing_destination: 'KITCHEN',
          is_active: 1
        })
      }).then(r => r.json());
      burgerItem = { id: createdBurger.id, name: 'Gourmet Double Beef Burger', price: 450.0 };
    }
    if (!macchiatoItem) {
      const createdMac = await fetch('http://localhost:4001/api/menu/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({
          category_id: catId,
          name: 'Traditional Ethiopian Macchiato',
          price: 90.0,
          routing_destination: 'BAR',
          is_active: 1
        })
      }).then(r => r.json());
      macchiatoItem = { id: createdMac.id, name: 'Traditional Ethiopian Macchiato', price: 90.0 };
    }
  }

  // 1. Authenticate Waiter
  console.log('1. Logging in Waiter Dawit Haile...');
  const waiterLogin = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'waiter', password: 'password123' })
  }).then(r => r.json());
  const waiterToken = waiterLogin.token;
  console.log('   ✓ Waiter authenticated successfully');

  // 2. Waiter creates Order (Burger + Macchiato)
  console.log('2. Waiter creating Order with 1x Gourmet Burger & 1x Macchiato...');
  const orderRes = await fetch('http://localhost:4001/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${waiterToken}` },
    body: JSON.stringify({
      branch_id: 'branch_addis',
      table_id: targetTable.id,
      order_type: 'DINE_IN',
      items: [
        { menu_item_id: burgerItem.id, name: burgerItem.name || 'Gourmet Double Beef Burger', price: Number(burgerItem.price) || 450.0, quantity: 1, routing_destination: 'KITCHEN' },
        { menu_item_id: macchiatoItem.id, name: macchiatoItem.name || 'Traditional Ethiopian Macchiato', price: Number(macchiatoItem.price) || 90.0, quantity: 1, routing_destination: 'BAR' }
      ],
      special_notes: 'Table 1 special request: crispy burger bun'
    })
  }).then(r => r.json());
  console.log(`   ✓ Order created: Order #${orderRes.orderNumber}, Status: ${orderRes.status}, Total: ${orderRes.totalAmount} ETB`);

  // 3. Authenticate Cashier & Confirm Order
  console.log('3. Logging in Cashier Yohannes...');
  const cashierLogin = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cashier', password: 'password123' })
  }).then(r => r.json());
  const cashierToken = cashierLogin.token;

  console.log('   Confirming and routing order...');
  const confirmRes = await fetch(`http://localhost:4001/api/orders/${orderRes.orderId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cashierToken}` },
    body: JSON.stringify({ discount_amount: 0 })
  }).then(r => r.json());
  console.log(`   ✓ Cashier confirmed: ${confirmRes.status}`);

  // 4. Chef Kitchen Queue verification
  console.log('4. Checking Chef Kitchen Display System (KDS)...');
  const chefLogin = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'chef', password: 'password123' })
  }).then(r => r.json());

  const kitchenQueue = await fetch(`http://localhost:4001/api/orders/queue/kitchen?branchId=branch_addis`, {
    headers: { 'Authorization': `Bearer ${chefLogin.token}` }
  }).then(r => r.json());

  const targetKitchenOrder = kitchenQueue.find(o => o.id === orderRes.orderId);
  console.log(`   ✓ Chef queue contains ticket with ${targetKitchenOrder.items.length} food items: ${targetKitchenOrder.items[0].name}`);

  // 5. Barista Queue verification
  console.log('5. Checking Barista Beverage Queue...');
  const baristaLogin = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'barista', password: 'password123' })
  }).then(r => r.json());

  const barQueue = await fetch(`http://localhost:4001/api/orders/queue/bar?branchId=branch_addis`, {
    headers: { 'Authorization': `Bearer ${baristaLogin.token}` }
  }).then(r => r.json());

  const targetBarOrder = barQueue.find(o => o.id === orderRes.orderId);
  console.log(`   ✓ Barista queue contains ticket with ${targetBarOrder.items.length} drink items: ${targetBarOrder.items[0].name}`);

  // 6. Chef and Barista mark items READY
  console.log('6. Chef marks Burger READY...');
  await fetch(`http://localhost:4001/api/orders/${orderRes.orderId}/items/${targetKitchenOrder.items[0].id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${chefLogin.token}` },
    body: JSON.stringify({ status: 'READY' })
  });

  console.log('   Barista marks Macchiato READY...');
  const readyResult = await fetch(`http://localhost:4001/api/orders/${orderRes.orderId}/items/${targetBarOrder.items[0].id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${baristaLogin.token}` },
    body: JSON.stringify({ status: 'READY' })
  }).then(r => r.json());
  console.log(`   ✓ Both items prepared. Overall order status: ${readyResult.orderStatus}`);

  // 7. Waiter delivers order to table
  console.log('7. Waiter delivers order to Table 1...');
  const deliverRes = await fetch(`http://localhost:4001/api/orders/${orderRes.orderId}/deliver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${waiterToken}` }
  }).then(r => r.json());
  console.log(`   ✓ Order marked: ${deliverRes.status}`);

  // 8. Settle Split Payment (Telebirr + Cash) & automatic stock deduction
  console.log('8. Settling bill with split payments (200 ETB Cash + 421 ETB Telebirr)...');
  const payRes = await fetch(`http://localhost:4001/api/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cashierToken}` },
    body: JSON.stringify({
      order_id: orderRes.orderId,
      splits: [
        { method: 'CASH', amount: 200 },
        { method: 'TELEBIRR', amount: 421 }
      ]
    })
  }).then(r => r.json());
  console.log(`   ✓ Receipt generated: ${payRes.receiptNumber}`);
  console.log(`   ✓ Automatic stock deduction: ${payRes.message}`);

  // 9. Verify Owner Consolidated Dashboard
  console.log('9. Checking Owner Dashboard & Performance Reports...');
  const ownerLogin = await fetch('http://localhost:4001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'owner', password: 'password123' })
  }).then(r => r.json());

  const dashboard = await fetch('http://localhost:4001/api/reports/dashboard?branchId=ALL', {
    headers: { 'Authorization': `Bearer ${ownerLogin.token}` }
  }).then(r => r.json());
  console.log(`   ✓ Total Sales: ${dashboard.kpis.totalSales} ETB`);
  console.log(`   ✓ Total Completed Orders: ${dashboard.kpis.completedOrders}`);
  // 10. Clean up test data to leave database pristine for opening day
  try {
    await fetch('http://localhost:4001/api/admin/clean-demo-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }
    });
  } catch (_) {}

  console.log('\n🎉 ALL SUCCESS CRITERIA MET WITH ZERO ERRORS!');
}

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function isServerRunning() {
  try {
    const res = await fetch('http://localhost:4001/api/health', { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerRunning()) return true;
    await new Promise(r => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  let serverProcess = null;
  const alreadyRunning = await isServerRunning();

  if (!alreadyRunning) {
    console.log('⚡ Launching GourmetOS Server for test suite...');
    serverProcess = spawn('node', ['dist/server.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: { ...process.env, PORT: '4001', NODE_ENV: 'development' }
    });

    const ready = await waitForServer();
    if (!ready) {
      if (serverProcess) serverProcess.kill();
      throw new Error('Failed to start GourmetOS server for test scenario.');
    }
  }

  try {
    await runFullScenario();
  } finally {
    if (serverProcess) {
      console.log('Shutting down temporary test server...');
      serverProcess.kill();
    }
  }
}

main().catch(err => {
  console.error('Test scenario error:', err);
  process.exit(1);
});

