# GourmetOS — Multi-Branch Restaurant Management System MVR

A modern, production-ready, cross-platform Minimum Viable Release (MVR) for restaurant operations with real-time routing, offline sync, automated recipe stock deduction, multi-branch management, and bilingual (English + Amharic) support.

---

## 1. System Architecture

```text
                                  +---------------------------------------+
                                  |         Cross-Platform Client         |
                                  |     (React 19 + TypeScript + Vite)    |
                                  |  - Role-based ergonomic mobile UI     |
                                  |  - English & Amharic (አማርኛ) i18n     |
                                  |  - Camera capture with compression    |
                                  |  - Offline IndexedDB/LocalStorage sync|
                                  +---------------------------------------+
                                                     |
                                   HTTP REST / WS    | Real-Time Events
                                                     v
                                  +---------------------------------------+
                                  |            Express Server             |
                                  |        (Node.js 24 + TypeScript)     |
                                  |  - JWT Auth + PIN manager override    |
                                  |  - Granular RBAC permissions engine   |
                                  |  - Real-time room/role WebSocket      |
                                  |  - Order Lifecycle State Machine      |
                                  |  - BOM Recipe stock consumption       |
                                  |  - Multi-branch isolation & analytics |
                                  +---------------------------------------+
                                                     |
                                                     v
                                  +---------------------------------------+
                                  |          Relational Database          |
                                  |       (SQLite / PostgreSQL engine)    |
                                  |  - Complete normalized schema         |
                                  |  - Foreign keys, indexes & constraints|
                                  |  - Immutable audit logs               |
                                  +---------------------------------------+
```

---

## 2. Supported Roles & Experiences

| Role | Primary Functions |
|---|---|
| **Owner** | Multi-branch overview (Addis Ababa, Adama, Dire Dawa), consolidated P&L, sales, expenses, waiter performance comparisons, and executive KPIs. |
| **Admin** | Employee approval/onboarding, role & custom permission matrix, expense tracking, settings, and full system audit logs. |
| **Cashier** | Incoming order review, price/tax/discount authorization, order confirmation & kitchen/bar routing, split payment processing (Cash, Telebirr, CBE Birr, Card), and receipt generation. |
| **Chef** | Kitchen Display System (KDS) showing only food items (Burgers, Pizzas), preparation timer, start cooking, and item readiness toggles. |
| **Barista** | Bar drink queue showing only beverage items (Espresso, Macchiato, Juices), drink prep queue, and beverage ready toggles. |
| **Waiter** | Rapid mobile POS, table selector, dine-in/takeaway, instant cart, preparation notes, and real-time ready alerts for food delivery. |
| **Storekeeper** | Inventory catalog, goods receiving with PO logging, waste recording with phone camera photos, shelf locations, and low-stock alerts. |

---

## 3. Pre-Seeded Demo Accounts

Every account uses password: `password123` (or PIN `1234`):

- **Owner**: `owner`
- **Admin**: `admin`
- **Cashier**: `cashier`
- **Chef**: `chef`
- **Barista**: `barista`
- **Waiter**: `waiter`
- **Storekeeper**: `storekeeper`

---

## 4. How to Run Locally

### Backend Server
```bash
cd server
npm install
npm run dev
```
- Running at: `http://localhost:4000`
- WebSocket: `ws://localhost:4000/ws`

### Mobile Client
```bash
cd client
npm install
npm run dev
```
- Available at: `http://localhost:5173`

---

## 5. End-to-End Verification Test
Run the automated restaurant test script that simulates the entire scenario (#72 in requirements):
```bash
cd server
node test_scenario.js
```
The test verifies:
1. Waiter login & Order placement (Burger + Macchiato)
2. Cashier review, discount check, and confirmation
3. Automatic routing of Burger to Chef and Macchiato to Barista
4. Independent item preparation and automatic `READY` calculation
5. Waiter real-time notification & delivery
6. Split payment settlement (Telebirr + Cash) & receipt generation
7. Automatic Bill-of-Materials (BOM) ingredient deduction from branch inventory
8. Update of Owner consolidated metrics & audit logging.
