# GourmetOS — Client Production Handover & Deployment Manual

Welcome to **GourmetOS Restaurant Management System** — a high-performance, real-time, multi-branch restaurant operating system designed for restaurants, cafes, bars, and bakeries.

This manual is prepared for the client and system administrators to deploy, configure, secure, and operate the platform in a production environment.

---

## 1. Executive Summary & Capabilities

GourmetOS provides an integrated, end-to-end management solution:
- **Real-Time Order Routing:** Instant item dispatch to Kitchen (Chef KDS) and Bar (Barista Queue) via WebSockets.
- **Dedicated Bakery & Front Cake Counter System:** Batch baking production queue, physical transfers, counter POS, and stock management.
- **Automated Recipe & Stock Deduction (BOM):** Every menu item sold automatically deducts exact ingredient quantities (meat, buns, cheese, milk, coffee beans).
- **Split Payment & Cashier Desk:** Supports Cash, Telebirr, CBE Birr, and Bank Cards with printable receipt generation and cryptographic verification hashes.
- **Bilingual Interface:** Instant one-click toggle between English and Amharic (አማርኛ).
- **Offline Resilience:** Local caching with automatic IndexedDB/LocalStorage sync when internet connectivity drops.
- **Multi-Branch Operations:** Real-time visibility and consolidation across multiple locations (e.g. Addis Ababa, Adama, Dire Dawa).

---

## 2. Default Access Credentials

The system includes pre-seeded demo accounts. **All accounts share the default password: `password123` and default PIN: `1234`:**

| Role | Username | Access Level | Recommended Device |
|---|---|---|---|
| **Owner** | `owner` | Executive dashboards, P&L, multi-branch KPIs, sales analytics | Laptop / Desktop / Tablet |
| **Admin** | `admin` | User management, role permissions, settings, audit trail | Laptop / Desktop |
| **Cashier** | `cashier` | Order authorization, split payments, receipts, discounts | POS Touch Terminal / PC |
| **Chef** | `chef` | Kitchen Display System (KDS), preparation timers, order ready | 10"+ Kitchen Tablet / TV |
| **Barista** | `barista` | Bar queue, beverage tickets, drink readiness | 10"+ Bar Tablet |
| **Bakery** | `bakery` | Bakery production batches, transfer orders, wastage tracking | Tablet / Touch Screen |
| **Front Cake Counter** | `front_counter` | Cake showcase POS, transfer receiving, walk-in sales | POS Touch Terminal / Tablet |
| **Waiter** | `waiter` | Mobile POS, table orders, cart, real-time ready alerts | Android Smartphone / Mini Tablet |
| **Storekeeper** | `storekeeper` | Inventory catalog, PO receiving, waste logging with camera | Smartphone / Tablet |

> [!IMPORTANT]
> **Change all passwords before opening to the public!** Log in as `admin`, navigate to **Staff Management**, and update passwords/PINs for each staff member.

---

## 2.1 Hardware Fingerprint & Anti-Theft Protection 🔒

GourmetOS features **Hardware-Enforced Digital Rights Management (DRM)** to prevent unauthorized duplication, software theft, or running the system on unauthorized restaurant branches:

### 🛡️ How Anti-Theft Protection Works:
1. **Unique Machine Fingerprint:** When installed on a central restaurant computer or server, GourmetOS calculates a unique hardware fingerprint derived from the physical motherboard UUID, CPU architecture, and OS cryptographic machine GUID.
   - Format: `GOS-M-XXXX-XXXX-XXXX-XXXX` (e.g. `GOS-M-270E-74B0-52CA-449D`).
2. **Cryptographic Binding:** Each license key is digitally signed using HMAC-SHA256 with a private vendor secret key. The license token contains the exact Machine ID permitted to run the software.
3. **If Stolen or Copied to Another Restaurant:** If someone copies the database or files to another computer without authorization, the hardware fingerprint mismatch is detected immediately. GourmetOS locks operational APIs (`403 LICENSE_REQUIRED`) and presents the **System Activation Screen**.

