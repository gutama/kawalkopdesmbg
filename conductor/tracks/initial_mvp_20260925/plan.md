# Implementation Plan: Initial MVP for KawalKopdesMBG

## Phase 1: Project Scaffolding & Database Layer [checkpoint: b796b69]
- [x] Task: Project Scaffolding & Testing Configuration f72912f
  - [x] Initialize Next.js App Router application with TypeScript and Tailwind CSS
  - [x] Configure Lucide Icons and base UI utility helpers
  - [x] Configure Vitest testing environment and test helpers
  - *Note: Refinement e4a456e added the missing `@vitest/coverage-v8` provider and an `npm run test:coverage` script.*
- [x] Task: Drizzle ORM Schema & Database Persistence (TDD) b796b69
  - [x] Write unit tests for schema models, relationships, and validation constraints
  - [x] Define Drizzle schema for cooperatives, kitchens, farmers, commodities, deliveries, delivery items, and proof of delivery
  - [x] Configure SQLite database client, connection pool, and Drizzle Kit migrations
  - [x] Implement database seed script with realistic Indonesian village cooperative and SPPG kitchen data
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) b796b69

## Phase 2: Role Management & Layout Navigation [checkpoint: 02067de]
- [x] Task: Role-Based Persona Switcher & Session Layer (TDD) 02067de
  - [x] Write unit tests for role validation and session helpers
  - [x] Implement typed session context and demo persona switcher (Koperasi Admin, SPPG Staff, Public Observer)
  - [x] Build responsive layout header and navigation customized by active role
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 02067de

## Phase 3: Cooperative Dispatch Management & QR Delivery Pass [checkpoint: 2648c18]
- [x] Task: Farmer Commodity Procurement & Fair Price Checker (TDD) 5f5b6f2
  - [x] Write unit tests for commodity procurement calculations and benchmark comparison
  - [x] Implement UI and Server Actions for recording local farmer produce and comparing with benchmark rates
- [x] Task: Delivery Dispatch Order Creation & QR Delivery Pass (TDD) 2648c18
  - [x] Write tests for delivery dispatch validation and QR token generation
  - [x] Implement delivery order creation form with SPPG kitchen selector and item picker
  - [x] Implement digital delivery pass view (*Surat Jalan Digital*) with QR code and print/share support
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 2648c18

## Phase 4: SPPG Mobile Receiving, QR Scanning & Photo Verification [checkpoint: 829687f]
- [x] Task: In-Browser QR Scanner & Receiving Interface (TDD) 02527f3
  - [x] Write unit tests for delivery verification state transitions and payload validation
  - [x] Build mobile-first receiving screen with camera QR code scanner and manual code fallback
  - [x] Implement item inspection checklist and quantity verification
- [x] Task: Proof-of-Delivery Photo Capture & Receipt Sign-off (TDD) 829687f
  - [x] Write tests for Proof-of-Delivery photo upload handler and verification actions
  - [x] Implement client-side photo capture/compression and receiver digital signature
  - [x] Complete delivery status transition to `VERIFIED` and generate immutable delivery confirmation receipt
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 829687f

## Phase 5: Public Transparency Dashboard & E2E Validation
- [ ] Task: Public Transparency Dashboard & Metrics (TDD)
  - [ ] Write tests for aggregated transparency queries (total local produce absorbed, funds channeled to village cooperatives)
  - [ ] Build public landing page showing live KPI cards, commodity distribution charts, and verified delivery timeline
- [ ] Task: End-to-End Workflow Verification & Quality Gate Audit
  - [ ] Write end-to-end integration test covering complete dispatch-to-verification-to-public lifecycle
  - [ ] Verify mobile viewport responsiveness, run linter, and ensure >80% test coverage across all modules
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
