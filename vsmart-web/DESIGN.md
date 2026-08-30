---
name: Vsmart Tracking
description: Real-time vehicle tracking and anti-theft dashboard — a calm, muted-indigo SaaS system with unified light and dark modes
colors:
  surface-light: "#f6f7f9"
  surface-dark: "#16161b"
  card-light: "#ffffff"
  card-dark: "#222229"
  card-muted-light: "#eceef2"
  card-muted-dark: "#2d2d35"
  ink-light: "#202124"
  ink-dark: "#f3f3f5"
  muted-light: "#687080"
  muted-dark: "#a4a4af"
  subtle-light: "#9a9fac"
  subtle-dark: "#6f707c"
  hairline-light: "#dfe2e8"
  hairline-dark: "#3a3a44"
  brand-500: "#6664d8"
  brand-400: "#8d8ae8"
typography:
  sans:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
  eyebrow:
    fontFamily: "{typography.mono.fontFamily}"
    fontSize: "0.625rem"
    letterSpacing: "0.17em"
    textTransform: "uppercase"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.brand-500}"
    backgroundColorDark: "{colors.brand-400}"
    textColor: "#ffffff"
    textColorDark: "#16161b"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.card-light}"
    backgroundColorDark: "{colors.card-dark}"
    border: "1px solid {colors.hairline-light}"
    borderDark: "1px solid {colors.hairline-dark}"
    rounded: "{rounded.lg}"
    shadow: "0 14px 44px rgba(31,35,44,0.08)"
    shadowDark: "0 16px 50px rgba(0,0,0,0.24)"
---

# Design System: Vsmart Tracking

## Overview

**Canonical direction: "Calm Muted-Indigo SaaS"**

This is the approved, unified system for the web dashboard, implemented across every screen (marketing landing page, auth, sidebar/header shell, dashboard, device management, geofences, map overlays). It replaces an earlier dark-only "Night Watch Console" exploration that the product owner reviewed and rejected (color, layout, and typography all read as "off"). The current system is derived from the user's own reference project (`archflow-app`): soft, low-saturation surfaces, one muted-indigo accent, mono eyebrow labels, and diffused shadows instead of hard borders or glows.

**Key characteristics:**
- Every screen supports both **light and dark mode**, switched by toggling a `dark` class on `<html>` (Tailwind `darkMode: 'class'`), controlled by `useTheme()` (`src/hooks/useTheme.jsx`) and persisted to `localStorage` under `vsmart-theme`. Initial theme resolves from stored preference, falling back to `prefers-color-scheme`.
- One accent hue (muted indigo) carries brand and interactive weight in both modes; semantic colors (emerald = success/online/protected, rose = danger/breach/offline, amber = warning/maintenance, blue = informational) are reserved for status, never used decoratively.
- Cards and panels are distinguished by a soft diffused shadow plus a hairline border — not by strong contrast blocks.
- The live map is the product's visual anchor (dashboard mini-map, full map view, auth branding panel) and itself switches basemap style between AWS Location Service's `Light`/`Dark` color-scheme in sync with the UI theme.

## Colors

### Surfaces
- **Surface** — page background: `#f6f7f9` light / `#16161b` dark (Tailwind `bg-surface` / `dark:bg-surface-dark`)
- **Card** — panel/card background: `#ffffff` light / `#222229` dark (`bg-card` / `dark:bg-card-dark`)
- **Card Muted** — sunken well inside a card (progress tracks, input fills): `#eceef2` light / `#2d2d35` dark (`bg-card-muted` / `dark:bg-card-muted-dark`)
- **Hairline** — all card/input/divider borders: `#dfe2e8` light / `#3a3a44` dark (`border-hairline` / `dark:border-hairline-dark`)

### Text
- **Ink** — primary text: `#202124` light / `#f3f3f5` dark (`text-ink` / `dark:text-ink-dark`)
- **Muted** — secondary text: `#687080` light / `#a4a4af` dark (`text-muted` / `dark:text-muted-dark`)
- **Subtle** — tertiary/placeholder text: `#9a9fac` light / `#6f707c` dark (`text-subtle` / `dark:text-subtle-dark`)

### Brand accent
- **Brand 500** (`#6664d8`) — primary interactive color in light mode: buttons, active nav state, links, focus rings.
- **Brand 400** (`#8d8ae8`) — primary interactive color in dark mode (lighter for contrast against dark surfaces).
- Full `brand-50`…`brand-900` scale defined in `tailwind.config.js` for tints (e.g. `bg-brand-50 dark:bg-brand-400/10` for soft icon tiles).

### Semantic status (used consistently, never decoratively)
- **Emerald** (`emerald-500/600` light, `emerald-400` dark) — active/online/protected/success.
- **Rose** (`rose-500/600` light, `rose-400` dark) — danger/breach/offline/delete.
- **Amber** (`amber-500/600` light, `amber-400` dark) — warning/maintenance/pending.
- **Blue** (`blue-500/600` light, `blue-400` dark) — informational/edit action.

### Named Rules
**The One Accent Rule.** Muted indigo (`brand-*`) is the only hue used for brand/interactive chrome; emerald/rose/amber/blue are reserved for semantic status and action-type buttons (edit=blue, create=emerald, delete/disable=rose) and never substitute for the brand accent.

### Incidental utility colors
A small set of literal colors outside the palette above are intentional, scoped UI chrome rather than design-system drift: scrollbar track/thumb shades (`#eceef2`/`#c7cad1`/`#a9adb6` light, `#1c1c22`/`#3a3a44`/`#4a4a56` dark) and neutral shadow rgba values for MapLibre control popups (`rgba(0,0,0,0.3-0.4)` dark). These follow the same light/dark pairing discipline as the rest of the system but are not part of the brand/semantic palette, so they are not restated as named tokens.

