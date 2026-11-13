# Specification: Community Whistleblower & Feedback Loop

## Overview
This track delivers the **Community Whistleblower & Feedback Loop** for KawalKopdesMBG. It empowers village community members (*Warga & Orang Tua Siswa*), local farmers (*Petani Lokal*), and field officers (*Petugas Lapangan*) to report supply chain bottlenecks, spoiled or substandard ingredients, quantity discrepancies, or farmer fair-price violations in the *Makan Bergizi Gratis* (MBG) program. Reports protect whistleblower privacy by default, support optional compressed photo evidence, link optionally to specific deliveries/cooperatives/kitchens, and enable transparent follow-up triage by Village Cooperatives (*Koperasi Desa*) and SPPG Central Kitchens.

## Functional Requirements

### 1. Data Modeling & Seed Data (`community_reports`)
- **Table (`community_reports` in `src/db/schema.ts`):**
  - `id`: Auto-incrementing integer primary key.
  - `category`: Enum (`KUALITAS_PANGAN`, `HARGA_PETANI`, `KENDALA_DISTRIBUSI`, `SELISIH_KUANTITAS`).
  - `severity`: Enum (`HIGH`, `MEDIUM`, `LOW`).
  - `status`: Enum (`BARU`, `DITINDAKLANJUTI`, `SELESAI`) defaulting to `BARU`.
  - `reporterRoleLabel`: Text (`Warga / Orang Tua Siswa`, `Petani Lokal`, `Petugas Lapangan`, `Pelapor Anonim`).
  - `reporterName`: Optional text (masked in public projections, e.g., `Ibu R***` or `Pelapor Anonim`).
  - `reporterContact`: Optional text (phone/WhatsApp for internal verification; **never** exposed in public projections).
  - `isAnonymous`: Integer/boolean flag defaulting to `true`.
  - `deliveryId`: Optional foreign key referencing `deliveries.id`.
  - `cooperativeId`: Optional foreign key referencing `cooperatives.id`.
  - `kitchenId`: Optional foreign key referencing `kitchens.id`.
  - `title`: Short summary of the issue.
  - `description`: Detailed report narrative.
  - `photoPath`: Optional path to compressed photo evidence (`/uploads/reports/...`).
  - `responseNote`: Optional official follow-up/resolution note from Koperasi or SPPG.
  - `respondedBy`: Optional responder identity/role label.
  - `resolvedAt`: Optional Unix epoch timestamp when status transitions to `SELESAI`.
  - `createdAt`: Unix epoch creation timestamp.
- **Seed Data (`src/db/seed.ts`):**
  - Pre-populate realistic Subang and Banyumas community reports across `BARU`, `DITINDAKLANJUTI`, and `SELESAI` statuses.

### 2. Whistleblower Privacy & Triage Service (`src/lib/whistleblower.ts`)
- **Privacy Masking (`maskReporterIdentity`):**
  - Masks reporter names in public views (or displays `Pelapor Anonim` when `isAnonymous` is true) and strips `reporterContact` from all public payloads.
- **Photo Evidence Storage (`compressAndStoreReportPhoto`):**
  - Validates and stores optional client-side compressed photo evidence with deterministic hash paths under `/uploads/reports/`.
- **Report Submission (`submitCommunityReport`):**
  - Validates category, severity, title, description, and optional entity links (`deliveryId`, `cooperativeId`, `kitchenId`).
- **Role-Gated Triage (`triageCommunityReport`):**
  - Allows `KOPERASI_ADMIN` and `SPPG_STAFF` (`TRIAGE_REPORT` permission) to post official follow-up notes (`responseNote`, `respondedBy`) and update status (`BARU` -> `DITINDAKLANJUTI` -> `SELESAI`).
- **Public Aggregation & Filtering (`getPublicWhistleblowerSnapshot`, `filterWhistleblowerReports`):**
  - Computes live KPIs (total reports, open/in-progress count, resolved count, resolution rate) and filters by category, status, cooperative, kitchen, or search keyword.

### 3. Role Permissions & Navigation (`src/lib/session.ts`)
- Add `SUBMIT_REPORT` (permitted for `PUBLIC_OBSERVER`, `KOPERASI_ADMIN`, `SPPG_STAFF`) and `TRIAGE_REPORT` (permitted for `KOPERASI_ADMIN`, `SPPG_STAFF`) to `ROLE_ACTIONS`.
- Add `/laporan` (*Pengaduan & Aspirasi Warga*) to the header navigation for all personas.

### 4. Dedicated `/laporan` Portal & Public Dashboard Integration
- **Portal Route (`/laporan`):**
  - Displays live community reporting KPIs, report submission form (supporting anonymous toggle, category/severity selection, optional delivery/cooperative/kitchen link, and optional photo evidence), filterable public report feed, and role-aware Triage Action modal for `KOPERASI_ADMIN` and `SPPG_STAFF`.
- **Public Transparency Dashboard Integration (`src/components/public-transparency-dashboard.tsx`):**
  - Adds an inline *"Laporkan Kendala"* quick-action link on each public delivery card that deep-links to `/laporan?deliveryId=<id>` to pre-select the delivery context.

## Non-Functional Requirements
- **Whistleblower Privacy & Safety:** Zero leakage of `reporterContact` or unmasked reporter names in public APIs or UI snapshots.
- **Rural Mobile UX:** Minimum 48x48px touch targets, client-side photo compression, and clear Bahasa Indonesia microcopy following the *gotong royong* brand tone.
- **Testability:** Full unit, component, and E2E test coverage (>80%).

## Acceptance Criteria
- [ ] `community_reports` table is defined in Drizzle schema, migrated in SQLite, and seeded with realistic Subang & Banyumas reports.
- [ ] Public snapshot strips all `reporterContact` phone numbers and masks reporter names according to anonymity preferences.
- [ ] Any user role can submit a community report (with or without photo evidence and entity links) at `/laporan`.
- [ ] Public delivery cards on `/` include a quick action to report an issue pre-linked to that delivery.
- [ ] `KOPERASI_ADMIN` and `SPPG_STAFF` can triage reports (`BARU` -> `DITINDAKLANJUTI` -> `SELESAI`) with an official response note, while `PUBLIC_OBSERVER` cannot mutate report status.
- [ ] Automated unit, UI, and E2E lifecycle tests pass with zero lint or TypeScript errors.

## Out of Scope
- External SMS/WhatsApp webhook notifications.
- Law-enforcement or external ombudsman API synchronization.
