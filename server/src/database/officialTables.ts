import { db } from './schema.js';

export interface OfficialTable {
  id: string;
  table_number: string;
  name: string;
  section: string;
  capacity: number;
}

export const OFFICIAL_SECTIONS = [
  'Restaurant 1',
  'TERAZ (Terrace)',
  'Restaurant-02',
  'Restaurant Coffee Area',
  'Garden - Left Side',
  'Berenda (Veranda)'
] as const;

export const OFFICIAL_TABLES: OfficialTable[] = [
  // 1. Section: Restaurant 1 (10 tables)
  { id: 'tbl_r1_bar01', table_number: 'Bar 01', name: 'Bar 01', section: 'Restaurant 1', capacity: 2 },
  { id: 'tbl_r1_bar02', table_number: 'Bar 02', name: 'Bar 02', section: 'Restaurant 1', capacity: 2 },
  { id: 'tbl_r1_tbl03', table_number: 'R-03', name: 'Table 03', section: 'Restaurant 1', capacity: 4 },
  { id: 'tbl_r1_tbl04', table_number: 'R-04', name: 'Table 04', section: 'Restaurant 1', capacity: 4 },
  { id: 'tbl_r1_tbl05', table_number: 'R-05', name: 'Table 05', section: 'Restaurant 1', capacity: 4 },
  { id: 'tbl_r1_tbl06', table_number: 'R-06', name: 'Table 06', section: 'Restaurant 1', capacity: 4 },
  { id: 'tbl_r1_tbl07', table_number: 'R-07', name: 'Table 07', section: 'Restaurant 1', capacity: 4 },
  { id: 'tbl_r1_tbl08', table_number: 'R-08', name: 'Table 08', section: 'Restaurant 1', capacity: 4 },
  { id: 'tbl_r1_tbl09', table_number: 'R-09', name: 'Table 09', section: 'Restaurant 1', capacity: 4 },
  { id: 'tbl_r1_tbl10', table_number: 'R-10', name: 'Table 10', section: 'Restaurant 1', capacity: 4 },

  // 2. Section: TERAZ (Terrace) (12 tables: 9 main + 3 plus)
  { id: 'tbl_trz_01', table_number: 'T-01', name: 'Teraz 01', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_02', table_number: 'T-02', name: 'Teraz 02', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_03', table_number: 'T-03', name: 'Teraz 03', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_04', table_number: 'T-04', name: 'Teraz 04', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_05', table_number: 'T-05', name: 'Teraz 05', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_06', table_number: 'T-06', name: 'Teraz 06', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_07', table_number: 'T-07', name: 'Teraz 07', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_08', table_number: 'T-08', name: 'Teraz 08', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_09', table_number: 'T-09', name: 'Teraz 09', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_10', table_number: 'T-10', name: 'Teraz 10 (TP-01)', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_11', table_number: 'T-11', name: 'Teraz 11 (TP-02)', section: 'TERAZ (Terrace)', capacity: 4 },
  { id: 'tbl_trz_12', table_number: 'T-12', name: 'Teraz 12 (TP-03)', section: 'TERAZ (Terrace)', capacity: 4 },

  // 3. Section: Restaurant-02 (9 tables)
  { id: 'tbl_r2_01', table_number: 'R2-01', name: 'Restaurant-02 Table 01', section: 'Restaurant-02', capacity: 4 },
  { id: 'tbl_r2_02', table_number: 'R2-02', name: 'Restaurant-02 Table 02', section: 'Restaurant-02', capacity: 4 },
  { id: 'tbl_r2_03', table_number: 'R2-03', name: 'Restaurant-02 Table 03', section: 'Restaurant-02', capacity: 4 },
  { id: 'tbl_r2_04', table_number: 'R2-04', name: 'Restaurant-02 Table 04', section: 'Restaurant-02', capacity: 4 },
  { id: 'tbl_r2_05', table_number: 'R2-05', name: 'Restaurant-02 Table 05', section: 'Restaurant-02', capacity: 4 },
  { id: 'tbl_r2_06', table_number: 'R2-06', name: 'Restaurant-02 Table 06', section: 'Restaurant-02', capacity: 4 },
  { id: 'tbl_r2_07', table_number: 'R2-07', name: 'Restaurant-02 Table 07', section: 'Restaurant-02', capacity: 4 },
  { id: 'tbl_r2_08', table_number: 'R2-08', name: 'Restaurant-02 Table 08', section: 'Restaurant-02', capacity: 4 },
  { id: 'tbl_r2_09', table_number: 'R2-09', name: 'Restaurant-02 Table 09', section: 'Restaurant-02', capacity: 4 },

  // 4. Section: Restaurant Coffee Area (2 tables)
  { id: 'tbl_cf_sofa', table_number: 'CF-01', name: 'Soffa (Sofa)', section: 'Restaurant Coffee Area', capacity: 4 },
  { id: 'tbl_cf_bar', table_number: 'CF-02', name: 'Bar Table', section: 'Restaurant Coffee Area', capacity: 2 },

  // 5. Section: Garden - Left Side (15 tables: ምድብ 1 (9) + ምድብ 2 (6))
  { id: 'tbl_g_01', table_number: 'G-01', name: 'Garden 01', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_02', table_number: 'G-02', name: 'Garden 02', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_03', table_number: 'G-03', name: 'Garden 03', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_04', table_number: 'G-04', name: 'Garden 04', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_05', table_number: 'G-05', name: 'Garden 05', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_06', table_number: 'G-06', name: 'Garden 06', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_07', table_number: 'G-07', name: 'Garden 07', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_08', table_number: 'G-08', name: 'Garden 08', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_09', table_number: 'G-09', name: 'Garden 09', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_10', table_number: 'G-10', name: 'Garden 10', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_11', table_number: 'G-11', name: 'Garden 11', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_12', table_number: 'G-12', name: 'Garden 12', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_13', table_number: 'G-13', name: 'Garden 13', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_14', table_number: 'G-14', name: 'Garden 14', section: 'Garden - Left Side', capacity: 4 },
  { id: 'tbl_g_15', table_number: 'G-15', name: 'Garden 15', section: 'Garden - Left Side', capacity: 4 },

  // 6. Section: Berenda (Veranda) (3 tables)
  { id: 'tbl_b_01', table_number: 'B-01', name: 'Berenda 01', section: 'Berenda (Veranda)', capacity: 4 },
  { id: 'tbl_b_02', table_number: 'B-02', name: 'Berenda 02', section: 'Berenda (Veranda)', capacity: 4 },
  { id: 'tbl_b_03', table_number: 'B-03', name: 'Berenda 03', section: 'Berenda (Veranda)', capacity: 4 }
];

/**
 * Seeds or restores the 51 official restaurant tables across the 6 sections
 */
export function seedOfficialTables(targetBranchId?: string, force: boolean = false) {
  try {
    const branch = targetBranchId || (db.prepare("SELECT id FROM branches ORDER BY created_at ASC LIMIT 1").get() as any)?.id || 'branch_addis';

    const existingCount = db.prepare('SELECT COUNT(*) as count FROM restaurant_tables WHERE branch_id = ? AND is_active = 1').get(branch) as { count: number };
    if (!force && existingCount && existingCount.count >= 20) {
      console.log(`[Official Tables] Already seeded (${existingCount.count} tables for branch ${branch}). Skipping.`);
      return;
    }

    console.log(`[Official Tables] Seeding all 6 official sections and ${OFFICIAL_TABLES.length} tables for branch: ${branch}...`);

    const tx = db.transaction(() => {
      const insertTable = db.prepare(`
        INSERT INTO restaurant_tables (id, branch_id, table_number, name, section, capacity, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 'AVAILABLE', 1)
        ON CONFLICT(id) DO UPDATE SET
          branch_id = excluded.branch_id,
          table_number = excluded.table_number,
          name = excluded.name,
          section = excluded.section,
          capacity = excluded.capacity,
          is_active = 1
      `);

      for (const t of OFFICIAL_TABLES) {
        insertTable.run(t.id, branch, t.table_number, t.name, t.section, t.capacity);
      }
    });

    tx();
    console.log(`[Official Tables] ✓ Successfully seeded ${OFFICIAL_TABLES.length} tables across ${OFFICIAL_SECTIONS.length} sections!`);
  } catch (err) {
    console.error('[Official Tables] Error seeding tables:', err);
  }
}
