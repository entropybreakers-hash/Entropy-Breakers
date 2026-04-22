# Entropy Breakers — Project Notes

Entry point: `index.html` at the repo root. All module HTMLs live at root too. Static site, deployed to `academy.entropybreakers.com` via GitHub Pages (`CNAME`).

Shared UI/logic library: `assets/eb-*` (progress tracking, theme, catalog). Every module HTML includes them. New module HTML must include:

```html
<link rel="stylesheet" href="assets/eb-theme.css">
<script src="assets/eb-progress.js" defer></script>
<script src="assets/eb-catalog.js" defer></script>
```

`apply-progress.sh` is an idempotent injector for batch-adding the tags to legacy HTML files.

## Design preferences — Bettina / Entropy Breakers

Minden új felületet, komponenst, oldalt a következő dizájn-elveknek megfelelően készíts.

### Tipográfia (a dizájn 80%-a)
- Display / headline: **Cormorant Garamond** (Google Fonts, 500–600 weight, italic opcionális) VAGY **Fraunces** ha modernebb serif kell
- Body / UI: **DM Sans** (300–700 weight) VAGY **Inter** ha tech-orientáltabb
- Szám / mono / kód: **JetBrains Mono** vagy **IBM Plex Mono**
- Hierarchia: 3–4 jól megkülönböztetett méret, nem 10
- letter-spacing: small caps / labelnél +0.15em…+0.25em, title-nél −0.01em…−0.02em
- Line-height: body 1.5–1.7, display 0.96–1.15

### Szín — max 3
- Mély fekete / krém: `#0a0806` VAGY `#faf8f3` (egyik bg, másik szöveg)
- Egy accent, telt és határozott, következetesen (nem 5 félét)
- Brand accent: élénk narancs `#ff7a2e`, sötétebb `#d14a00`
- Soha: pasztell árnyalatok, 3+ accent, minden elem más-más színben

### Háttér
- Mély fekete (`#000` vagy `#0a0806`) — NINCS gradient, kivéve explicit kérés
- Krém (`#faf8f3`) — tiszta, alig-alig textúra
- Narancs gradient CSAK akcentként (gomb, chip, hero) — sosem full-screen

### Whitespace
- Generózus. Ha kétséges, több tér.
- Apple / Stripe / Vercel-szintű lélegzés
- Max 3–4 elem egy fold-ban (scroll OK)
- Padding min 24–32px desktop, 20–24px mobile

### Animáció
- Entrance: fontos elemek fade-up, 400–600ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`
- Hover: 3–4px Y-emelkedés + enyhe shadow: `box-shadow: 0 14px 36px rgba(0,0,0,0.12)`
- Page-transition: fade (200–300ms), nem slide
- Átmenetek: `cubic-bezier(0.2, 0.8, 0.2, 1)` vagy `cubic-bezier(0.34, 1.56, 0.64, 1)` (bounce gombokhoz)
- Soha: bouncy / overt / "look at me" animáció

### Komponens-sarkok
- Kártya / card: `border-radius: 12–16px`
- Input / button: 12–16px
- Chip / pill: `border-radius: 999px`
- Soha: 20px+ radius komponenseken (babyseat feel)

### Kontraszt / árnyék
- Shadow subtle: `0 8px 20px rgba(0,0,0,0.08)`
- Shadow large (hero, modal): `0 20px 60px rgba(0,0,0,0.35)`
- Border: `1px solid rgba(0,0,0,0.06)` vagy `rgba(255,255,255,0.08)`
- Hairline divider — nem vastag

### Gombok
- Primary: accent bg, fehér szöveg, pill radius, subtle shadow glow
- Secondary: outline, border-color accent
- Ghost: csak text, hover state accent
- Font weight 500–600 (nem extra bold)
- Letter-spacing 0.15–0.22em, uppercase opcionális
- Padding 14–18px × 28–40px

### Mobil-first
- Mobilról indul (420–480px app-shell)
- Laptop-on szélesebb max-width (880–1040px), grid (nem folyékony)
- Desktop: több oszlop (2–4) ott ahol mobilon 1

### Ikonok
- Inline SVG (nem font-awesome)
- Stroke-based, 2px stroke, round linecap/linejoin
- Accent vagy ink szín
- Mértékkel — a tipográfia elsőbbsége marad

### Kódstruktúra
- CSS változók a `:root`-ban (color, radius, shadow, ease)
- Modern flexbox/grid, nem float
- `.eb-*` prefixelt class library jellegű részeknél
- CSS reset minden felületen: margin/padding 0, box-sizing border-box, tap-highlight transparent

### Referenciák
- **Linear** (linear.app) — sötét, elegáns, visszafogott gradient
- **Stripe** (stripe.com) — minimal, tipográfia, tiszta
- **Vercel** (vercel.com) — editorial, fekete/fehér, mono accent
- **Apple** — whitespace master
- **Raycast** — mac-native precíz feel
- **Framer** — modern product design

### NEM (soha, kivéve explicit kérés)
- Agresszív gamification ("Level UP!", badges, XP)
- Gradient minden bg-n
- Fun fontok (Comic Sans, Marker Felt, Lobster)
- 3+ accent color
- Bootstrap-szerű alapértelmezett kék gombok
- Túlzó emoji az UI-ban
- Sticker / illustration-központú dizájn (tipográfia + forma helyett)
