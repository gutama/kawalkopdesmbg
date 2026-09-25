# Product Guidelines: KawalKopdesMBG

## Brand Identity & Values
- **Core Mission:** Empowering local village cooperatives and farmers through open data, fair trade, and radical transparency in the Makan Bergizi Gratis (MBG) program.
- **Values:** Gotong royong (mutual cooperation), transparency (keterbukaan), fairness (keadilan harga bagi petani lokal), and accountability (pertanggungjawaban publik).

## Voice & Tone
- **Voice:** Warm, friendly, accessible, and community-centric (*santai, komunikatif, dan bersahabat*).
- **Tone Principles:**
  - **Gotong Royong & Inklusif:** Speak directly to village farmers, cooperative workers, and parents as valued partners. Avoid cold, intimidating legalistic or bureaucratic jargon.
  - **Lugas & Jelas:** Use clear, straightforward Bahasa Indonesia that is easily understood across all educational backgrounds.
  - **Transparan & Membangun Rasa Percaya:** Data statuses, audit logs, and delivery confirmations must be presented clearly, constructively, and without ambiguity.
  - **Pemberi Solusi:** When errors or discrepancies occur, offer constructive, friendly recovery steps (e.g., *"Foto kurang jelas, yuk ulangi sekali lagi"* or *"Data pengiriman berhasil dicatat!"*).

## Language & Localization
- **User-Facing UI:** Primary Bahasa Indonesia for all public dashboards, cooperative portals, receiving verification screens, and notifications.
- **Technical & Developer Domain:** English is preserved for system code, database schemas, commits, and developer API documentation.

## Visual Identity & Design System
- **Color Palette:**
  - **Primary:** Forest / Emerald Green (`#059669` / `#047857`) – symbol of agricultural prosperity, fresh nutritious food, and growth.
  - **Secondary:** Warm Harvest Gold / Amber (`#D97706` / `#F59E0B`) – representing village harvests, warmth, and vitality.
  - **Neutral / Background:** Crisp warm whites, stone neutrals (`#F9FAFB`, `#F3F4F6`), and deep slate text (`#1F2937`) ensuring high contrast and outdoor readability.
  - **Semantic Accents:**
    - Success / Verified: Fresh Leaf Green (`#10B981`)
    - Pending / In Transit: Warm Amber (`#F59E0B`)
    - Alert / Discrepancy: Crimson Coral (`#EF4444`)
- **Typography:**
  - High-legibility modern sans-serif (e.g., Inter, Plus Jakarta Sans, or system fonts) with robust readability under direct sunlight and on small mobile screens.

## UX & Accessibility Principles
- **Mobile-First & Rural-Optimized:**
  - Prioritize handheld mobile experiences for cooperative field workers and kitchen receiving staff.
  - Generous tap targets (minimum 48x48px) and high color contrast for comfortable outdoor and on-the-go usage.
- **Fast QR & Camera Interactions:**
  - Instant one-tap camera scanning for delivery receipts and QR handshake confirmation.
  - Built-in client-side photo compression before upload to conserve mobile bandwidth.
- **Resilient to Unstable Connectivity:**
  - Offline-tolerant forms with local caching so field officers never lose delivery inputs if cellular signal drops.
  - Clear optimistic UI feedback with background syncing.
- **Inclusive Public Dashboards:**
  - Visual charts, digestible summary cards, and simple filters enabling parents and local communities to explore meal delivery stats effortlessly.
