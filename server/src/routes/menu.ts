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

// Search menu items (by English or Amharic name)
menuRouter.get('/items/search', authenticate, (req, res) => {
  const q = ((req.query.q as string) || '').trim();
  if (!q) {
    return res.json([]);
  }
  const searchTerm = `%${q}%`;
  const items = db.prepare(`
    SELECT m.*, c.name as category_name
    FROM menu_items m
    JOIN menu_categories c ON m.category_id = c.id
    WHERE m.deleted_at IS NULL
      AND (m.name LIKE ? OR m.name_amharic LIKE ? OR m.description LIKE ?)
    ORDER BY m.name ASC LIMIT 25
  `).all(searchTerm, searchTerm, searchTerm);
  res.json(items);
});

// Get menu items with recipes
menuRouter.get('/items', authenticate, (req, res) => {
  const includeAll = req.query.all === 'true';
  const whereClause = includeAll 
    ? 'WHERE m.deleted_at IS NULL' 
    : 'WHERE m.is_available = 1 AND m.deleted_at IS NULL';
  const items = db.prepare(`
    SELECT m.*, c.name as category_name 
    FROM menu_items m
    JOIN menu_categories c ON m.category_id = c.id
    ${whereClause}
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
  const { category_id, name, name_amharic, description, price, photo_url, prep_time_minutes, routing_destination, ingredients, instructions } = req.body;

  if (!category_id || !name || price === undefined || !routing_destination) {
    return res.status(400).json({ error: 'Category, name, price and routing destination (KITCHEN/BAR) are required' });
  }

  const itemId = `menu_${uuidv4().substring(0, 8)}`;
  const recipeId = `rcp_${uuidv4().substring(0, 8)}`;

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO menu_items (id, category_id, name, name_amharic, description, price, photo_url, prep_time_minutes, routing_destination)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, category_id, name, name_amharic || null, description || null, price, photo_url || null, prep_time_minutes || 15, routing_destination);

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

// Get single menu item with full BOM recipe
menuRouter.get('/items/:id', authenticate, (req, res) => {
  const item = db.prepare(`
    SELECT m.*, c.name as category_name
    FROM menu_items m
    JOIN menu_categories c ON m.category_id = c.id
    WHERE m.id = ?
  `).get(req.params.id) as any;

  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  const recipeRows = db.prepare(`
    SELECT r.id as recipe_id, r.instructions, r.yield_portions,
           ri.id as recipe_item_id, ri.ingredient_id, ri.quantity_required,
           i.name as ingredient_name, i.unit, i.unit_cost
    FROM recipes r
    JOIN recipe_items ri ON r.id = ri.recipe_id
    JOIN ingredients  i  ON ri.ingredient_id = i.id
    WHERE r.menu_item_id = ?
  `).all(req.params.id) as any[];

  res.json({
    ...item,
    recipe: recipeRows.length > 0 ? {
      recipe_id: recipeRows[0].recipe_id,
      instructions: recipeRows[0].instructions,
      yield_portions: recipeRows[0].yield_portions,
      ingredients: recipeRows.map(r => ({
        recipe_item_id: r.recipe_item_id,
        ingredient_id: r.ingredient_id,
        name: r.ingredient_name,
        quantity_required: r.quantity_required,
        unit: r.unit,
        unit_cost: r.unit_cost
      }))
    } : null
  });
});

// Upsert (replace) a menu item's full recipe / BOM
menuRouter.put('/items/:id/recipe', authenticate, authorizeRole(['admin', 'owner', 'chef']), (req: AuthenticatedRequest, res) => {
  const menuItemId = req.params.id;
  const { instructions, yield_portions, ingredients } = req.body;
  // ingredients: Array<{ ingredient_id: string; quantity_required: number }>

  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'At least one ingredient is required for a recipe' });
  }

  const menuItem = db.prepare('SELECT id FROM menu_items WHERE id = ?').get(menuItemId);
  if (!menuItem) return res.status(404).json({ error: 'Menu item not found' });

  const tx = db.transaction(() => {
    // Check for existing recipe
    const existing = db.prepare('SELECT id FROM recipes WHERE menu_item_id = ?').get(menuItemId) as any;

    let recipeId: string;
    if (existing) {
      recipeId = existing.id;
      // Update recipe header
      db.prepare(`
        UPDATE recipes SET instructions = ?, yield_portions = ? WHERE id = ?
      `).run(instructions || null, yield_portions || 1, recipeId);
      // Delete old BOM lines
      db.prepare('DELETE FROM recipe_items WHERE recipe_id = ?').run(recipeId);
    } else {
      recipeId = `rcp_${uuidv4().substring(0, 8)}`;
      db.prepare(`
        INSERT INTO recipes (id, menu_item_id, instructions, yield_portions)
        VALUES (?, ?, ?, ?)
      `).run(recipeId, menuItemId, instructions || null, yield_portions || 1);
    }

    // Insert new BOM lines
    const insertLine = db.prepare(`
      INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity_required)
      VALUES (?, ?, ?, ?)
    `);
    for (const ing of ingredients) {
      insertLine.run(`ri_${uuidv4().substring(0, 8)}`, recipeId, ing.ingredient_id, ing.quantity_required);
    }
  });

  tx();

  logAudit({
    branchId: req.user!.branch_id,
    userId: req.user!.id,
    action: 'RECIPE_UPDATED',
    entityType: 'MENU_ITEM',
    entityId: menuItemId,
    details: { ingredientCount: ingredients.length }
  });

  res.json({ message: 'Recipe updated successfully', menuItemId });
});

// Update menu item details (Admin, Owner, Chef)
menuRouter.put('/items/:id', authenticate, authorizeRole(['admin', 'owner', 'chef']), (req: AuthenticatedRequest, res) => {
  const { category_id, name, name_amharic, description, price, photo_url, prep_time_minutes, routing_destination, is_available } = req.body;
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id) as any;
  if (!item) return res.status(404).json({ error: 'Menu item not found' });

  db.prepare(`
    UPDATE menu_items
    SET category_id = COALESCE(?, category_id),
        name = COALESCE(?, name),
        name_amharic = COALESCE(?, name_amharic),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        photo_url = COALESCE(?, photo_url),
        prep_time_minutes = COALESCE(?, prep_time_minutes),
        routing_destination = COALESCE(?, routing_destination),
        is_available = COALESCE(?, is_available)
    WHERE id = ?
  `).run(
    category_id ?? null,
    name ?? null,
    name_amharic ?? null,
    description ?? null,
    price !== undefined ? Number(price) : null,
    photo_url !== undefined ? photo_url : null,
    prep_time_minutes !== undefined ? Number(prep_time_minutes) : null,
    routing_destination ?? null,
    is_available !== undefined ? (is_available ? 1 : 0) : null,
    req.params.id
  );

  logAudit({
    branchId: req.user!.branch_id,
    userId: req.user!.id,
    action: 'MENU_ITEM_UPDATED',
    entityType: 'MENU_ITEM',
    entityId: req.params.id,
    details: { name: name || item.name, price: price || item.price }
  });

  res.json({ message: 'Menu item updated successfully', id: req.params.id });
});

// Delete menu item (Soft delete: Admin, Owner, Chef)
menuRouter.delete('/items/:id', authenticate, authorizeRole(['admin', 'owner', 'chef']), (req: AuthenticatedRequest, res) => {
  const item = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id) as any;
  if (!item || item.deleted_at) return res.status(404).json({ error: 'Menu item not found' });

  db.prepare('UPDATE menu_items SET deleted_at = CURRENT_TIMESTAMP, is_available = 0 WHERE id = ?').run(req.params.id);

  logAudit({
    branchId: req.user!.branch_id,
    userId: req.user!.id,
    action: 'MENU_ITEM_DELETED',
    entityType: 'MENU_ITEM',
    entityId: req.params.id,
    details: { name: item.name }
  });

  res.json({ message: 'Menu item deleted successfully' });
});