### 🎟️ How the Software Provider Generates a License Key:
To issue an activation key for a client's server, run the built-in generator:
```bash
npm run license:generate -- --client "Yo Burger Addis" --machine "GOS-M-XXXX-XXXX-XXXX-XXXX" --plan LIFETIME --branches 5
```
Or for cloud deployments:
```bash
npm run license:generate -- --client "Cloud SaaS Client" --machine "*" --plan PRO --expires 2027-12-31
```
Send the resulting `GOS-...` activation key to the client to unlock their installation.

---

## 3. Production Deployment Options

Choose the deployment model that best matches your restaurant's infrastructure:

### Option A: Turnkey Cloud Hosting (Render.com + Free Supabase) ⭐
*Best for zero-maintenance cloud access accessible from any location or mobile network.*

1. **Backend Service on Render.com:**
   - Sign up at [render.com](https://render.com) and create a **New Web Service** connected to your repository.
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:**
     - `NODE_ENV`: `production`
     - `PORT`: `4001`
     - `JWT_SECRET`: `[Generate a secure 32+ character random string]`
     - `CLIENT_ORIGIN`: `https://[your-app-domain].com,http://localhost:4001`

2. **Automated Cloud Backup (Supabase Storage - Free 1 GB):**
   - Create a free project at [supabase.com](https://supabase.com).
   - Create a private storage bucket named `restaurant-backups`.
   - Add these environment variables in your Render dashboard:
     - `SUPABASE_URL`: `https://[your-project-id].supabase.co`
     - `SUPABASE_KEY`: `[your-service-role-secret-key]`
     - `SUPABASE_BUCKET`: `restaurant-backups`
   - *Result: Your database is backed up continuously to cloud storage. Even if the server sleeps or restarts, data is never lost.*

---

### Option B: On-Premise Docker Deployment (Single Command) 🐳
*Best for local restaurant mini-PCs, Linux servers, or dedicated cloud VPS (DigitalOcean / AWS / Linode).*

1. Install **Docker** and **Docker Compose** on your host server.
2. Clone or copy the repository to the server.
3. Create your production environment file:
   ```bash
   cp server/.env.example .env
   ```
   Edit `.env` to set your unique `JWT_SECRET`.
4. Launch the application:
   ```bash
   docker compose up -d --build
   ```
5. The complete system (Frontend + Backend + Database) will be running at `http://[SERVER_IP]:4001`.
6. To view real-time logs:
   ```bash
   docker compose logs -f
   ```

---

### Option C: Local Restaurant Network (Offline-First Central PC) 💻
*Best for running 100% inside the restaurant even when external internet goes down.*

1. Select a designated central computer (e.g. Cashier PC or Restaurant Server).
2. Install **Node.js 22 LTS** from [nodejs.org](https://nodejs.org).
3. From the project directory, run:
   ```bash
   npm run build
   npm start
   ```
4. Find the local Wi-Fi IP of the central PC (e.g. `192.168.1.100` via `ipconfig` or `ifconfig`).
5. Staff tablets and smartphones connected to the restaurant Wi-Fi can open the browser to:
   `http://192.168.1.100:4001`
6. The app is fully responsive and can be installed as a Progressive Web App (PWA) by clicking "Add to Home Screen".

---

### Option D: Android Mobile App (Capacitor Native APK) 📱
*Best for dedicated waiter and storekeeper handheld devices.*

1. The Android native project is pre-configured in `client/android`.
2. Sync the latest web build:
   ```bash
   npm run build:mobile
   ```
3. Open `client/android` in **Android Studio**.
4. Go to **Build** ➔ **Generate Signed Bundle / APK**.
5. Select **APK** (for direct device installation) or **Android App Bundle (.aab)** (for Google Play Store upload).
6. Transfer the `.apk` file to staff Android devices and install.

---

## 4. Production Security Checklist

Before taking orders from live customers, ensure the following steps are completed:

- [ ] **Generate a Strong JWT Secret:** Set `JWT_SECRET` in `.env` to a random string of at least 32 characters.
- [ ] **Update Default Passwords:** Change `password123` for all seeded accounts (`owner`, `admin`, `cashier`, etc.).
- [ ] **Update Staff PINs:** Change the default `1234` supervisor override PIN to private numbers known only to authorized personnel.
- [ ] **Configure Tax & TIN Number:** In **Admin ➔ Settings**, update your restaurant TIN number and tax rate (e.g. 15% VAT).
- [ ] **Configure Custom Branding:** Update restaurant name, currency symbol (`ETB`, `$`, etc.), and upload your restaurant logo.
- [ ] **Enable Automatic Cloud Backups:** Supply Supabase credentials to ensure daily off-site disaster recovery.

---

## 5. Operations & Daily Workflows

### 🍽️ 1. Waiter Workflow
1. Log in with waiter credentials.
2. Select Dine-In table or Takeaway.
3. Tap menu items to add to cart, configure preparation notes (e.g., "extra crispy", "no onions").
4. Submit order. Order immediately appears on Cashier screen for confirmation.
5. Once kitchen/bar prepares the items, waiter receives a vibrant sound & visual alert (`READY`).
6. Deliver food to table and mark as `DELIVERED`.

### 💵 2. Cashier Workflow
1. Review incoming waiter orders in real-time.
2. Confirm or adjust discounts / taxes.
3. When customer is ready to pay, open settlement screen.
4. Select payment method (Cash, Telebirr, CBE Birr, Card, or Split Payment).
5. Record payment and print customer receipt with verified authenticity QR code.

### 🔥 3. Kitchen & Bar Displays (KDS)
1. Chefs see only food orders sorted by order time with countdown timers.
2. Baristas see only coffee and beverage tickets.
3. Tap "Start Preparing" when starting, tap "Mark Ready" when plated.
4. When all items of an order are completed, the system automatically alerts the assigned waiter.

### 🍰 4. Bakery & Front Cake Counter
1. **Bakery:** Kitchen staff plan daily batches, bake cakes/pastries, and generate physical transfer sheets to the front display counter.
2. **Front Counter:** Sales staff verify incoming transfers, stock the glass display case, sell directly to walk-in customers, and report stock status to waiters.

### 📦 5. Storekeeper & Recipe Inventory
1. Receive supplier deliveries and update stock with purchase prices and batch expiry dates.
2. Every dish sold automatically deducts exact ingredient quantities based on the configured recipe Bill-of-Materials (BOM).
3. Record waste/spoilage with camera snapshots directly from the phone.

### 👑 6. Owner Dashboard
1. Real-time gross sales, net profit, expense breakdown, and average ticket size.
2. Comparative performance across branches (Addis Ababa vs. Adama vs. Dire Dawa).
3. Waiter sales leaderboards and top-selling menu items.

---

## 6. Backup, Maintenance & Support

- **Database File:** SQLite database is located at `./restaurant.db` (or `/data/restaurant.db` in Docker/cloud).
- **Manual Backup:** Simply copy `restaurant.db` to a safe storage drive. SQLite WAL mode ensures zero data corruption during copy operations.
- **Automated Cloud Backup:** If Supabase credentials are configured, backups sync automatically every 5 minutes and on server shutdown.
- **System Verification Test:** To verify the system's database, order lifecycle, stock deduction, and calculations at any time, run:
  ```bash
  npm test
  ```
- **Clean Slate / Wipe Test Data for Opening Day:** If you performed training orders or testing and want to wipe all transactions, menu items, or demo orders back to zero while preserving staff accounts, run:
  ```bash
  npm run db:clean
  ```


---

*GourmetOS is designed and built for robust, uninterrupted restaurant operations.*
