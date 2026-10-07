# Harmony Auxiliary UI/UX Design

## 1. Design Direction

> **Updated in Task 6 — this supersedes the earlier "Apple-inspired light minimalist" direction below.** Sections still describing a light theme, system-blue accent, or "no glassmorphism / no gradients" are historical; the current identity is the dark, ivory, luxury-editorial system described here and in §5.

The finalized visual direction is:

> **Black space + ivory-white forms — a luxury, gallery-editorial music workspace.**

A warm, painterly near-black is the stage: unformed ideas, blankness, the unknown. Ivory-white materials (white lily, porcelain, silk ribbon, draped cloth) are how ideas *take shape* — soft but structured, a "digital form" between art and product. The aesthetic should feel like a high-end fashion / jewellery house (Hermès, Celine, Aesop): black, monochrome, generous whitespace, restrained, editorial — not a generic SaaS site, not a tech-neon dark mode.

The core aesthetic is:

- Black, painterly, layered (never flat pure black or pure-white).
- Near-monochrome: black + warm ivory / pearl white; emphasis reads as a *brighter white*, not a colour.
- Generous whitespace; content floats on the void, divided by hairlines, not boxed in cards.
- Editorial display serif (Cormorant) for headings; clean sans for UI; mono for music data.
- Quiet, precise, durable — the design supports listening and comparing, never competes with the music.

Two intensities (the "stage vs workbench" rule):

- **Stage** (landing, empty states, modals, hero): full painterly black, dramatic, atmospheric.
- **Workbench** (piano roll, inspector, dense controls): calmer charcoal + high-contrast ivory, legibility first (WCAG AA).

## 2. Product Register

This is primarily product UI. Design serves the task.

The deployed app now has two surfaces:

- English-only public landing page.
- Bilingual creative workspace.

The landing page should be short and product-specific. It introduces the tool, shows a workspace preview, and sends users into the app. It should not become a long SaaS marketing site.

The workspace remains the product center:

- Import or enter melody.
- Generate harmony.
- Audition candidates.
- Inspect explanations.
- Export results.

## 3. Design Principles

### 3.1 Audio First

The interface should keep playback controls visible and easy to reach. Harmony quality is judged by hearing first, then by theory labels.

### 3.2 Timeline as the Center

The main visual anchor is the music timeline:

- Melody notes.
- Harmony blocks.
- Playback position.
- Candidate comparison.

Everything else supports the timeline.

### 3.3 Explanations Beside the Work

Theory explanations should live in an inspector-style side panel. They should feel like properties of the current musical selection, not separate documentation.

### 3.4 Minimal, Not Empty

The UI should be quiet but information-rich. It should use alignment, spacing, type scale, and subtle color to create hierarchy.

### 3.5 Controlled Atmosphere (updated in Task 6)

The dark identity uses deliberate, restrained atmosphere — but never kitsch:

- Allowed: a painterly single-light radial wash, edge vignette, a faint static SVG film grain ("canvas tooth"), and a **smoked-glass system** (`backdrop-filter`) for the floating nav, login, and project drawer.
- Allowed: the FloatingLines generative hero (ivory/pearl lines on black).
- Still avoid: paper/ink texture, medieval/fantasy ornament, neon tech-glow, rainbow gradients, generic SaaS card grids, and **champagne/brass gold** (reads cheap — emphasis is monochrome).

## 4. Layout

### 4.0 Landing Page (redesigned in Task 6 — see TASK6.md §9)

The landing is a multi-screen, scroll-snapped editorial sequence, English-only, on the black/ivory system. Narrative: hook → let-me-try → who-it's-for → what-it-does → act.

- **Floating frosted-glass capsule nav** (smoked dark glass, hairline edge), floats over content and follows scroll.
- **Screen 1 — Hero**: full-viewport (100dvh) interactive **FloatingLines** field (ivory/pearl lines on black), Cormorant "Harmony, heard." title over the dark left, sans subtitle + middle-dot tagline + CTAs.
- **Screen 2 — Try it**: a simplified harmony-generation demo wired to the **real engine**, with **audition** (play the result).
- **Screen 3 — Who it's for**: a responsive **bento** of target users (composers, content creators, students), defined by whitespace + hairlines, not filled cards.
- **Screen 4 — Core features**: the React Bits **Carousel** (DOM / Framer Motion) of feature cards (icon + title + description).
- **Screen 5 — CTA**: Cormorant headline + one ivory primary button, a calm closing stage.

