import { db, initDatabase } from './schema.js';
import crypto from 'crypto';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function seedDatabase() {
  initDatabase();

  // Check if already seeded
  const branchCount = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
  if (branchCount.count > 0) {
    return;
  }

  const tx = db.transaction(() => {
    // 1. Settings
    db.prepare(`
      INSERT INTO restaurant_settings (id, restaurant_name, slogan, primary_color, secondary_color, vat_enabled, vat_percentage, tax_number, receipt_footer, receipt_footer_amharic, default_currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'settings_1',
      'Habesha Gourmet & Lounge',
      'Authentic Flavors, Elevated Hospitality',
      '#f97316',
      '#0f172a',
      1,
      15.0,
      'TIN-102948190',
      'Thank you for your visit! / በጉብኝትዎ እናመሰግናለን!',
      'በጉብኝትዎ ከልብ እናመሰግናለን! እንደገና ይምጡ።',
      'ETB'
    );

    // 2. Branches
    const branches = [
      { id: 'branch_addis', name: 'Addis Ababa Bole Branch', city: 'Addis Ababa', address: 'Bole Medhanealem Road, Tower 2', phone: '+251911223344' },
      { id: 'branch_adama', name: 'Adama Express Branch', city: 'Adama', address: 'Expressway Ave, Plaza Mall', phone: '+251922334455' },
      { id: 'branch_diredawa', name: 'Dire Dawa Lounge Branch', city: 'Dire Dawa', address: 'Kebele 02, Central Square', phone: '+251933445566' }
    ];

    const insertBranch = db.prepare(`
      INSERT INTO branches (id, name, city, address, phone, vat_rate, is_active)
      VALUES (?, ?, ?, ?, ?, 0.15, 1)
    `);
    for (const b of branches) {
      insertBranch.run(b.id, b.name, b.city, b.address, b.phone);
    }

    // 3. Tables for Addis Ababa Branch
    const tables = [
      { id: 'tbl_01', branch_id: 'branch_addis', table_number: 'T-01', name: 'Table 1', section: 'Main Hall', capacity: 4 },
      { id: 'tbl_02', branch_id: 'branch_addis', table_number: 'T-02', name: 'Table 2', section: 'Main Hall', capacity: 4 },
      { id: 'tbl_03', branch_id: 'branch_addis', table_number: 'T-03', name: 'Table 3', section: 'Window View', capacity: 2 },
      { id: 'tbl_04', branch_id: 'branch_addis', table_number: 'T-04', name: 'Table 4', section: 'Balcony', capacity: 6 },
      { id: 'tbl_vip1', branch_id: 'branch_addis', table_number: 'VIP-1', name: 'VIP Suite 1', section: 'VIP Lounge', capacity: 8 },
      { id: 'tbl_bar1', branch_id: 'branch_addis', table_number: 'BAR-1', name: 'Bar Counter 1', section: 'Cocktail & Coffee Bar', capacity: 2 },
      // Adama tables
      { id: 'tbl_adm1', branch_id: 'branch_adama', table_number: 'A-01', name: 'Adama Table 1', section: 'Terrace', capacity: 4 },
      { id: 'tbl_adm2', branch_id: 'branch_adama', table_number: 'A-02', name: 'Adama Table 2', section: 'Main Hall', capacity: 4 }
    ];
    const insertTable = db.prepare(`
      INSERT INTO restaurant_tables (id, branch_id, table_number, name, section, capacity, status)
      VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE')
    `);
    for (const t of tables) {
      insertTable.run(t.id, t.branch_id, t.table_number, t.name, t.section, t.capacity);
    }

    // 4. Default Seed Users (1 for each role + owner + admin)
    const defaultPasswordHash = hashPassword('password123');
    const defaultPinHash = hashPassword('1234');

    const users = [
      { id: 'usr_owner', name: 'Abebe Bikila (Owner)', username: 'owner', role: 'owner', branch_id: 'branch_addis' },
      { id: 'usr_admin', name: 'Sara Tesfaye (Admin)', username: 'admin', role: 'admin', branch_id: 'branch_addis' },
      { id: 'usr_cashier', name: 'Yohannes Getachew (Cashier)', username: 'cashier', role: 'cashier', branch_id: 'branch_addis' },
      { id: 'usr_chef', name: 'David Bekele (Head Chef)', username: 'chef', role: 'chef', branch_id: 'branch_addis' },
      { id: 'usr_barista', name: 'Almaz Alemu (Barista)', username: 'barista', role: 'barista', branch_id: 'branch_addis' },
      { id: 'usr_waiter', name: 'Dawit Haile (Waiter)', username: 'waiter', role: 'waiter', branch_id: 'branch_addis' },
      { id: 'usr_storekeeper', name: 'Mulugeta Tadesse (Storekeeper)', username: 'storekeeper', role: 'storekeeper', branch_id: 'branch_addis' }
    ];

    const insertUser = db.prepare(`
      INSERT INTO users (id, full_name, username, password_hash, pin_hash, phone, role, branch_id, status)
      VALUES (?, ?, ?, ?, ?, '+251911000000', ?, ?, 'ACTIVE')
    `);
    for (const u of users) {
      insertUser.run(u.id, u.name, u.username, defaultPasswordHash, defaultPinHash, u.role, u.branch_id);
    }

    // 5. Menu Categories
    const categories = [
      { id: 'cat_burgers', name: 'Gourmet Burgers', name_amharic: 'በርገሮች', icon: 'Beef', sort_order: 1 },
      { id: 'cat_pizza', name: 'Wood-Fired Pizza', name_amharic: 'ፒዛ', icon: 'Pizza', sort_order: 2 },
      { id: 'cat_pasta', name: 'Pastas & Mains', name_amharic: 'ፓስታና ዋና ምግቦች', icon: 'Utensils', sort_order: 3 },
      { id: 'cat_coffee', name: 'Artisan Coffee', name_amharic: 'ቡና እና ትኩስ መጠጦች', icon: 'Coffee', sort_order: 4 },
      { id: 'cat_cold_drinks', name: 'Fresh Juices & Drinks', name_amharic: 'ጭማቂዎችና መጠጦች', icon: 'CupSoda', sort_order: 5 }
    ];
    const insertCat = db.prepare(`
      INSERT INTO menu_categories (id, name, name_amharic, icon, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const c of categories) {
      insertCat.run(c.id, c.name, c.name_amharic, c.icon, c.sort_order);
    }

    // 6. Ingredients
    const ingredients = [
      { id: 'ing_beef', name: 'Minced Beef (Prime)', name_amharic: 'የተፈጨ የበሬ ሥጋ', category: 'Meat', unit: 'g', unit_cost: 0.85, min: 1000, shelf: 'Refrigerator K1', exp: '2026-10-15' },
      { id: 'ing_bun', name: 'Brioche Burger Buns', name_amharic: 'የበርገር ዳቦ', category: 'Dry Goods', unit: 'piece', unit_cost: 25.0, min: 20, shelf: 'Shelf A2', exp: '2026-09-25' },
      { id: 'ing_cheese', name: 'Cheddar Cheese Slices', name_amharic: 'ቺዝ (አይብ)', category: 'Dairy', unit: 'g', unit_cost: 1.20, min: 300, shelf: 'Refrigerator K1', exp: '2026-11-01' },
      { id: 'ing_sauce', name: 'Signature Burger Sauce', name_amharic: 'የበርገር ሶስ', category: 'Dry Goods', unit: 'ml', unit_cost: 0.40, min: 500, shelf: 'Refrigerator K1', exp: '2026-12-01' },
      { id: 'ing_onion', name: 'Fresh Onions', name_amharic: 'ቀይ ሽንኩርት', category: 'Vegetables', unit: 'g', unit_cost: 0.15, min: 1000, shelf: 'Shelf K1', exp: '2026-10-01' },
      { id: 'ing_tomato', name: 'Fresh Tomatoes', name_amharic: 'ቲማቲም', category: 'Vegetables', unit: 'g', unit_cost: 0.20, min: 1000, shelf: 'Shelf K1', exp: '2026-09-30' },
      { id: 'ing_flour', name: 'Pizza Dough Flour', name_amharic: 'የፒዛ ዱቄት', category: 'Dry Goods', unit: 'g', unit_cost: 0.10, min: 2000, shelf: 'Main Store / Shelf B1', exp: '2027-01-01' },
      { id: 'ing_mozzarella', name: 'Mozzarella Cheese', name_amharic: 'ሞዛሬላ አይብ', category: 'Dairy', unit: 'g', unit_cost: 1.40, min: 500, shelf: 'Refrigerator K1', exp: '2026-10-20' },
      { id: 'ing_coffee_beans', name: 'Yirgacheffe Coffee Beans', name_amharic: 'የይርጋጨፌ የቡና ፍሬ', category: 'Beverages', unit: 'g', unit_cost: 1.10, min: 500, shelf: 'Bar / Shelf B1', exp: '2027-03-01' },
      { id: 'ing_milk', name: 'Fresh Whole Milk', name_amharic: 'ንፁህ ወተት', category: 'Dairy', unit: 'ml', unit_cost: 0.12, min: 2000, shelf: 'Refrigerator B1', exp: '2026-09-22' },
      { id: 'ing_mango', name: 'Fresh Mango Pulp', name_amharic: 'የማንጎ ጭማቂ', category: 'Beverages', unit: 'ml', unit_cost: 0.35, min: 1000, shelf: 'Refrigerator B1', exp: '2026-09-25' },
      { id: 'ing_avocado', name: 'Hass Avocados', name_amharic: 'አቮካዶ', category: 'Vegetables', unit: 'piece', unit_cost: 35.0, min: 15, shelf: 'Bar Basket', exp: '2026-09-24' }
    ];

    const insertIng = db.prepare(`
      INSERT INTO ingredients (id, name, name_amharic, category, unit, unit_cost, min_stock_level, shelf_location, expiration_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const ing of ingredients) {
      insertIng.run(ing.id, ing.name, ing.name_amharic, ing.category, ing.unit, ing.unit_cost, ing.min, ing.shelf, ing.exp);
    }

    // 7. Seed Initial Branch Inventory (Addis Ababa branch stock)
    const stockEntries = [
      { id: 'ing_beef', qty: 15000 }, // 15 kg
      { id: 'ing_bun', qty: 120 },    // 120 buns
      { id: 'ing_cheese', qty: 4000 }, // 4 kg
      { id: 'ing_sauce', qty: 5000 },  // 5 liters
      { id: 'ing_onion', qty: 10000 }, // 10 kg
      { id: 'ing_tomato', qty: 8000 }, // 8 kg
      { id: 'ing_flour', qty: 25000 }, // 25 kg
      { id: 'ing_mozzarella', qty: 6000 }, // 6 kg
      { id: 'ing_coffee_beans', qty: 8000 }, // 8 kg
      { id: 'ing_milk', qty: 15000 }, // 15 liters
      { id: 'ing_mango', qty: 6000 }, // 6 liters
      { id: 'ing_avocado', qty: 40 }   // 40 avocados
    ];

    const insertStock = db.prepare(`
      INSERT INTO inventory_stock (id, branch_id, ingredient_id, current_quantity)
      VALUES (?, 'branch_addis', ?, ?)
    `);
    for (const s of stockEntries) {
      insertStock.run(`stock_addis_${s.id}`, s.id, s.qty);
      // Also add initial movement log
      db.prepare(`
        INSERT INTO inventory_movements (id, branch_id, ingredient_id, user_id, movement_type, quantity_change, resulting_quantity, notes)
        VALUES (?, 'branch_addis', ?, 'usr_storekeeper', 'PURCHASE_RECEIVE', ?, ?, 'Initial MVR stock take')
      `).run(`mov_init_${s.id}`, s.id, s.qty, s.qty);
    }

    // 8. Menu Items
    const menuItems = [
      {
        id: 'menu_burger',
        category_id: 'cat_burgers',
        name: 'Gourmet Double Beef Burger',
        name_amharic: 'ዳብል የበሬ በርገር',
        description: 'Juicy prime beef patty, melted cheddar, caramelized onions, house special sauce on a brioche bun',
        price: 450.0,
        prep_time_minutes: 15,
        routing_destination: 'KITCHEN'
      },
      {
        id: 'menu_pizza',
        category_id: 'cat_pizza',
        name: 'Margherita Artisanal Pizza',
        name_amharic: 'ማርገሪታ ፒዛ',
        description: 'San Marzano style tomato base, fresh mozzarella, aromatic basil on slow-fermented crust',
        price: 600.0,
        prep_time_minutes: 20,
        routing_destination: 'KITCHEN'
      },
      {
        id: 'menu_macchiato',
        category_id: 'cat_coffee',
        name: 'Traditional Ethiopian Macchiato',
        name_amharic: 'የኢትዮጵያ ባህላዊ ማኪያቶ',
        description: 'Rich dark espresso topped with velvety steamed milk foam',
        price: 90.0,
        prep_time_minutes: 5,
        routing_destination: 'BAR'
      },
      {
        id: 'menu_mango_juice',
        category_id: 'cat_cold_drinks',
        name: 'Fresh Mango & Avocado Special Juice',
        name_amharic: 'ልዩ የማንጎ እና አቮካዶ ስፕሪስ',
        description: 'Layered fresh organic mango and creamy avocado smoothie with lime hint',
        price: 180.0,
        prep_time_minutes: 7,
        routing_destination: 'BAR'
      }
    ];

    const insertMenuItem = db.prepare(`
      INSERT INTO menu_items (id, category_id, name, name_amharic, description, price, prep_time_minutes, routing_destination)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const m of menuItems) {
      insertMenuItem.run(m.id, m.category_id, m.name, m.name_amharic, m.description, m.price, m.prep_time_minutes, m.routing_destination);
    }

    // 9. Recipes / Bill of Materials (BOM)
    // Burger recipe: 1 bun, 150g beef, 20g cheese, 25ml sauce, 15g onions, 20g tomato
    db.prepare(`INSERT INTO recipes (id, menu_item_id, instructions) VALUES ('rcp_burger', 'menu_burger', 'Grill patty to medium well, toast brioche bun, melt cheese.')`).run();
    const burgerIngredients = [
      { ing: 'ing_bun', qty: 1 },
      { ing: 'ing_beef', qty: 150 },
      { ing: 'ing_cheese', qty: 20 },
      { ing: 'ing_sauce', qty: 25 },
      { ing: 'ing_onion', qty: 15 },
      { ing: 'ing_tomato', qty: 20 }
    ];
    for (const bi of burgerIngredients) {
      db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES (?, 'rcp_burger', ?, ?)`).run(
        `bi_${bi.ing}`, bi.ing, bi.qty
      );
    }

    // Pizza recipe: 250g flour, 120g mozzarella, 80g tomato
    db.prepare(`INSERT INTO recipes (id, menu_item_id, instructions) VALUES ('rcp_pizza', 'menu_pizza', 'Hand stretch dough, ladle tomato, scatter mozzarella, bake at 400C.')`).run();
    db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES ('pi_flour', 'rcp_pizza', 'ing_flour', 250)`).run();
    db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES ('pi_mozzarella', 'rcp_pizza', 'ing_mozzarella', 120)`).run();
    db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES ('pi_tomato', 'rcp_pizza', 'ing_tomato', 80)`).run();

    // Macchiato recipe: 18g coffee beans, 100ml milk
    db.prepare(`INSERT INTO recipes (id, menu_item_id, instructions) VALUES ('rcp_macchiato', 'menu_macchiato', 'Extract double shot espresso, steam micro-foam milk.')`).run();
    db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES ('mi_coffee', 'rcp_macchiato', 'ing_coffee_beans', 18)`).run();
    db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES ('mi_milk', 'rcp_macchiato', 'ing_milk', 100)`).run();

    // Juice recipe: 1 avocado piece, 200ml mango
    db.prepare(`INSERT INTO recipes (id, menu_item_id, instructions) VALUES ('rcp_juice', 'menu_mango_juice', 'Blend cold mango puree, layer with ripe blended avocado.')`).run();
    db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES ('ji_avocado', 'rcp_juice', 'ing_avocado', 1)`).run();
    db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES ('ji_mango', 'rcp_juice', 'ing_mango', 200)`).run();

    // 10. Sample Supplier & Expense Categories
    db.prepare(`
      INSERT INTO suppliers (id, name, contact_person, phone, email, address)
      VALUES ('sup_01', 'Abyssinia Fresh Agro Farms', 'Kenenisa Bekele', '+251911887766', 'sales@abyssiniafresh.et', 'Debre Zeit Road')
    `).run();

    db.prepare(`
      INSERT INTO expenses (id, branch_id, user_id, category, amount, expense_date, description)
      VALUES 
        ('exp_01', 'branch_addis', 'usr_admin', 'Electricity', 3500.0, date('now', '-2 days'), 'Monthly commercial kitchen electric utility bill'),
        ('exp_02', 'branch_addis', 'usr_admin', 'Water', 1200.0, date('now', '-3 days'), 'Water utility replenishment'),
        ('exp_03', 'branch_addis', 'usr_admin', 'Cleaning', 850.0, date('now', '-1 day'), 'Commercial food-grade kitchen sanitizers')
    `).run();

    // 11. Initial Audit Log
    db.prepare(`
      INSERT INTO audit_logs (id, branch_id, user_id, action, entity_type, entity_id, details)
      VALUES ('aud_init', 'branch_addis', 'usr_admin', 'SYSTEM_INITIALIZED', 'SYSTEM', 'root', 'Initial MVR setup with multi-branch, menus, recipes, and test users completed.')
    `).run();
  });

  tx();
  console.log('Database initialized and successfully seeded with realistic Ethiopian restaurant data!');
}
