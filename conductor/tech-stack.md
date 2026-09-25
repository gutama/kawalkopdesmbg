# Technology Stack: KawalKopdesMBG

## Core Architecture
- **Paradigm:** Full-stack TypeScript web application with Next.js App Router.
- **Client Strategy:** Mobile-first responsive web app (PWA ready), optimized for low-bandwidth rural mobile networks.
- **Server Strategy:** Unified Next.js API Routes and Server Actions for lean, single-codebase deployment.

## Languages & Frameworks
- **Primary Language:** TypeScript (strict mode enabled across client, server, and database schemas).
- **Web & Backend Framework:** Next.js (App Router, Server Actions, Route Handlers).
- **UI & Styling:** React 19, Tailwind CSS, Shadcn UI (accessible Radix UI primitives), Lucide Icons.
- **Data Visualization & Dashboards:** Recharts for public meal delivery and commodity absorption analytics.

## Data & Storage Layer
- **Database Engine:** SQLite / LibSQL (self-contained, zero-ops relational database; embeddable locally or distributed via Turso).
- **ORM / Query Builder:** Drizzle ORM (type-safe, lightweight SQL-like syntax tailored for SQLite).
- **Migrations:** Drizzle Kit for schema migrations and prototyping.
- **Media & Photo Storage:** Pluggable storage adapter (local filesystem for development, S3-compatible bucket like Cloudflare R2/MinIO for production Proof-of-Delivery photos).

## Peripheral & Client Capabilities
- **QR Code Scanning & Generation:** `html5-qrcode` for responsive in-browser camera scanning; `qrcode` for delivery pass generation.
- **Offline & Local Caching:** LocalStorage / IndexedDB for draft caching and form resilience on unstable field connections.

## Quality Assurance & Tooling
- **Package Manager:** `npm` / `pnpm`.
- **Testing:** Vitest for unit & integration testing, Playwright for E2E delivery flows.
- **Linting & Formatting:** ESLint, Prettier, TypeScript compiler (`tsc`).