Avoid: pricing blocks, decorative unrelated illustrations, generic feature-card grids, Chinese landing copy. (Account prompts ARE allowed now — login is a soft gate, see PRD.)

### 4.1 Desktop Workspace

Recommended desktop structure:

```text
+------------------------------------------------------------------------------+
| Command Bar                                                                  |
| Import MIDI | Key | Mode | Tempo | Meter | Density | Generate | Play Controls |
+------------------------------+-----------------------------------------------+
| Main Timeline Canvas          | Inspector                                     |
|                              |                                               |
| Melody Lane                  | Selected Chord                                |
| Chord Lane                   | Roman / Function                              |
| Playback Cursor              | Melody Relationship                           |
| Candidate Comparison         | Explanation                                   |
|                              | Export / Copy                                 |
+------------------------------+-----------------------------------------------+
```

> **Task 6 — expert workspace rework (see TASK6.md §10):** the piano roll becomes the maximized hero of the workspace; other information appears **on interaction** — the inspector slides out as a side-sheet/popover when a chord/note is selected, transport becomes a slim floating bottom bar, and candidates become a compact switcher. Guided mode keeps its step flow but shares the same enlarged, beautified piano roll (§10.5).

### 4.2 Command Bar

The command bar is compact and persistent.

Contents:

- Product name or compact mark.
- MIDI import button.
- Manual input toggle.
- Key selector.
- Mode selector.
- Tempo input.
- Time signature selector.
- Harmony density selector.
- Generate button.
- Play / pause.
- Restart.
- Melody mute.
- Harmony mute.

Behavior:

- Generate is visually primary.
- Playback controls remain visible after scrolling if the layout ever scrolls.
- Inputs use compact native-feeling controls.

### 4.3 Timeline Canvas

The timeline canvas is the main workspace.

Lanes:

- Melody lane: imported or manually entered notes.
- Chord lane: selected candidate's chord sequence.
- Candidate lanes: A/B/C comparison strips.

Required states:

- Empty state.
- Imported MIDI state.
- Generated candidates state.
- Selected chord state.
- Playback state.
- Error state for unsupported or unreadable MIDI.

### 4.4 Inspector

The inspector displays details for the selected chord, segment, or candidate.

Sections:

- Current chord symbol.
- Roman numeral.
- Function label.
- Melody relationship.
- Short explanation.
- Candidate-level summary.
- Export controls.

The inspector should not feel like a card stack. It should use grouped rows, clear labels, and quiet separators.

### 4.5 Manual Input Surface

Manual input should appear inline, not as a modal by default.

Recommended structure:

- A compact note-name grid or simple piano strip.
- Duration selector.
- Append / undo controls.
- Preview of entered notes in the melody lane.

## 5. Visual System

### 5.1 Color Strategy (Task 6 — black + ivory, no gold)

Near-monochrome. Emphasis is a *brighter white*, not a hue:

- Black space: warm, layered near-black (void / bg / surface), never pure black.
- Ivory-white materials: warm ivory text + brighter pearl for highlights.
- Emphasis / selection / focus / primary action: bright pearl-ivory (a value, not a colour).
- Harmony function coding stays monochrome: T = ivory, PD = dim ivory, D = a whisper of cool platinum.
- Error: a muted dusty rose, never a loud red.

Avoid: pure black, champagne/brass gold (reads cheap), saturated accents, large saturated surfaces, any colour that overpowers chord readability.

### 5.2 Suggested Tokens (current implementation values)

