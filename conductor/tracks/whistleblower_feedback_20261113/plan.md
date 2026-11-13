# Implementation Plan: Community Whistleblower & Feedback Loop

## Phase 1: Whistleblower Schema, Migration & Seed Data [checkpoint: 62408fa]
- [x] Task: Community Reports Schema & Seed Data (TDD) 62408fa
  - [x] Write unit tests for `community_reports` schema constraints, foreign-key relations, and seed data
  - [x] Define `community_reports` table, enums (`REPORT_CATEGORIES`, `REPORT_SEVERITIES`, `REPORT_STATUSES`), and relations in `src/db/schema.ts`
  - [x] Add SQL migration for `community_reports` in `drizzle/` and update `src/db/migrate.ts`
  - [x] Seed realistic Subang & Banyumas community feedback and whistleblower reports in `src/db/seed.ts`
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 62408fa

## Phase 2: Whistleblower Service, Privacy Masking & Role Permissions [checkpoint: 00efc84]
- [x] Task: Privacy-Safe Report Service & Triage Workflow (TDD) 00efc84
  - [x] Write unit tests for reporter name masking, phone stripping, photo evidence storage, submission validation, and status triage (`BARU` -> `DITINDAKLANJUTI` -> `SELESAI`)
  - [x] Update `src/lib/session.ts` with `SUBMIT_REPORT` and `TRIAGE_REPORT` role permissions and `/laporan` navigation links
  - [x] Implement `src/lib/whistleblower.ts` (`submitCommunityReport`, `triageCommunityReport`, `getPublicWhistleblowerSnapshot`, `filterWhistleblowerReports`, `maskReporterIdentity`, `compressAndStoreReportPhoto`)
- [x] Task: Phase Verification & Checkpoint (Refer to workflow.md) 00efc84

## Phase 3: Community Whistleblower Portal (`/laporan`) & Public Dashboard Integration
- [x] Task: Community Reporting Portal UI, Triage Panel & Delivery Card Integration (TDD) ae8f19c
  - [x] Write component & integration tests for `/laporan` submission form, filterable report feed, role-aware triage modal, and quick-report links from public delivery cards
  - [x] Implement Server Actions in `src/app/laporan/actions.ts` and build `src/components/whistleblower-portal.tsx` + `src/app/laporan/page.tsx`
  - [x] Add inline 'Laporkan Kendala' quick-action link on delivery cards in `src/components/public-transparency-dashboard.tsx` and summary metrics on the home page
- [ ] Task: End-to-End Whistleblower Lifecycle Verification & Quality Gate Audit
  - [ ] Write end-to-end integration test covering report submission -> public masked feed -> Koperasi/SPPG triage -> resolution verification
  - [ ] Run linter, type-check, and full test suite to verify >80% coverage
- [ ] Task: Phase Verification & Checkpoint (Refer to workflow.md)
