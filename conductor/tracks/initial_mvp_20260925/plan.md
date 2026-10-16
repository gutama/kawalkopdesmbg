# Implementation Plan: Initial MVP for KawalKopdesMBG

## Phase 1: Project Scaffolding & Database Layer
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
- [~] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 2: Role Management & Layout Navigation
- [ ] Task: Role-Based Persona Switcher & Session Layer (TDD)
  - [ ] Write unit tests for role validation and session helpers
  - [ ] Implement typed session context and demo persona switcher (Koperasi Admin, SPPG Staff, Public Observer)
  - [ ] Build responsive layout header and navigation customized by active role
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 3: Cooperative Dispatch Management & QR Delivery Pass
- [ ] Task: Farmer Commodity Procurement & Fair Price Checker (TDD)
  - [ ] Write unit tests for commodity procurement calculations and benchmark comparison
  - [ ] Implement UI and Server Actions for recording local farmer produce and comparing with benchmark rates
- [ ] Task: Delivery Dispatch Order Creation & QR Delivery Pass (TDD)
  - [ ] Write tests for delivery dispatch validation and QR token generation
  - [ ] Implement delivery order creation form with SPPG kitchen selector and item picker
  - [ ] Implement digital delivery pass view (*Surat Jalan Digital*) with QR code and print/share support
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 4: SPPG Mobile Receiving, QR Scanning & Photo Verification
- [ ] Task: In-Browser QR Scanner & Receiving Interface (TDD)
  - [ ] Write unit tests for delivery verification state transitions and payload validation
  - [ ] Build mobile-first receiving screen with camera QR code scanner and manual code fallback
  - [ ] Implement item inspection checklist and quantity verification
- [ ] Task: Proof-of-Delivery Photo Capture & Receipt Sign-off (TDD)
  - [ ] Write tests for Proof-of-Delivery photo upload handler and verification actions
  - [ ] Implement client-side photo capture/compression and receiver digital signature
  - [ ] Complete delivery status transition to `VERIFIED` and generate immutable delivery confirmation receipt
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)

## Phase 5: Public Transparency Dashboard & E2E Validation
- [ ] Task: Public Transparency Dashboard & Metrics (TDD)
  - [ ] Write tests for aggregated transparency queries (total local produce absorbed, funds channeled to village cooperatives)
  - [ ] Build public landing page showing live KPI cards, commodity distribution charts, and verified delivery timeline
- [ ] Task: End-to-End Workflow Verification & Quality Gate Audit
  - [ ] Write end-to-end integration test covering complete dispatch-to-verification-to-public lifecycle
  - [ ] Verify mobile viewport responsiveness, run linter, and ensure >80% test coverage across all modules
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