```css
:root {
  /* Black space — warm, layered, never pure black */
  --color-void: oklch(0.1 0.012 70);
  --color-bg: oklch(0.15 0.012 70);
  --color-surface: oklch(0.195 0.012 70);
  --color-surface-raised: oklch(0.235 0.014 70);
  --color-border: oklch(0.32 0.012 70);
  --color-hairline: oklch(0.26 0.01 70);
  /* Ivory-white materials */
  --color-text: oklch(0.94 0.012 85);
  --color-text-muted: oklch(0.72 0.012 85);
  --color-ivory: oklch(0.96 0.014 85);
  --color-ivory-dim: oklch(0.82 0.012 85);
  /* Emphasis — pearl/ivory, NO gold */
  --color-accent: oklch(0.94 0.006 90);
  --color-accent-strong: oklch(0.86 0.006 90);
  --color-accent-soft: oklch(0.4 0.005 90);
  --color-stable: oklch(0.94 0.008 90);   /* T */
  --color-tension: oklch(0.96 0.005 235);  /* D — cool platinum whisper */
  --color-danger: oklch(0.62 0.08 25);     /* muted dusty rose */
  --color-focus: oklch(0.93 0.012 95);     /* pale ivory focus ring */
}
```

### 5.3 Typography (Task 6 — three tiers)

Display serif (headings, hero, gallery labels):

- **Cormorant Garamond** (self-hosted via `@fontsource`), light weights (300–500), wide tracking — the editorial, gallery-print voice.

Primary UI font (controls, body):

- system-ui / Inter / SF Pro equivalent.

Music and timing font:

- IBM Plex Mono or similar technical mono (chord symbols, beats, note names).

Recommended hierarchy:

- App title: 18-22px, semibold.
- Toolbar labels: 12-13px, medium.
- Body: 14-15px.
- Chord symbol in timeline: 16-18px, semibold.
- Selected chord in inspector: 32-40px, semibold.
- Roman numeral / function: 13-15px, medium.
- Explanation: 14-15px, regular, max 65ch.

Avoid decorative music fonts in the MVP. They reduce scan speed.

### 5.4 Spacing

Use consistent but not monotonous spacing:

- 4px: tiny internal gaps.
- 8px: compact controls.
- 12px: toolbar groups.
- 16px: panel padding.
- 24px: major workspace gaps.
- 32px: high-level vertical rhythm.

The timeline should receive the largest share of the viewport.

### 5.5 Shape and Elevation (Task 6 — de-boxed / editorial)

Content floats on the void, divided by hairlines and whitespace — not boxed in cards.

Recommended:

- Sharpened radii (≈5–10px) only where a surface is unavoidable (inputs, buttons, glass panels).
- **No panel chrome**: inspector, candidates, banners, the guided coach, and the toolbar use hairline rules + generous whitespace, not borders + fills.
- Dark-scene elevation: deep cast shadow + a faint top highlight; the smoked-glass system for floating nav / login / drawer.
- Clear pale-ivory focus rings.

Avoid: thick rounded cards, nested cards (box-in-box), heavy drop shadows, double framing on the piano roll.

## 6. Component Design

### 6.1 Buttons

Use icon buttons for direct tools:

- Play.
- Pause.
- Restart.
- Mute melody.
- Mute harmony.
- Upload.
- Export.

Use text buttons for commands that need clarity:

- Generate Harmony.
- Copy Progression.
- Export MIDI.

States:

- Default.
- Hover.
- Active.
- Disabled.
- Loading.
- Focus-visible.

### 6.2 Selectors

Use compact selectors for:

- Key.
- Mode.
- Time signature.
- Harmony density.
- Candidate style.

Do not create large decorative dropdowns.

### 6.3 Timeline Notes

Melody notes:

- Rectangular bars aligned to beats.
- Height can reflect pitch loosely, or pitch can be represented in a piano-roll grid.
- Color should remain quiet.

Chord blocks:

- Larger than melody notes.
- Labeled with chord symbol and Roman numeral.
- Selected chord uses accent border and soft accent background.
- Function can be represented with a small label or dot.

### 6.4 Candidate Strips

Candidate strips should not look like generic cards.

Recommended structure:

- Horizontal strip.
- Candidate name.
- Compact chord sequence.
- Small play button.
- Score or confidence indicator if available.

Candidate names:

- Stable Classical.
- Pop / Songwriting.
- Color / Tension.

### 6.5 Inspector Rows

Use label-value rows:

- Chord: Cmaj7.
- Roman: Imaj7.
- Function: Tonic.
- Melody: E = third.

Explanation text appears below these rows.

### 6.6 Empty State

The empty state should invite action without becoming a landing page.

Suggested content:

