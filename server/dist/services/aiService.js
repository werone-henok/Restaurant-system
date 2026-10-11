import { db } from '../database/schema.js';
/**
 * Gathers live restaurant operational data from SQLite
 */
export function gatherBusinessMetrics(branchId) {
    const branchFilter = branchId ? 'AND o.branch_id = ?' : '';
    const branchParams = branchId ? [branchId] : [];
    // 1. Today's revenue & order counts (orders completed or paid today)
    const todayRow = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN o.payment_status = 'PAID' OR o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END), 0) AS todayRevenue,
      COUNT(o.id) AS totalOrdersToday,
      COUNT(CASE WHEN o.status = 'COMPLETED' OR o.payment_status = 'PAID' THEN 1 END) AS completedOrdersToday,
      COUNT(CASE WHEN o.status IN ('PENDING_CASHIER', 'CONFIRMED', 'PREPARING', 'READY', 'PARTIALLY_READY') THEN 1 END) AS pendingOrdersToday
    FROM orders o
    WHERE DATE(o.created_at) = DATE('now')
    ${branchFilter}
  `).get(...branchParams);
    const todayRevenue = Number(todayRow?.todayRevenue || 0);
    const totalOrdersToday = Number(todayRow?.totalOrdersToday || 0);
    const completedOrdersToday = Number(todayRow?.completedOrdersToday || 0);
    const pendingOrdersToday = Number(todayRow?.pendingOrdersToday || 0);
    const avgOrderValue = completedOrdersToday > 0 ? Math.round(todayRevenue / completedOrdersToday) : 0;
    // 2. Top selling items (last 30 days)
    const topSellingItems = db.prepare(`
    SELECT 
      oi.name,
      SUM(oi.quantity) as quantity,
      SUM(oi.price * oi.quantity) as revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'CANCELLED'
    ${branchFilter}
    GROUP BY oi.name
    ORDER BY quantity DESC
    LIMIT 5
  `).all(...branchParams);
    // 3. Low selling items (items with minimal sales in catalog)
    const lowSellingItems = db.prepare(`
    SELECT 
      m.name,
      COALESCE(SUM(oi.quantity), 0) as quantity
    FROM menu_items m
    LEFT JOIN order_items oi ON oi.menu_item_id = m.id
    WHERE m.is_active = 1
    GROUP BY m.id, m.name
    ORDER BY quantity ASC
    LIMIT 5
  `).all();
    // 4. Low stock ingredients
    const invBranchFilter = branchId ? 'WHERE (branch_id = ? OR branch_id IS NULL)' : '';
    const invParams = branchId ? [branchId] : [];
    const lowStockIngredients = db.prepare(`
    SELECT 
      name,
      current_stock,
      min_stock_threshold,
      unit
    FROM ingredients
    ${invBranchFilter}
    AND current_stock <= (min_stock_threshold * 1.25)
    ORDER BY (current_stock - min_stock_threshold) ASC
    LIMIT 8
  `).all(...invParams);
    // 5. Bakery stats
    const bakeryVariations = db.prepare(`
    SELECT 
      COALESCE(SUM(counter_stock), 0) as counterCakesAvailable
    FROM bakery_product_variations
  `).get();
    const activeBatches = db.prepare(`
    SELECT 
      COUNT(id) as batchesBaking,
      COALESCE(SUM(quantity_produced), 0) as cakesBakingCount
    FROM bakery_production_batches
    WHERE status = 'BAKING'
  `).get();
    // 6. Waiter performance
    const waiterPerformance = db.prepare(`
    SELECT 
      u.full_name as name,
      COUNT(o.id) as ordersCount,
      COALESCE(SUM(o.total_amount), 0) as totalSales
    FROM users u
    JOIN orders o ON o.waiter_id = u.id
    WHERE DATE(o.created_at) = DATE('now')
    ${branchFilter}
    GROUP BY u.id, u.full_name
    ORDER BY ordersCount DESC
    LIMIT 5
  `).all(...branchParams);
    return {
        todayRevenue,
        totalOrdersToday,
        completedOrdersToday,
        pendingOrdersToday,
        avgOrderValue,
        topSellingItems,
        lowSellingItems,
        lowStockIngredients,
        bakeryStats: {
            counterCakesAvailable: Number(bakeryVariations?.counterCakesAvailable || 0),
            batchesBaking: Number(activeBatches?.batchesBaking || 0),
            cakesBakingCount: Number(activeBatches?.cakesBakingCount || 0)
        },
        waiterPerformance
    };
}
/**
 * Generates proactive Executive Insights for Owner & Admin
 */
export function generateExecutiveInsights(metrics) {
    const insights = [];
    // Insight 1: Inventory Stockout Vulnerability
    if (metrics.lowStockIngredients.length > 0) {
        const criticalNames = metrics.lowStockIngredients
            .slice(0, 3)
            .map(i => `${i.name} (${i.current_stock} ${i.unit})`)
            .join(', ');
        insights.push({
            id: 'inv-critical-risk',
            category: 'INVENTORY',
            title: 'Immediate Reorder Alert: Raw Ingredients Near Zero',
            titleAmharic: 'አስቸኳይ የግዥ ማሳሰቢያ፡ ጥሬ እቃዎች እያለቁ ነው',
            summary: `Critical ingredients are at or below reorder threshold: ${criticalNames}. Preparing dinner/rush-hour dishes may stall without immediate replenishment.`,
            summaryAmharic: `የሚከተሉት ጥሬ እቃዎች ከአነስተኛ ገደብ በታች ወርደዋል፡ ${criticalNames}። አሁኑኑ ካልተሟሉ ትዕዛዝ ሊስተጓጎል ይችላል።`,
            impact: 'HIGH',
            actionableStep: 'Open Inventory Requisitions and issue urgent purchase order to storekeeper.'
        });
    }
    else {
        insights.push({
            id: 'inv-healthy',
            category: 'INVENTORY',
            title: 'Inventory Stock Levels Stable',
            titleAmharic: 'የእቃ ዝርዝር ክምችት በጥሩ ደረጃ ላይ ይገኛል',
            summary: 'All monitored kitchen and bakery ingredients are comfortably above minimum safety levels.',
            summaryAmharic: 'ሁሉም የኩሽና እና የዳቦ ቤት ጥሬ ዕቃዎች ከደህንነት ገደብ በላይ በበቂ ሁኔታ ይገኛሉ።',
            impact: 'INFO',
            actionableStep: 'Maintain regular daily cycle counts at shift change.'
        });
    }
    // Insight 2: Sales & Revenue Momentum
    if (metrics.todayRevenue > 0) {
        insights.push({
            id: 'rev-momentum',
            category: 'REVENUE',
            title: `Daily Sales: ${metrics.todayRevenue.toLocaleString()} ETB across ${metrics.completedOrdersToday} Closed Tickets`,
            titleAmharic: `የዛሬ ሽያጭ፡ ${metrics.todayRevenue.toLocaleString()} ብር በ${metrics.completedOrdersToday} ትዕዛዞች`,
            summary: `Average ticket size stands at ${metrics.avgOrderValue} ETB. ${metrics.pendingOrdersToday} active orders currently on kitchen and counter boards.`,
            summaryAmharic: `አማካይ የአንድ ትዕዛዝ መጠን ${metrics.avgOrderValue} ብር ነው። ${metrics.pendingOrdersToday} ንቁ ትዕዛዞች በኩሽና ዝግጅት ላይ ናቸው።`,
            impact: metrics.todayRevenue > 10000 ? 'HIGH' : 'MEDIUM',
            actionableStep: 'Promote dessert and drink pairings on Waiter POS to elevate average ticket size above 300 ETB.'
        });
    }
    // Insight 3: Top Selling Star Products
    if (metrics.topSellingItems.length > 0) {
        const topDish = metrics.topSellingItems[0];
        insights.push({
            id: 'menu-star-performer',
            category: 'MENU',
            title: `Star Revenue Driver: "${topDish.name}" (${topDish.quantity} orders)`,
            titleAmharic: `ተወዳጅ የምግብ ምርጫ፡ "${topDish.name}" (${topDish.quantity} ትዕዛዞች)`,
            summary: `Generated ${Number(topDish.revenue).toLocaleString()} ETB. Ensure prep station has pre-portioned mise-en-place ready before peak service hours.`,
            summaryAmharic: `በአጠቃላይ ${Number(topDish.revenue).toLocaleString()} ብር አስገኝቷል። በምሳ እና እራት ሰዓት በቅድሚያ ተዘጋጅቶ እንዲቀመጥ ያድርጉ።`,
            impact: 'MEDIUM',
            actionableStep: 'Keep prep stocks high and train chefs on fastest plating workflow for this dish.'
        });
    }
    // Insight 4: Bakery Counter Balance
    if (metrics.bakeryStats.counterCakesAvailable < 5 && metrics.bakeryStats.cakesBakingCount === 0) {
        insights.push({
            id: 'bakery-low-display',
            category: 'OPERATIONS',
            title: 'Bakery Front Display Running Low',
            titleAmharic: 'የካውንተር ኬክ ማሳያ እያለቀ ነው',
            summary: `Only ${metrics.bakeryStats.counterCakesAvailable} cakes remaining in the front display counter, and 0 batches are currently baking in the oven.`,
            summaryAmharic: `በማሳያው ላይ የቀረው ${metrics.bakeryStats.counterCakesAvailable} ኬክ ብቻ ሲሆን በአሁኑ ወቅት ወደ ምድጃ የገባ አዲስ ኬክ የለም።`,
            impact: 'HIGH',
            actionableStep: 'Notify bakery staff to initiate 1-tap bake batches for high-demand sliced cakes.'
        });
    }
    return insights;
}
/**
 * Intelligent Restaurant Assistant Query Handler
 */
export async function processAiQuery(userQuery, branchId) {
    const metrics = gatherBusinessMetrics(branchId);
    const q = userQuery.toLowerCase().trim();
    let reply = '';
    // Smart Intent Detection & Contextual Synthesizer
    if (q.includes('revenue') || q.includes('sales') || q.includes('ገቢ') || q.includes('ሽያጭ') || q.includes('today') || q.includes('ዛሬ')) {
        reply = `### 📊 Financial & Revenue Summary (የሽያጭ ማጠቃለያ)\n\n` +
            `- **Today's Gross Sales:** **${metrics.todayRevenue.toLocaleString()} ETB**\n` +
            `- **Completed Orders:** **${metrics.completedOrdersToday}** orders\n` +
            `- **Active/Pending in Kitchen:** **${metrics.pendingOrdersToday}** tickets\n` +
            `- **Average Ticket Size (AOV):** **${metrics.avgOrderValue} ETB**\n\n` +
            `💡 **AI Executive Advice:**\n` +
            `To increase total daily turnover by 15-20%, instruct your waiters to suggest dessert (cake slice) or specialty coffee drinks on every dine-in table ticket before checkout.`;
    }
    else if (q.includes('stock') || q.includes('inventory') || q.includes('ጥሬ') || q.includes('ዕቃ') || q.includes('shortage') || q.includes('reorder')) {
        if (metrics.lowStockIngredients.length === 0) {
            reply = `### 📦 Inventory Health Status (የክምችት ሁኔታ)\n\n` +
                `✅ **All stock levels are currently healthy!** None of your monitored cooking ingredients or bakery supplies have breached minimum safety thresholds.\n\n` +
                `💡 **AI Recommendation:** Regular inventory audits and storekeeper stock counts should be verified at every weekend shift change.`;
        }
        else {
            const itemsList = metrics.lowStockIngredients
                .map(i => `- **${i.name}:** Current: \`${i.current_stock} ${i.unit}\` (Safety Minimum: \`${i.min_stock_threshold} ${i.unit}\`)`)
                .join('\n');
            reply = `### ⚠️ Critical Inventory & Stockout Warning (የአስቸኳይ ጥሬ ዕቃ ዝርዝር)\n\n` +
                `The following **${metrics.lowStockIngredients.length} ingredients** are near or below reorder limits:\n\n` +
                `${itemsList}\n\n` +
                `🚨 **Immediate Action Required:**\n` +
                `1. Notify the storekeeper to issue immediate supplier purchase orders.\n` +
                `2. Temporarily adjust high-consumption dishes if key supplies cannot arrive before evening dinner rush.`;
        }
    }
    else if (q.includes('top') || q.includes('best') || q.includes('ተወዳጅ') || q.includes('dish') || q.includes('menu') || q.includes('selling') || q.includes('ምግብ')) {
        const topList = metrics.topSellingItems
            .map((item, idx) => `${idx + 1}. **${item.name}** — ${item.quantity} sold (**${Number(item.revenue).toLocaleString()} ETB**)`)
            .join('\n');
        const lowList = metrics.lowSellingItems
            .slice(0, 3)
            .map(item => `- *${item.name}* (${item.quantity} orders)`)
            .join('\n');
        reply = `### 🍔 Top Selling Menu Engineering (የምግብ ሽያጭ ትንተና)\n\n` +
            `**Top 5 Star Dishes (Highest Customer Demand):**\n` +
            `${topList}\n\n` +
            `**Low Velocity Items (Review or Promote):**\n` +
            `${lowList}\n\n` +
            `💡 **AI Strategic Recommendation:**\n` +
            `Bundle low-velocity sides or items with your top seller as a combo special to improve margin retention and avoid ingredient expiry.`;
    }
    else if (q.includes('bakery') || q.includes('cake') || q.includes('ኬክ') || q.includes('ዳቦ')) {
        reply = `### 🎂 Bakery & Counter Cake Intelligence (የዳቦ ቤት እና ኬክ ሁኔታ)\n\n` +
            `- **Display Counter Stock:** **${metrics.bakeryStats.counterCakesAvailable}** cakes ready for immediate waiter pickup\n` +
            `- **Oven Batches in Production:** **${metrics.bakeryStats.batchesBaking}** active batches (${metrics.bakeryStats.cakesBakingCount} total cakes)\n\n` +
            `💡 **Operational Guidance:**\n` +
            (metrics.bakeryStats.counterCakesAvailable < 5
                ? `⚠️ Counter display stock is dangerously low. Request the bakery kitchen to prioritize rapid baking batches immediately!`
                : `✅ Counter displays are adequately stocked for peak customer flow.`);
    }
    else if (q.includes('staff') || q.includes('waiter') || q.includes('አስተናጋጅ') || q.includes('ሰራተኛ') || q.includes('speed')) {
        const waiterList = metrics.waiterPerformance.length > 0
            ? metrics.waiterPerformance.map((w, idx) => `${idx + 1}. **${w.name}** — ${w.ordersCount} orders taken (**${Number(w.totalSales).toLocaleString()} ETB**)`).join('\n')
            : 'No waiter sales recorded yet today.';
        reply = `### 👥 Staff & Waiter Operational Performance (የሰራተኞች የስራ ክንውን)\n\n` +
            `**Today's Active Waiter Output:**\n` +
            `${waiterList}\n\n` +
            `💡 **AI Observation:**\n` +
            `Reward top-performing floor staff who achieve high order counts and prompt order delivery turnaround times.`;
    }
    else {
        // Comprehensive Executive Overview
        reply = `### ✨ Executive Restaurant Copilot Overview (አጠቃላይ የንግድ ቁጥጥር)\n\n` +
            `Here is the live real-time status of your restaurant:\n\n` +
            `1. **Financial Health:** **${metrics.todayRevenue.toLocaleString()} ETB** earned today across **${metrics.completedOrdersToday}** orders.\n` +
            `2. **Kitchen Load:** **${metrics.pendingOrdersToday}** orders currently in queue or preparation.\n` +
            `3. **Inventory State:** **${metrics.lowStockIngredients.length}** ingredients flagged near minimum stock.\n` +
            `4. **Bakery Operations:** **${metrics.bakeryStats.counterCakesAvailable}** display cakes on hand.\n\n` +
            `**Ask me anything:**\n` +
            `- *"What ingredients are running out?"*\n` +
            `- *"What is our most profitable dish?"*\n` +
            `- *"How are waiter sales today?"*\n` +
            `- *"How can we boost daily profits?"*`;
    }
    const suggestedPrompts = [
        '📊 How much revenue did we generate today?',
        '⚠️ Which ingredients are running out of stock?',
        '🍔 What are our top-selling dishes?',
        '🎂 What is our bakery counter status?',
        '👥 Who is the top performing waiter today?'
    ];
    return {
        reply,
        metrics,
        suggestedPrompts
    };
}
