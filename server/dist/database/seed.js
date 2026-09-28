import { db, initDatabase } from './schema.js';
import { hashSecretSync } from '../utils/security.js';
export function seedDatabase() {
    initDatabase();
    // Auto-backfill photo_urls for existing menu items if missing or empty
    try {
        const updatePhoto = db.prepare(`UPDATE menu_items SET photo_url = ? WHERE id = ? AND (photo_url IS NULL OR photo_url = '')`);
        updatePhoto.run('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80', 'menu_burger');
        updatePhoto.run('https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80', 'menu_pizza');
        updatePhoto.run('https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&q=80', 'menu_macchiato');
        updatePhoto.run('https://images.unsplash.com/photo-1546173159-315724a31696?w=500&q=80', 'menu_mango_juice');
    }
    catch (e) {
        console.warn('Could not backfill photo_urls:', e);
    }
    // Check if already seeded
    const branchCount = db.prepare('SELECT COUNT(*) as count FROM branches').get();
    if (branchCount.count > 0) {
        seedBakeryData();
        return;
    }
    const tx = db.transaction(() => {
        // 1. Settings
        db.prepare(`
      INSERT INTO restaurant_settings (id, restaurant_name, slogan, logo_url, primary_color, secondary_color, vat_enabled, vat_percentage, tax_number, receipt_footer, receipt_footer_amharic, default_currency)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('settings_1', 'Yo Burger & Restaurant', 'Delicious Burgers & Seamless Hospitality', '/logo.png', '#ff9e01', '#940500', 1, 15.0, 'TIN-102948190', 'Thank you for your visit! / በጉብኝትዎ እናመሰግናለን!', 'በጉብኝትዎ ከልብ እናመሰግናለን! እንደገና ይምጡ።', 'ETB');
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
        const defaultPasswordHash = hashSecretSync('password123');
        const defaultPinHash = hashSecretSync('1234');
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
            { id: 'ing_bun', qty: 120 }, // 120 buns
            { id: 'ing_cheese', qty: 4000 }, // 4 kg
            { id: 'ing_sauce', qty: 5000 }, // 5 liters
            { id: 'ing_onion', qty: 10000 }, // 10 kg
            { id: 'ing_tomato', qty: 8000 }, // 8 kg
            { id: 'ing_flour', qty: 25000 }, // 25 kg
            { id: 'ing_mozzarella', qty: 6000 }, // 6 kg
            { id: 'ing_coffee_beans', qty: 8000 }, // 8 kg
            { id: 'ing_milk', qty: 15000 }, // 15 liters
            { id: 'ing_mango', qty: 6000 }, // 6 liters
            { id: 'ing_avocado', qty: 40 } // 40 avocados
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
                photo_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
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
                photo_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
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
                photo_url: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500&q=80',
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
                photo_url: 'https://images.unsplash.com/photo-1546173159-315724a31696?w=500&q=80',
                prep_time_minutes: 7,
                routing_destination: 'BAR'
            }
        ];
        const insertMenuItem = db.prepare(`
      INSERT INTO menu_items (id, category_id, name, name_amharic, description, price, photo_url, prep_time_minutes, routing_destination)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        for (const m of menuItems) {
            insertMenuItem.run(m.id, m.category_id, m.name, m.name_amharic, m.description, m.price, m.photo_url, m.prep_time_minutes, m.routing_destination);
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
            db.prepare(`INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required) VALUES (?, 'rcp_burger', ?, ?)`).run(`bi_${bi.ing}`, bi.ing, bi.qty);
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
    // Seed Bakery and Front Cake Counter workflow data
    seedBakeryData();
}
export function seedBakeryData() {
    const defaultPasswordHash = hashSecretSync('password123');
    const defaultPinHash = hashSecretSync('1234');
    // 1. Ensure Bakery and Front Cake Counter users exist
    const bakeryUsers = [
        { id: 'usr_bakery', name: 'Bethlehem Tadesse (Bakery)', username: 'bakery', role: 'bakery', branch_id: 'branch_addis' },
        { id: 'usr_front_counter', name: 'Hana Girma (Cake Counter)', username: 'front_counter', role: 'front_counter', branch_id: 'branch_addis' }
    ];
    const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, full_name, username, password_hash, pin_hash, phone, role, branch_id, status)
    VALUES (?, ?, ?, ?, ?, '+251911334455', ?, ?, 'ACTIVE')
  `);
    for (const u of bakeryUsers) {
        insertUser.run(u.id, u.name, u.username, defaultPasswordHash, defaultPinHash, u.role, u.branch_id);
        // Also update role if user already exists
        db.prepare("UPDATE users SET role = ?, status = 'ACTIVE' WHERE username = ?").run(u.role, u.username);
    }
    // 2. Ensure Bakery & Cakes menu category exists
    let cat = db.prepare("SELECT id FROM menu_categories WHERE name LIKE '%Bakery%' OR name LIKE '%Cake%' LIMIT 1").get();
    if (!cat) {
        db.prepare(`
      INSERT OR IGNORE INTO menu_categories (id, name, name_amharic, icon, sort_order, is_active)
      VALUES ('cat_bakery', 'Artisan Cakes & Bakery', 'ኬክና ዳቦ መጋገሪያ', 'Cake', 6, 1)
    `).run();
        cat = { id: 'cat_bakery' };
    }
    // 3. Check if bakery products already seeded
    const existingProducts = db.prepare('SELECT COUNT(*) as count FROM bakery_products').get();
    if (existingProducts.count > 0) {
        return;
    }
    const tx = db.transaction(() => {
        // 4. Products Master
        const products = [
            {
                id: 'bp_chocolate',
                name: 'Signature Chocolate Fudge Cake',
                name_amharic: 'ቸኮሌት ፈጅ ኬክ',
                description: 'Rich Belgian dark chocolate ganache, moist sponge layers, handcrafted chocolate curls',
                category: 'Cake',
                photo_url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80'
            },
            {
                id: 'bp_redvelvet',
                name: 'Velvet Red Velvet Celebration Cake',
                name_amharic: 'ሬድ ቬልቬት ኬክ',
                description: 'Crimson cocoa sponge with whipped Madagascar vanilla bean cream cheese frosting',
                category: 'Cake',
                photo_url: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?w=600&q=80'
            },
            {
                id: 'bp_cheesecake',
                name: 'Classic New York Strawberry Cheesecake',
                name_amharic: 'ስትሮውበሪ ቺዝ ኬክ',
                description: 'Slow-baked golden graham crust with silky cream cheese and fresh wild strawberry compote',
                category: 'Cake',
                photo_url: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=600&q=80'
            },
            {
                id: 'bp_croissant',
                name: 'Artisanal French Butter Croissant',
                name_amharic: 'የፈረንሳይ ቅቤ ክሩዋሳን',
                description: 'Flaky laminated golden layers baked with 82% pure churned butter',
                category: 'Pastry',
                photo_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600&q=80'
            }
        ];
        const insertProd = db.prepare(`
      INSERT INTO bakery_products (id, name, name_amharic, description, category, photo_url, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
        for (const p of products) {
            insertProd.run(p.id, p.name, p.name_amharic, p.description, p.category, p.photo_url);
        }
        // 5. Product Variations (Parent Product with Configurable Variations)
        const variations = [
            // Chocolate Cake variations
            { id: 'bpv_choc_small', product_id: 'bp_chocolate', name: 'Small — 0.5 kg', flavor: 'Chocolate Ganache', size: 'Small (0.5 kg)', weight: 0.5, price: 850.0, min_stock: 3, bakery_stock: 6, counter_stock: 4 },
            { id: 'bpv_choc_medium', product_id: 'bp_chocolate', name: 'Medium — 1 kg', flavor: 'Chocolate Ganache', size: 'Medium (1 kg)', weight: 1.0, price: 1450.0, min_stock: 5, bakery_stock: 8, counter_stock: 6 },
            { id: 'bpv_choc_large', product_id: 'bp_chocolate', name: 'Large — 2 kg', flavor: 'Chocolate Ganache', size: 'Large (2 kg)', weight: 2.0, price: 2600.0, min_stock: 2, bakery_stock: 4, counter_stock: 2 },
            { id: 'bpv_choc_slice', product_id: 'bp_chocolate', name: 'Single Slice — 150g', flavor: 'Chocolate Ganache', size: 'Slice (150g)', weight: 0.15, price: 180.0, min_stock: 10, bakery_stock: 15, counter_stock: 12 },
            // Red Velvet Cake variations
            { id: 'bpv_rv_medium', product_id: 'bp_redvelvet', name: 'Medium — 1 kg', flavor: 'Cream Cheese', size: 'Medium (1 kg)', weight: 1.0, price: 1550.0, min_stock: 4, bakery_stock: 6, counter_stock: 5 },
            { id: 'bpv_rv_large', product_id: 'bp_redvelvet', name: 'Large — 2 kg', flavor: 'Cream Cheese', size: 'Large (2 kg)', weight: 2.0, price: 2800.0, min_stock: 2, bakery_stock: 3, counter_stock: 2 },
            { id: 'bpv_rv_slice', product_id: 'bp_redvelvet', name: 'Single Slice — 150g', flavor: 'Cream Cheese', size: 'Slice (150g)', weight: 0.15, price: 195.0, min_stock: 8, bakery_stock: 12, counter_stock: 8 },
            // Cheesecake variations
            { id: 'bpv_cc_medium', product_id: 'bp_cheesecake', name: 'Medium — 1 kg', flavor: 'Wild Strawberry', size: 'Medium (1 kg)', weight: 1.0, price: 1600.0, min_stock: 3, bakery_stock: 5, counter_stock: 3 },
            { id: 'bpv_cc_slice', product_id: 'bp_cheesecake', name: 'Single Slice — 160g', flavor: 'Wild Strawberry', size: 'Slice (160g)', weight: 0.16, price: 210.0, min_stock: 8, bakery_stock: 10, counter_stock: 7 },
            // Croissant variations
            { id: 'bpv_cr_single', product_id: 'bp_croissant', name: 'Single Piece — 100g', flavor: 'French Butter', size: '100g Piece', weight: 0.1, price: 95.0, min_stock: 10, bakery_stock: 25, counter_stock: 18 },
            { id: 'bpv_cr_box4', product_id: 'bp_croissant', name: 'Pastry Box of 4', flavor: 'French Butter', size: 'Box of 4', weight: 0.4, price: 350.0, min_stock: 4, bakery_stock: 8, counter_stock: 5 }
        ];
        const insertVar = db.prepare(`
      INSERT INTO bakery_product_variations (
        id, product_id, variation_name, flavor_type, size, weight_kg, price,
        min_stock_level, bakery_stock, counter_stock, in_transit_stock, is_available
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
    `);
        const insertMenuItem = db.prepare(`
      INSERT OR REPLACE INTO menu_items (
        id, category_id, name, name_amharic, description, price, photo_url,
        prep_time_minutes, routing_destination, is_available, bakery_variation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 5, 'FRONT_COUNTER', 1, ?)
    `);
        for (const v of variations) {
            insertVar.run(v.id, v.product_id, v.name, v.flavor, v.size, v.weight, v.price, v.min_stock, v.bakery_stock, v.counter_stock);
            const parent = products.find(p => p.id === v.product_id);
            insertMenuItem.run(`menu_bakery_${v.id.substring(4)}`, cat.id, `${parent.name} (${v.name})`, parent.name_amharic ? `${parent.name_amharic} (${v.name})` : null, `${parent.description} — ${v.size}`, v.price, parent.photo_url, v.id);
            // Record initial inventory transaction for each department
            db.prepare(`
        INSERT INTO bakery_inventory_transactions (
          id, branch_id, product_id, variation_id, user_id, department,
          transaction_type, quantity_change, resulting_quantity, reason
        ) VALUES (?, 'branch_addis', ?, ?, 'usr_bakery', 'BAKERY', 'PRODUCTION_IN', ?, ?, 'Initial bakery production stock')
      `).run(`tx_init_bak_${v.id}`, v.product_id, v.id, v.bakery_stock, v.bakery_stock);
            db.prepare(`
        INSERT INTO bakery_inventory_transactions (
          id, branch_id, product_id, variation_id, user_id, department,
          transaction_type, quantity_change, resulting_quantity, reason
        ) VALUES (?, 'branch_addis', ?, ?, 'usr_front_counter', 'FRONT_COUNTER', 'TRANSFER_IN', ?, ?, 'Initial verified front counter stock')
      `).run(`tx_init_cnt_${v.id}`, v.product_id, v.id, v.counter_stock, v.counter_stock);
        }
        // 6. Sample Initial Batch
        db.prepare(`
      INSERT INTO bakery_batches (
        id, batch_number, product_id, variation_id, branch_id, produced_by_id,
        quantity_produced, quantity_transferred, quantity_sold, quantity_wasted,
        quantity_remaining, selling_price, photo_url, production_date, expiration_date, status, notes
      ) VALUES (
        'bb_sample_01', 'BATCH-20260928-101', 'bp_chocolate', 'bpv_choc_medium', 'branch_addis',
        'usr_bakery', 14, 6, 0, 0, 8, 1450.0,
        'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80',
        datetime('now', '-2 hours'), datetime('now', '+3 days'), 'READY', 'Fresh morning bake with Dutch cocoa'
      )
    `).run();
        // 7. Sample Completed Transfer & Sample Pending Transfer
        db.prepare(`
      INSERT INTO bakery_transfers (
        id, transfer_number, branch_id, product_id, variation_id, batch_id,
        quantity_sent, quantity_received, source_department, destination_department,
        created_by_id, sent_by_id, received_by_id, sent_at, received_at, status, notes
      ) VALUES (
        'trf_sample_01', 'TRF-20260928-001', 'branch_addis', 'bp_chocolate', 'bpv_choc_medium', 'bb_sample_01',
        6, 6, 'Bakery', 'Front Cake Counter', 'usr_bakery', 'usr_bakery', 'usr_front_counter',
        datetime('now', '-1 hour'), datetime('now', '-45 minutes'), 'RECEIVED', 'Morning display stock transfer'
      )
    `).run();
        // 8. Sample Bake Request from Front Counter
        db.prepare(`
      INSERT INTO bakery_requests (
        id, request_number, branch_id, product_id, variation_id, requested_by_id,
        current_counter_stock, min_stock_level, quantity_requested, quantity_fulfilled,
        urgency, status, notes
      ) VALUES (
        'req_sample_01', 'REQ-20260928-001', 'branch_addis', 'bp_redvelvet', 'bpv_rv_medium',
        'usr_front_counter', 3, 5, 8, 0, 'HIGH', 'IN_PRODUCTION', 'High weekend demand expected for Red Velvet'
      )
    `).run();
        // 9. Sample Price Suggestion from Bakery
        db.prepare(`
      INSERT INTO bakery_price_suggestions (
        id, branch_id, variation_id, suggested_by_id, current_price,
        suggested_price, reason, status
      ) VALUES (
        'ps_sample_01', 'branch_addis', 'bpv_rv_large', 'usr_bakery',
        2800.0, 2950.0, 'Imported cream cheese and dairy packaging material cost increased by 15%', 'PENDING'
      )
    `).run();
    });
    tx();
    console.log('✓ Bakery and Front Cake Sales Counter system initialized with master products and variations!');
}