- Primary action: Import MIDI.
- Secondary action: Enter Notes.
- Small example action: Load Demo Melody.

Avoid explanatory paragraphs. Keep it task-first.

## 7. Interaction Design

### 7.1 Generation Flow

1. User imports MIDI or enters notes.
2. User sets key, tempo, meter, and density.
3. Generate button becomes available.
4. System shows loading state in candidate area.
5. Three candidates appear.
6. First candidate is selected by default.
7. User can play, compare, inspect, and export.

### 7.2 Playback

Playback should update:

- Timeline cursor.
- Current bar/beat label.
- Current chord selection.
- Piano-key highlights if present.

Audio start must be triggered by user action because browsers require user interaction before starting audio.

### 7.3 Selection

Selectable elements:

- Note bars.
- Chord blocks.
- Candidate strips.
- Timeline segments.

Selecting a chord updates the inspector.

### 7.4 Editing

MVP editing should be conservative:

- Replace chord from a small list of alternatives.
- Change candidate selection.
- Change generation settings and regenerate.

Do not add a full piano-roll editor in MVP.

## 8. Responsive Behavior

### Desktop

Primary target.

Recommended minimum comfortable width:

- 1280px.

Layout:

- Command bar top.
- Timeline canvas center.
- Inspector right.

### Tablet

Supported but secondary.

Layout:

- Command bar wraps into two rows if needed.
- Inspector moves below the timeline or becomes a bottom sheet.

### Mobile

MVP should be usable for preview and simple manual input, but not optimized as the primary creation surface.

Layout:

- Vertical stack.
- Timeline becomes horizontally scrollable.
- Inspector appears below selected segment.
- Advanced controls can collapse.
- Landing page hero stacks vertically with the product preview below the copy.
- Workspace command controls become compact rows.
- Candidate strip becomes a single-column list.
- Export and alternative chord actions remain reachable without horizontal page overflow.
- Minimum practical viewport target: 360px width.

## 9. Accessibility

Requirements:

- Keyboard reachable controls.
- Visible focus states.
- Contrast-safe text and controls.
- Buttons must have accessible labels.
- Playback state must not rely on color alone.
- Candidate identity must not rely on color alone.
- File import errors must be textual and clear.

Keyboard shortcuts can be added after MVP:

- Space: play / pause.
- R: restart.
- G: generate.
- 1/2/3: select candidate.

## 10. Motion

Motion should be subtle and functional.

Allowed:

- Playback cursor movement.
- Candidate generation fade-in.
- Control hover transitions.
- Inspector content crossfade on selection.

Avoid:

- Decorative page animations.
- Bounce or elastic motion.
- Layout-shifting animations.

Use short ease-out transitions.

## 11. Copy and Language

Recommended workspace language:

- UI labels support Chinese and English.
- Chinese is acceptable as the default workspace language for early users.
- English remains available for standard music workflows and future public sharing.
- Chord symbols, Roman numerals, MIDI filenames, exported filenames, and track names remain unchanged.
- Workspace helper copy and error/status messages follow the active workspace language.

Landing page language:

- English-only.
- No language switcher is needed.
- Keep copy compact and concrete.

This keeps the product friendly to Chinese-speaking users while preserving standard theory notation and a public English entry point.

## 12. Final Decisions (updated in Task 6)

- Visual direction: **black space + ivory-white forms — luxury, gallery-editorial** music workspace.
- Theme: **dark**, warm painterly near-black; near-monochrome black + ivory/pearl, **no gold**.
- Surface style: **de-boxed** — hairlines + whitespace, sharpened radii, smoked-glass for floating nav / login / drawer.
- Type: Cormorant display serif + UI sans + technical mono.
- Hero: interactive **FloatingLines** generative field (replaces the still-life photo).
- Landing: multi-screen scroll-snapped sequence (glass nav · FloatingLines hero · live demo · bento · carousel · CTA); English-only.
- Workspace: piano roll maximized; information on interaction; guided + expert share the same roll.
- Public entry: English landing → **soft-gate login** (workspace requires sign-in; "ask for a demo" sandbox); workspace language Chinese / English toggle.
- Main interaction: listen, compare, inspect, export.
- Desktop-first, with tablet/mobile adaptation.