## Typography

**Sans:** Inter (`ui-sans-serif, system-ui` fallback) — all interface text, headings, and body copy.
**Mono:** IBM Plex Mono — reserved for eyebrow/label text, coordinates, timestamps, and device IDs, echoing the product's "live data readout" identity.

Marketing headlines use `font-semibold` with tight tracking (`tracking-[-0.02em]` to `tracking-[-0.03em]`); UI chrome (nav items, table headers, stat labels) uses uppercase mono or sans at `text-[10px]`–`text-xs` with wide tracking for scannability.

## Dark Mode Implementation

- **Strategy:** Tailwind `darkMode: 'class'`. A `dark` class on `<html>` activates all `dark:` variants app-wide.
- **Toggle:** `src/hooks/ThemeProvider.jsx` provides theme state and `src/hooks/useTheme.js` exposes it. Wrapped around `<App />` in `main.jsx`.
- **Persistence:** `localStorage['vsmart-theme']`, read synchronously in `index.html`'s pre-paint inline script to avoid a flash of the wrong theme before React mounts.
- **Initial value:** stored preference, else `window.matchMedia('(prefers-color-scheme: dark)')`.
- **Map basemap:** AWS Location Service style descriptor URL's `color-scheme` query param (`Light`/`Dark`) is derived from `theme` in every map-rendering component (`App.jsx`, `DashboardView.jsx`, `MapView.jsx`), so the basemap itself switches in sync with the UI shell.
- **Map paint layers:** MapLibre `paint` properties (route lines, geofence fills, markers) are literal hex values, not Tailwind classes, since they render on canvas. These use the brand hex (`#6664d8`) and semantic hex (status colors, `#e11d48` rose for breach) directly and are intentionally the same value in both themes — only the basemap style beneath them switches.
- **Settings page** (`App.jsx`, Settings view) exposes an explicit Light/Dark picker in addition to the Header's toggle button, so theme control has two discoverable entry points.

## Elevation & Depth

Cards and floating panels use a soft, diffused, non-directional shadow (`shadow-panel` / `dark:shadow-panel-dark`, and a stronger `shadow-panel-lg`/`dark:shadow-panel-lg-dark` for modals and floating map overlays) plus a 1px hairline border — never a hard drop shadow or colored glow.

### Named Rules
**The No-Glow Rule.** No colored halos, radial accent washes, or tinted box-shadows. Depth comes from soft neutral shadows plus hairline borders only, in both themes.

## Shapes

- Cards, modals, and large panels: `rounded-2xl`/`rounded-3xl` (16–24px).
- Buttons, inputs, small tiles: `rounded-xl` (12px).
- Status pills, badges, avatars: fully rounded.

## Components

Shared component classes live in `src/index.css` under `@layer components` and already carry `dark:` variants — prefer these over ad-hoc utility strings when a new UI matches the pattern:

- **`.btn-primary`** — brand-filled button. `bg-brand-500` light / `bg-brand-400` dark, white text light / near-black text dark (for contrast against the lighter dark-mode accent).
- **`.btn-secondary`** — outlined/neutral button. Card background, hairline border, ink text.
- **`.btn-danger`** — solid rose button for destructive actions.
- **`.card`** — the standard panel: card background, hairline border, `rounded-2xl`, soft shadow.
- **`.input-field`** — form input: card background (light) / `white/5` translucent fill (dark), hairline border, brand-colored focus ring.

Semantic action buttons that are *not* the brand accent (edit = blue, create = emerald, delete/disable = rose) are literal Tailwind color utilities with `dark:` variants, kept intentionally distinct from `.btn-primary` since they signal a specific action type rather than the primary brand action.

### Floating map panels (Geofences drawing UI, device detail panel, devices overlay)
- **Style:** `bg-card/95 dark:bg-card-dark/95` with `backdrop-blur-md`, hairline border, `shadow-panel-lg`/`dark:shadow-panel-lg-dark`, `rounded-2xl`/`rounded-3xl`.
- These float above the MapLibre canvas and must stay legible over both light and dark basemaps — the translucent card background plus blur ensures contrast regardless of what's underneath.

### Status Pill
- **Style:** pill-shaped, background at ~10% opacity of its status color (`bg-emerald-50 dark:bg-emerald-500/10` etc.), text and icon in the full-strength status color, border at ~20-30% opacity.
- **States:** `active`/`online`/`protected` (emerald), `breach`/`offline`/`disabled` (rose), `maintenance`/`pending` (amber).

## Layout

Marketing sections (`LandingPage.jsx`) run at `max-w-[1180px]` with `py-20`–`py-24` vertical rhythm. App shell content areas use `p-4 md:p-6` padding with `space-y-6` between major blocks. Two-column dashboard grids use `lg:grid-cols-12` with 7/5 or similar splits.

## Do's and Don'ts

### Do:
- **Do** use `.card`/`.btn-primary`/`.btn-secondary`/`.input-field` component classes for new UI before reaching for ad-hoc utility strings.
- **Do** pair every custom color utility with its `dark:` counterpart — there is no light-only or dark-only screen in this system.
- **Do** keep status color strictly semantic (emerald = protected/online, rose = breach/offline, amber = maintenance/warning).
- **Do** derive map basemap `color-scheme` from the active theme wherever a map is rendered.

### Don't:
- **Don't** add colored glows, radial accent washes, or tinted shadows.
- **Don't** introduce a second accent hue — indigo (`brand-*`) is the only brand/interactive color.
- **Don't** reintroduce the old `aws-gray`/`aws-orange`/literal `indigo-600` Tailwind tokens — they have been fully removed from `tailwind.config.js` in favor of the semantic token set (`surface`, `card`, `ink`, `muted`, `subtle`, `hairline`, `brand`).
