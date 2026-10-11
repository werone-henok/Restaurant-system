import { db } from '../database/schema.js';

export interface BusinessMetrics {
  todayRevenue: number;
  totalOrdersToday: number;
  completedOrdersToday: number;
  pendingOrdersToday: number;
  avgOrderValue: number;
  topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
  lowSellingItems: Array<{ name: string; quantity: number }>;
  lowStockIngredients: Array<{ name: string; current_stock: number; min_stock_threshold: number; unit: string }>;
  bakeryStats: {
    counterCakesAvailable: number;
    batchesBaking: number;
    cakesBakingCount: number;
  };
  waiterPerformance: Array<{ name: string; ordersCount: number; totalSales: number }>;
}

export interface AiInsight {
  id: string;
  category: 'REVENUE' | 'INVENTORY' | 'MENU' | 'OPERATIONS';
  title: string;
  titleAmharic: string;
  summary: string;
  summaryAmharic: string;
  impact: 'HIGH' | 'MEDIUM' | 'INFO';
  actionableStep: string;
}

/**
 * Gathers live restaurant operational data from SQLite defensively
 */
export function gatherBusinessMetrics(branchId?: string): BusinessMetrics {
  const validBranch = branchId && branchId !== 'ALL' && branchId !== 'undefined' && branchId !== 'null';
  const branchFilter = validBranch ? 'AND o.branch_id = ?' : '';
  const branchParams = validBranch ? [branchId] : [];

  // 1. Today's revenue & order counts (orders completed today)
  let todayRevenue = 0;
  let totalOrdersToday = 0;
  let completedOrdersToday = 0;
  let pendingOrdersToday = 0;
  let avgOrderValue = 0;

  try {
    const todayRow = db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_amount ELSE 0 END), 0) AS todayRevenue,
        COUNT(o.id) AS totalOrdersToday,
        COUNT(CASE WHEN o.status = 'COMPLETED' THEN 1 END) AS completedOrdersToday,
        COUNT(CASE WHEN o.status IN ('PENDING_CASHIER', 'CONFIRMED', 'PREPARING', 'READY', 'PARTIALLY_READY') THEN 1 END) AS pendingOrdersToday
      FROM orders o
      WHERE (date(o.created_at, 'localtime') = date('now', 'localtime') OR date(o.created_at) = date('now'))
      ${branchFilter}
    `).get(...branchParams) as any;

    todayRevenue = Number(todayRow?.todayRevenue || 0);
    totalOrdersToday = Number(todayRow?.totalOrdersToday || 0);
    completedOrdersToday = Number(todayRow?.completedOrdersToday || 0);
    pendingOrdersToday = Number(todayRow?.pendingOrdersToday || 0);
    avgOrderValue = completedOrdersToday > 0 ? Math.round(todayRevenue / completedOrdersToday) : 0;
  } catch (err) {
    console.warn('[AI] Warning computing revenue metrics:', err);
  }

  // 2. Top selling items
  let topSellingItems: Array<{ name: string; quantity: number; revenue: number }> = [];
  try {
    topSellingItems = db.prepare(`
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
    `).all(...branchParams) as any[] || [];
  } catch (err) {
    console.warn('[AI] Warning computing top selling items:', err);
  }

  // 3. Low selling items (items with minimal sales in catalog)
  let lowSellingItems: Array<{ name: string; quantity: number }> = [];
  try {
    lowSellingItems = db.prepare(`
      SELECT 
        m.name,
        COALESCE(SUM(oi.quantity), 0) as quantity
      FROM menu_items m
      LEFT JOIN order_items oi ON oi.menu_item_id = m.id
      WHERE m.is_available = 1 AND m.deleted_at IS NULL
      GROUP BY m.id, m.name
      ORDER BY quantity ASC
      LIMIT 5
    `).all() as any[] || [];
  } catch (err) {
    console.warn('[AI] Warning computing low selling items:', err);
  }

  // 4. Low stock ingredients
  let lowStockIngredients: Array<{ name: string; current_stock: number; min_stock_threshold: number; unit: string }> = [];
  try {
    const invBranchJoin = validBranch ? 'AND (s.branch_id = ? OR s.branch_id IS NULL)' : '';
    const invParams = validBranch ? [branchId] : [];
    lowStockIngredients = db.prepare(`
      SELECT 
        i.name,
        COALESCE(s.current_quantity, 0) as current_stock,
        i.min_stock_level as min_stock_threshold,
        i.unit
      FROM ingredients i
      LEFT JOIN inventory_stock s ON i.id = s.ingredient_id ${invBranchJoin}
      WHERE i.is_active = 1 
        AND COALESCE(s.current_quantity, 0) <= i.min_stock_level
      ORDER BY (COALESCE(s.current_quantity, 0) - i.min_stock_level) ASC
      LIMIT 8
    `).all(...invParams) as any[] || [];
  } catch (err) {
    console.warn('[AI] Warning computing low stock ingredients:', err);
  }

  // 5. Bakery stats
  let counterCakesAvailable = 0;
  let batchesBaking = 0;
  let cakesBakingCount = 0;
  try {
    const bakeryVariations = db.prepare(`
      SELECT 
        COALESCE(SUM(counter_stock), 0) as counterCakesAvailable
      FROM bakery_product_variations
    `).get() as any;
    counterCakesAvailable = Number(bakeryVariations?.counterCakesAvailable || 0);

    const activeBatches = db.prepare(`
      SELECT 
        COUNT(id) as batchesBaking,
        COALESCE(SUM(quantity_produced), 0) as cakesBakingCount
      FROM bakery_batches
      WHERE status = 'BAKING'
    `).get() as any;
    batchesBaking = Number(activeBatches?.batchesBaking || 0);
    cakesBakingCount = Number(activeBatches?.cakesBakingCount || 0);
  } catch (err) {
    console.warn('[AI] Warning computing bakery stats:', err);
  }

  // 6. Waiter performance
  let waiterPerformance: Array<{ name: string; ordersCount: number; totalSales: number }> = [];
  try {
    waiterPerformance = db.prepare(`
      SELECT 
        u.full_name as name,
        COUNT(o.id) as ordersCount,
        COALESCE(SUM(o.total_amount), 0) as totalSales
      FROM users u
      JOIN orders o ON o.waiter_id = u.id
      WHERE (date(o.created_at, 'localtime') = date('now', 'localtime') OR date(o.created_at) = date('now'))
      ${branchFilter}
      GROUP BY u.id, u.full_name
      ORDER BY ordersCount DESC
      LIMIT 5
    `).all(...branchParams) as any[] || [];
  } catch (err) {
    console.warn('[AI] Warning computing waiter performance:', err);
  }

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
      counterCakesAvailable,
      batchesBaking,
      cakesBakingCount
    },
    waiterPerformance
  };
}

/**
 * Generates proactive Executive Insights for Owner & Admin
 */
export function generateExecutiveInsights(metrics: BusinessMetrics): AiInsight[] {
  const insights: AiInsight[] = [];

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
  } else {
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
  } else {
    insights.push({
      id: 'rev-standby',
      category: 'REVENUE',
      title: 'POS Ready for Daily Trading',
      titleAmharic: 'የሽያጭ ስርዓቱ ለዛሬው የስራ ቀን ዝግጁ ነው',
      summary: 'No closed tickets recorded for today yet. Active tables and kitchen stations are synchronized.',
      summaryAmharic: 'እስካሁን የተጠናቀቀ ሽያጭ አልተመዘገበም። የጠረጴዛ እና የኩሽና ስርዓቱ ዝግጁ ነው።',
      impact: 'INFO',
      actionableStep: 'Open waiter tablets and verify floor section assignments.'
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
  } else {
    insights.push({
      id: 'menu-ready',
      category: 'MENU',
      title: 'Menu Catalog Fully Synchronized',
      titleAmharic: 'የምግብ ዝርዝር በተሟላ ሁኔታ ተዘጋጅቷል',
      summary: 'All category items and pricing are active on waiter and cashier stations.',
      summaryAmharic: 'ሁሉም የምግብ አይነቶች እና ዋጋዎች በአስተናጋጅ እና ገንዘብ ተቀባይ ስክሪን ላይ ይገኛሉ።',
      impact: 'INFO',
      actionableStep: 'Ensure kitchen display screens are online for prompt order routing.'
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
 * Intelligent Restaurant Assistant Query Handler (Supports Amharic and English)
 */
export async function processAiQuery(
  userQuery: string, 
  branchId?: string,
  preferredLanguage?: 'en' | 'am' | string
): Promise<{
  reply: string;
  metrics: BusinessMetrics;
  suggestedPrompts: string[];
}> {
  const metrics = gatherBusinessMetrics(branchId);
  
  const rawQuery = userQuery || '';
  // Strip emojis and normalize query string for reliable intent classification
  const cleanQ = rawQuery
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .toLowerCase()
    .trim();

  // Detect Amharic intent or Ge'ez script
  const hasGeezScript = /[\u1200-\u137F]/.test(rawQuery);
  const requestsAmharic = 
    cleanQ.includes('amharic') || 
    cleanQ.includes('አማርኛ') || 
    cleanQ.includes('በአማርኛ') ||
    cleanQ.includes('habesha');
  const requestsEnglish = cleanQ.includes('english') || cleanQ.includes('እንግሊዝኛ');

  let isAmharic = preferredLanguage === 'am' || hasGeezScript || requestsAmharic;
  if (requestsEnglish) {
    isAmharic = false;
  }

  let reply = '';

  // Direct language switch request handler
  if (
    cleanQ.includes('reply in amharic') ||
    cleanQ.includes('speak amharic') ||
    cleanQ.includes('make the ai reply in amharic') ||
    cleanQ.includes('switch to amharic') ||
    cleanQ.includes('talk in amharic') ||
    cleanQ.includes('translate to amharic') ||
    cleanQ.includes('በአማርኛ አድርገው') ||
    cleanQ.includes('በአማርኛ መልስ') ||
    (requestsAmharic && cleanQ.length < 40 && !cleanQ.includes('revenue') && !cleanQ.includes('sales') && !cleanQ.includes('stock') && !cleanQ.includes('dish') && !cleanQ.includes('ገቢ') && !cleanQ.includes('ሽያጭ'))
  ) {
    reply = `### 🇪🇹 በአማርኛ ለመመለስ ዝግጁ ነኝ! (Switched to Amharic)\n\n` +
      `በደስታ! ከአሁን ጀምሮ ሁሉንም የንግድ ትንተናዎች፣ የሽያጭ መረጃዎች፣ የጥሬ ዕቃ ክምችት እና የአስተናጋጆች የስራ ክንውን በአማርኛ ቋንቋ አቀርብልዎታለሁ።\n\n` +
      `**የሚከተሉትን ጥያቄዎች ጠይቀው መሞከር ይችላሉ፡**\n` +
      `- *"የዛሬው ጠቅላላ ገቢ ስንት ነው?"*\n` +
      `- *"የሚያልቁ ጥሬ ዕቃዎች የትኞቹ ናቸው?"*\n` +
      `- *"ከፍተኛ ሽያጭ ያላቸው ምግቦች የትኞቹ ናቸው?"*\n` +
      `- *"የዳቦ እና ኬክ ካውንተር ሁኔታ ምን ይመስላል?"*\n` +
      `- *"የአስተናጋጆች ስራ ክንውን እንዴት ነው?"*`;

    return {
      reply,
      metrics,
      suggestedPrompts: [
        '📊 የዛሬው ጠቅላላ ገቢ ስንት ነው?',
        '⚠️ የሚያልቁ ጥሬ ዕቃዎች የትኞቹ ናቸው?',
        '🍔 ከፍተኛ ሽያጭ ያስመዘገቡ ምግቦች የትኞቹ ናቸው?',
        '🎂 የዳቦ እና ኬክ ካውንተር ሁኔታ ምን ይመስላል?',
        '👥 ዛሬ ከፍተኛ ሽያጭ ያስመዘገበው አስተናጋጅ ማን ነው?'
      ]
    };
  }

  // Smart Intent Detection & Contextual Synthesizer (Specific domain intents checked first)
  if (
    cleanQ.includes('waiter') || 
    cleanQ.includes('staff') || 
    cleanQ.includes('አስተናጋጅ') || 
    cleanQ.includes('ሰራተኛ') || 
    cleanQ.includes('server') ||
    cleanQ.includes('speed')
  ) {
    if (isAmharic) {
      const waiterList = metrics.waiterPerformance.length > 0
        ? metrics.waiterPerformance.map((w, idx) => `${idx + 1}. **${w.name}** — ${w.ordersCount} ትዕዛዞች (**${Number(w.totalSales).toLocaleString()} ብር**)`).join('\n')
        : 'ዛሬ እስካሁን የተመዘገበ የአስተናጋጅ ሽያጭ የለም።';

      reply = `### 👥 የአስተናጋጆች እና ሰራተኞች የስራ ክንውን (Staff Performance)\n\n` +
        `**የዛሬው የአስተናጋጆች የስራ ውጤት፡**\n` +
        `${waiterList}\n\n` +
        `💡 **የ AI ስራ አመራር አስተያየት፡**\n` +
        `ከፍተኛ የትዕዛዝ ቁጥር ያስመዘገቡትን እና ፈጣን የእንግዳ አቀባበል ያሳዩትን አስተናጋጆች በማበረታታት የአገልግሎት ጥራቱንና የሽያጭ መጠኑን ማሳደግ ይመረጣል።`;
    } else {
      const waiterList = metrics.waiterPerformance.length > 0
        ? metrics.waiterPerformance.map((w, idx) => `${idx + 1}. **${w.name}** — ${w.ordersCount} orders taken (**${Number(w.totalSales).toLocaleString()} ETB**)`).join('\n')
        : 'No waiter sales recorded yet today.';

      reply = `### 👥 Staff & Waiter Operational Performance (የሰራተኞች የስራ ክንውን)\n\n` +
        `**Today's Active Waiter Output:**\n` +
        `${waiterList}\n\n` +
        `💡 **AI Observation:**\n` +
        `Reward top-performing floor staff who achieve high order counts and prompt order delivery turnaround times.`;
    }
  } else if (
    cleanQ.includes('bakery') || 
    cleanQ.includes('cake') || 
    cleanQ.includes('ኬክ') || 
    cleanQ.includes('ዳቦ') || 
    cleanQ.includes('pastry') || 
    cleanQ.includes('bake')
  ) {
    if (isAmharic) {
      reply = `### 🎂 የዳቦ ቤት እና የካውንተር ኬክ ሁኔታ (Bakery Intelligence)\n\n` +
        `- **በማሳያ ካውንተር ላይ የቀረ ኬክ፡** **${metrics.bakeryStats.counterCakesAvailable}** ኬኮች (ለፈጣን ሽያጭ ዝግጁ)\n` +
        `- **በምድጃ ውስጥ በመጋገር ላይ ያለ፡** **${metrics.bakeryStats.batchesBaking}** ምድጃዎች (${metrics.bakeryStats.cakesBakingCount} ጠቅላላ ኬኮች)\n\n` +
        `💡 **የስራ መመሪያ እና ምክር፡**\n` +
        (metrics.bakeryStats.counterCakesAvailable < 5 
          ? `⚠️ በማሳያ ካውንተር ላይ የቀረው የኬክ ክምችት ዝቅተኛ ነው። የእንግዶች ፍላጎት እንዳይስተጓጎል የዳቦ ቤቱ ክፍል አዳዲስ ኬኮችን በፍጥነት ወደ ምድጃ እንዲያስገባ ያድርጉ!`
          : `✅ የማሳያ ካውንተር ክምችት ለእንግዶች አገልግሎት በተሟላ ሁኔታ ዝግጁ ነው።`);
    } else {
      reply = `### 🎂 Bakery & Counter Cake Intelligence (የዳቦ ቤት እና ኬክ ሁኔታ)\n\n` +
        `- **Display Counter Stock:** **${metrics.bakeryStats.counterCakesAvailable}** cakes ready for immediate waiter pickup\n` +
        `- **Oven Batches in Production:** **${metrics.bakeryStats.batchesBaking}** active batches (${metrics.bakeryStats.cakesBakingCount} total cakes)\n\n` +
        `💡 **Operational Guidance:**\n` +
        (metrics.bakeryStats.counterCakesAvailable < 5 
          ? `⚠️ Counter display stock is low. Request the bakery kitchen to prioritize rapid baking batches!`
          : `✅ Counter displays are adequately stocked for peak customer flow.`);
    }
  } else if (
    cleanQ.includes('stock') || 
    cleanQ.includes('inventory') || 
    cleanQ.includes('ጥሬ') || 
    cleanQ.includes('ዕቃ') || 
    cleanQ.includes('shortage') || 
    cleanQ.includes('reorder') || 
    cleanQ.includes('ingredient')
  ) {
    if (isAmharic) {
      if (metrics.lowStockIngredients.length === 0) {
        reply = `### 📦 የጥሬ ዕቃዎች ክምችት ሁኔታ (Inventory Status)\n\n` +
          `✅ **ሁሉም የጥሬ ዕቃዎች ክምችት በጥሩ ደረጃ ላይ ይገኛል!** በኩሽና እና በዳቦ ቤት ውስጥ ያሉ ሁሉም ግብአቶች ከአነስተኛ የደህንነት ገደብ በላይ በበቂ ሁኔታ አሉ።\n\n` +
          `💡 **የ AI ምክር፡** መደበኛውን የሳምንት መጨረሻ የጥሬ ዕቃ ቆጠራ እና ኦዲት ከመጋዘን ኃላፊው ጋር ያረጋግጡ።`;
      } else {
        const itemsList = metrics.lowStockIngredients
          .map(i => `- **${i.name}**፡ የቀረው ክምችት፡ \`${i.current_stock} ${i.unit}\` (አነስተኛ ገደብ፡ \`${i.min_stock_threshold} ${i.unit}\`)`)
          .join('\n');

        reply = `### ⚠️ የአስቸኳይ ጥሬ ዕቃዎች ማሳሰቢያ (Low Stock Alert)\n\n` +
          `የሚከተሉት **${metrics.lowStockIngredients.length} ጥሬ ዕቃዎች** ከአነስተኛ የደህንነት ገደብ በታች ወርደዋል ወይም እያለቁ ነው፡\n\n` +
          `${itemsList}\n\n` +
          `🚨 **አስቸኳይ መወሰድ ያለበት እርምጃ፡**\n` +
          `1. የመጋዘን ኃላፊው አፋጣኝ የግዥ ትዕዛዝ ለአቅራቢዎች እንዲያስተላልፍ ያድርጉ።\n` +
          `2. ቁልፍ ጥሬ ዕቃዎች ከምሽቱ የምግብ ሰዓት በፊት መድረስ የማይችሉ ከሆነ ከፍተኛ ፍጆታ ያላቸውን ምግቦች አስቀድመው ያስተካክሉ።`;
      }
    } else {
      if (metrics.lowStockIngredients.length === 0) {
        reply = `### 📦 Inventory Health Status (የክምችት ሁኔታ)\n\n` +
          `✅ **All stock levels are currently healthy!** None of your monitored cooking ingredients or bakery supplies have breached minimum safety thresholds.\n\n` +
          `💡 **AI Recommendation:** Regular inventory audits and storekeeper stock counts should be verified at every weekend shift change.`;
      } else {
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
  } else if (
    cleanQ.includes('top') || 
    cleanQ.includes('best') || 
    cleanQ.includes('ተወዳጅ') || 
    cleanQ.includes('ምርጥ') ||
    cleanQ.includes('dish') || 
    cleanQ.includes('menu') || 
    cleanQ.includes('selling') || 
    cleanQ.includes('popular') || 
    cleanQ.includes('food') ||
    cleanQ.includes('ምግብ') ||
    cleanQ.includes('ምግቦች')
  ) {
    if (isAmharic) {
      const topList = metrics.topSellingItems.length > 0
        ? metrics.topSellingItems
            .map((item, idx) => `${idx + 1}. **${item.name}** — ${item.quantity} ተሽጧል (**${Number(item.revenue).toLocaleString()} ብር**)`)
            .join('\n')
        : 'ዛሬ እስካሁን የተሸጠ ምግብ አልተመዘገበም።';

      const lowList = metrics.lowSellingItems.length > 0
        ? metrics.lowSellingItems
            .slice(0, 3)
            .map(item => `- *${item.name}* (${item.quantity} ትዕዛዞች)`)
            .join('\n')
        : 'ሁሉም የምግብ ዝርዝሮች ንቁ ናቸው።';

      reply = `### 🍔 የምርጥ ምግቦች ሽያጭ እና ትንተና (Top Selling Menu)\n\n` +
        `**በጣም ተወዳጅ እና ከፍተኛ ሽያጭ ያስመዘገቡ ምግቦች፡**\n` +
        `${topList}\n\n` +
        `**አነስተኛ ሽያጭ ያላቸው ምግቦች (ግምገማ ወይም ማስተዋወቅ የሚያስፈልጋቸው)፡**\n` +
        `${lowList}\n\n` +
        `💡 **የ AI ስልታዊ የንግድ ምክር፡**\n` +
        `አነስተኛ ሽያጭ ያላቸውን ተጨማሪ ምግቦች ከተወዳጅ ዋና ምግቦች ጋር በኮምቦ (Combo Special) አጣምረው በማቅረብ የትርፍ ህዳግዎን ያሳድጉ እንዲሁም የጥሬ ዕቃ ብክነትን ይቀንሱ።`;
    } else {
      const topList = metrics.topSellingItems.length > 0
        ? metrics.topSellingItems
            .map((item, idx) => `${idx + 1}. **${item.name}** — ${item.quantity} sold (**${Number(item.revenue).toLocaleString()} ETB**)`)
            .join('\n')
        : 'No dishes sold yet today.';

      const lowList = metrics.lowSellingItems.length > 0
        ? metrics.lowSellingItems
            .slice(0, 3)
            .map(item => `- *${item.name}* (${item.quantity} orders)`)
            .join('\n')
        : 'Catalog items are ready.';

      reply = `### 🍔 Top Selling Menu Engineering (የምግብ ሽያጭ ትንተና)\n\n` +
        `**Top Dishes (Customer Demand):**\n` +
        `${topList}\n\n` +
        `**Low Velocity Items (Review or Promote):**\n` +
        `${lowList}\n\n` +
        `💡 **AI Strategic Recommendation:**\n` +
        `Bundle low-velocity sides or items with your top seller as a combo special to improve margin retention and avoid ingredient expiry.`;
    }
  } else if (
    cleanQ.includes('revenue') || 
    cleanQ.includes('sales') || 
    cleanQ.includes('ገቢ') || 
    cleanQ.includes('ሽያጭ') || 
    cleanQ.includes('today') || 
    cleanQ.includes('ዛሬ') ||
    cleanQ.includes('profit') ||
    cleanQ.includes('earn') ||
    cleanQ.includes('money')
  ) {
    if (isAmharic) {
      const advice = metrics.todayRevenue > 0
        ? `የዕለቱን ጠቅላላ ገቢ በ15-20% ለማሳደግ፣ አስተናጋጆች ለእያንዳንዱ ጠረጴዛ ሂሳብ ከመዘጋቱ በፊት ተጨማሪ ኬክ ወይም ልዩ ትኩስ ቡናዎችን እንዲጋብዙ ያበረታቱ።`
        : `ዛሬ እስካሁን የተጠናቀቀ የሽያጭ ትዕዛዝ አልተመዘገበም። የካሽየር እና የአስተናጋጅ ሲስተም አዳዲስ ትዕዛዞችን ለመቀበል ዝግጁ ነው።`;

      reply = `### 📊 የዕለቱ የሽያጭ እና ገቢ ማጠቃለያ (Daily Financial Summary)\n\n` +
        `- **የዛሬው ጠቅላላ ገቢ (Gross Sales):** **${metrics.todayRevenue.toLocaleString()} ብር (ETB)**\n` +
        `- **የተጠናቀቁ ትዕዛዞች (Completed):** **${metrics.completedOrdersToday}** ትዕዛዞች\n` +
        `- **በኩሽና ዝግጅት ላይ ያሉ (Active Tickets):** **${metrics.pendingOrdersToday}** ትዕዛዞች\n` +
        `- **አማካይ የአንድ ትዕዛዝ መጠን (AOV):** **${metrics.avgOrderValue} ብር (ETB)**\n\n` +
        `💡 **የ AI ስራ አስኪያጅ ምክር፡**\n` +
        `${advice}`;
    } else {
      const advice = metrics.todayRevenue > 0
        ? `To increase total daily turnover by 15-20%, instruct your waiters to suggest dessert (cake slice) or specialty coffee drinks on every dine-in table ticket before checkout.`
        : `No sales tickets have completed yet today. The POS system and waiter stations are open and ready to log guest orders.`;

      reply = `### 📊 Financial & Revenue Summary (የሽያጭ ማጠቃለያ)\n\n` +
        `- **Today's Gross Sales:** **${metrics.todayRevenue.toLocaleString()} ETB**\n` +
        `- **Completed Orders:** **${metrics.completedOrdersToday}** orders\n` +
        `- **Active/Pending in Kitchen:** **${metrics.pendingOrdersToday}** tickets\n` +
        `- **Average Ticket Size (AOV):** **${metrics.avgOrderValue} ETB**\n\n` +
        `💡 **AI Executive Advice:**\n` +
        `${advice}`;
    }
  } else {
    // Comprehensive Executive Overview
    if (isAmharic) {
      reply = `### ✨ አጠቃላይ የሬስቶራንቱ የስራ እንቅስቃሴ ቁጥጥር (Executive Copilot Overview)\n\n` +
        `የሬስቶራንትዎ የቀጥታ የቀን መረጃ ይህንን ይመስላል፡\n\n` +
        `1. **የፋይናንስ ሁኔታ፡** ዛሬ **${metrics.todayRevenue.toLocaleString()} ብር** በ**${metrics.completedOrdersToday}** ትዕዛዞች ተገኝቷል።\n` +
        `2. **የኩሽና የስራ ጫና፡** **${metrics.pendingOrdersToday}** ትዕዛዞች በዝግጅት ሂደት ላይ ናቸው።\n` +
        `3. **የጥሬ ዕቃ ክምችት፡** **${metrics.lowStockIngredients.length}** እቃዎች ከአነስተኛ ገደብ በታች ደርሰዋል።\n` +
        `4. **የዳቦ እና ኬክ ክፍል፡** **${metrics.bakeryStats.counterCakesAvailable}** ማሳያ ኬኮች ለሽያጭ ዝግጁ ናቸው።\n\n` +
        `**የሚፈልጉትን ማንኛውንም ጥያቄ ይጠይቁኝ፡**\n` +
        `- *"የዛሬው ገቢ ስንት ነው?"*\n` +
        `- *"የሚያልቁ ጥሬ ዕቃዎች የትኞቹ ናቸው?"*\n` +
        `- *"ከፍተኛ ገቢ ያስገኘው ምግብ የትኛው ነው?"*\n` +
        `- *"የአስተናጋጆች የዛሬ ሽያጭ ምን ይመስላል?"*\n` +
        `- *"የዕለቱን ገቢ እንዴት ማሳደግ እንችላለን?"*`;
    } else {
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
  }

  const suggestedPrompts = isAmharic
    ? [
        '📊 የዛሬው ጠቅላላ ገቢ ስንት ነው?',
        '⚠️ የሚያልቁ ጥሬ ዕቃዎች የትኞቹ ናቸው?',
        '🍔 ከፍተኛ ሽያጭ ያስመዘገቡ ምግቦች የትኞቹ ናቸው?',
        '🎂 የዳቦ እና ኬክ ካውንተር ሁኔታ ምን ይመስላል?',
        '👥 ዛሬ ከፍተኛ ሽያጭ ያስመዘገበው አስተናጋጅ ማን ነው?'
      ]
    : [
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
