import { Router } from 'express';
import { db } from '../database/schema.js';
import { authenticate, authorizeRole, type AuthenticatedRequest } from '../middleware/auth.js';
import { logAudit } from '../services/auditService.js';
import { v4 as uuidv4 } from 'uuid';

export const menuRouter = Router();

// Get categories
menuRouter.get('/categories', authenticate, (_req, res) => {
  const categories = db.prepare('SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order ASC').all();
  res.json(categories);
});

// Get menu items with recipes
menuRouter.get('/items', authenticate, (req, res) => {
  const items = db.prepare(`
    SELECT m.*, c.name as category_name 
    FROM menu_items m
    JOIN menu_categories c ON m.category_id = c.id
    WHERE m.is_available = 1
    ORDER BY c.sort_order ASC, m.name ASC
  `).all() as any[];

  // Attach recipe information for each item
  const getRecipe = db.prepare(`
    SELECT r.id as recipe_id, r.instructions, ri.ingredient_id, ri.quantity_required, i.name as ingredient_name, i.unit
    FROM recipes r
    JOIN recipe_items ri ON r.id = ri.recipe_id
    JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE r.menu_item_id = ?
  `);

  const enrichedItems = items.map(item => {
    const recipeRows = getRecipe.all(item.id) as any[];
    return {
      ...item,
      recipe: recipeRows.length > 0 ? {
        recipe_id: recipeRows[0].recipe_id,
        instructions: recipeRows[0].instructions,
        ingredients: recipeRows.map(r => ({
          ingredient_id: r.ingredient_id,
          name: r.ingredient_name,
          quantity: r.quantity_required,
          unit: r.unit
        }))
      } : null
    };
  });

  res.json(enrichedItems);
});

// Create menu item with recipe (Admin, Owner, Chef)
menuRouter.post('/items', authenticate, authorizeRole(['admin', 'owner', 'chef']), (req: AuthenticatedRequest, res) => {
  const { category_id, name, name_amharic, description, price, prep_time_minutes, routing_destination, ingredients, instructions } = req.body;

  if (!category_id || !name || price === undefined || !routing_destination) {
    return res.status(400).json({ error: 'Category, name, price and routing destination (KITCHEN/BAR) are required' });
  }

  const itemId = `menu_${uuidv4().substring(0, 8)}`;
  const recipeId = `rcp_${uuidv4().substring(0, 8)}`;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO menu_items (id, category_id, name, name_amharic, description, price, prep_time_minutes, routing_destination)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, category_id, name, name_amharic || null, description || null, price, prep_time_minutes || 15, routing_destination);

    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      db.prepare(`INSERT INTO recipes (id, menu_item_id, instructions) VALUES (?, ?, ?)`).run(recipeId, itemId, instructions || null);
      const insertRecipeItem = db.prepare(`
        INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required)
        VALUES (?, ?, ?, ?)
      `);
      for (const ing of ingredients) {
        insertRecipeItem.run(`ri_${uuidv4().substring(0, 8)}`, recipeId, ing.ingredient_id, ing.quantity);
      }
    }
  });

  tx();

  logAudit({
    branchId: req.user!.branch_id,
    userId: req.user!.id,
    action: 'MENU_ITEM_CREATED',
    entityType: 'MENU_ITEM',
    entityId: itemId,
    details: { name, price, routing_destination }
  });

  res.status(201).json({ id: itemId, message: 'Menu item created successfully' });
});
