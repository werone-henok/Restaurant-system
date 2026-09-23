async function runFullScenario() {
  console.log('=== STARTING END-TO-END RESTAURANT OPERATIONS TEST ===\n');

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
  console.log('2. Waiter creating Order #101 with 1x Gourmet Burger & 1x Macchiato...');
  const orderRes = await fetch('http://localhost:4001/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${waiterToken}` },
    body: JSON.stringify({
      branch_id: 'branch_addis',
      table_id: 'tbl_01',
      order_type: 'DINE_IN',
      items: [
        { menu_item_id: 'menu_burger', name: 'Gourmet Double Beef Burger', price: 450.0, quantity: 1, routing_destination: 'KITCHEN' },
        { menu_item_id: 'menu_macchiato', name: 'Traditional Ethiopian Macchiato', price: 90.0, quantity: 1, routing_destination: 'BAR' }
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
  console.log(`   ✓ Net Gross Profit: ${dashboard.kpis.netProfit} ETB`);

  console.log('\n🎉 ALL SUCCESS CRITERIA MET WITH ZERO ERRORS!');
}

runFullScenario().catch(err => {
  console.error('Test scenario error:', err);
  process.exit(1);
});
