# Specification: Initial MVP for KawalKopdesMBG

## Overview
This track delivers the foundational MVP for KawalKopdesMBG: a full-stack Next.js web application utilizing SQLite with Drizzle ORM. The MVP enables village cooperatives (*Koperasi Desa*) to manage commodity procurement from local farmers, issue delivery dispatches with verifiable QR codes to central kitchens (*Satuan Pelayanan Pemenuhan Gizi* / SPPG), perform two-way Proof of Delivery (PoD) with photo evidence upon delivery, and display aggregated supply and transparency statistics on a public dashboard.

## Functional Requirements

### 1. System Scaffolding & Data Modeling
- **Tech Foundation:** Next.js (App Router, TypeScript, Tailwind CSS, Shadcn UI, Lucide Icons).
- **Persistence Layer:** SQLite with Drizzle ORM and Drizzle Kit migrations.
- **Data Entities:**
  - `cooperatives`: Village cooperative profile, village location, contact info.
  - `kitchens`: SPPG central kitchen location, capacity, service area.
  - `farmers`: Local farmer profiles affiliated with village cooperatives.
  - `commodities`: Agricultural products (e.g., Beras, Telur, Daging Ayam, Sayuran) with unit measure and regional benchmark prices.
  - `deliveries`: Dispatch record linking cooperative, kitchen, scheduled date, status (`DRAFT`, `DISPATCHED`, `VERIFIED`, `REJECTED`), QR security token.
  - `delivery_items`: Line items with commodity reference, quantity, unit price paid to farmer, total value.
  - `proof_of_delivery`: Verification record containing receiver name, timestamp, digital sign-off note, and photo upload path.
- **Seed Data:** Pre-populate realistic Indonesian demo data (Koperasi Subang, Koperasi Banyumas, local farmers, SPPG Kitchens, and sample commodities in IDR).

### 2. User Roles & Lightweight Session Management
- Roles: `KOPERASI_ADMIN`, `SPPG_STAFF`, `PUBLIC_OBSERVER`.
- Role Switcher / Demo Authentication: Quick session selector in the development/demo environment with pre-configured personas to test workflows smoothly without SMS/OTP friction.

### 3. Cooperative Delivery Dispatch Management
- Interface for Koperasi managers to register supplies procured from local farmers.
- Create a delivery dispatch order to an SPPG kitchen with selected items and quantities.
- Generate a unique, tamper-resistant QR code and printable/shareable digital delivery pass (*Surat Jalan Digital*).

### 4. SPPG Two-Way QR Verification Handshake
- Mobile-optimized receiving screen for SPPG kitchen operators.
- In-browser QR code scanner (using camera) to instantly load delivery dispatch details.
- Inspection workflow: Check delivered item quantities, flag deviations if any, take/upload proof-of-delivery photo with client-side compression, and confirm receipt.
- Immediate status transition from `DISPATCHED` to `VERIFIED`.

### 5. Fair Price & Procurement Transparency Module
- Price comparison component on delivery creation highlighting cooperative purchase price vs. regional government benchmark price to ensure farmers receive fair market compensation.

### 6. Public Transparency Dashboard
- Landing page accessible to the general public and parents without authentication.
- Key metrics: Total kilograms of local produce absorbed, total value channeled to local village cooperatives, number of active participating farmers, and recent verified deliveries.
- Search/filter delivery logs by cooperative and date range (with sensitive personal data obscured).

## Non-Functional Requirements
- **Mobile Responsiveness:** Touch-friendly interfaces (min 48x48px tap targets) optimized for mobile browser use by cooperative drivers and kitchen receiving staff.
- **Low-Bandwidth Optimization:** Photo compression prior to upload; fast initial server-rendered page load.
- **Data Integrity:** Foreign key constraints, atomic delivery status updates, and immutable timestamps on verification.

## Acceptance Criteria
- [ ] Next.js project is fully initialized with TypeScript, Tailwind CSS, Lucide Icons, and Vitest configured.
- [ ] Drizzle ORM schema created and migrated with SQLite; database seeded with realistic Indonesian cooperative and kitchen data.
- [ ] Role-based session switcher allows seamlessly toggling between Koperasi Admin, SPPG Staff, and Public roles.
- [ ] Koperasi Admin can create an order, add commodities, and generate a delivery pass with a readable QR code.
- [ ] SPPG Staff can scan or input the delivery QR code, view items, upload a receipt photo, and mark the delivery as `VERIFIED`.
- [ ] Public dashboard displays live aggregated metrics and lists verified deliveries without authentication.
- [ ] Automated unit and integration tests validate the delivery lifecycle and status transitions with >80% test coverage.

## Out of Scope (Future Tracks)
- Real-time GPS vehicle tracking during transit.
- Automated payment gateway / bank disbursement integration.
- Hardware barcode scale integrations.
- Multi-factor biometric identity authentication.
