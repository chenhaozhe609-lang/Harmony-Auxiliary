# Harmony Auxiliary UI/UX Design

## 1. Design Direction

The finalized visual direction is:

> Apple-inspired minimalist professional music workspace.

Harmony Auxiliary should feel quiet, precise, and durable. The interface should help users listen, compare, and understand harmony without competing with the music. The design should not depend on material effects, fantasy styling, vintage paper, ink texture, or heavy ornament.

The core aesthetic is:

- Minimal.
- Flat.
- Spacious.
- Precise.
- Music-workbench oriented.
- Calm enough for repeated use.

The product should feel closer to a simplified Logic Pro, Apple Notes, Keynote, and a professional theory tool than to a SaaS landing page or a game interface.

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

### 3.5 No Decorative Theme Debt

Avoid visual systems that will age quickly or make every new feature fight the theme:

- No paper texture.
- No ink texture.
- No medieval or fantasy ornament.
- No glassmorphism.
- No large gradients.
- No generic SaaS card grids.

## 4. Layout

### 4.0 Landing Page

The landing page should use the same Apple-inspired minimalist direction, but with more editorial spacing than the workspace.

Required first viewport:

- Product name as the main headline.
- One large slogan or value proposition.
- Primary CTA to enter the workspace.
- Minimal navigation only.
- No workspace preview in the first viewport.

Workflow section below the first viewport:

- Explain the import, generate, inspect, export flow.
- Pair the workflow copy with a product-relevant preview of the timeline, candidates, and inspector.
- Keep the section flat and editorial, not a repeated SaaS feature-card grid.

Avoid:

- Pricing blocks.
- Account creation prompts.
- Decorative hero illustrations unrelated to the product.
- Generic feature-card grids.
- Landing copy in Chinese.

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

### 5.1 Color Strategy

Use a restrained color strategy:

- Tinted neutrals dominate the surface.
- One main accent handles selection and action.
- A few semantic colors support musical state.

Suggested roles:

- App background: warm system off-white.
- Surface background: near-white.
- Subtle surface: pale cool gray.
- Primary text: soft near-black.
- Secondary text: muted gray.
- Border: low-contrast gray.
- Accent: system blue or refined indigo.
- Stable harmony: quiet green.
- Color / tension harmony: muted orange.
- Error: system red.

Avoid:

- Pure black.
- Pure white.
- Strong gradients.
- Large saturated surfaces.
- Theme colors that overpower chord readability.

### 5.2 Suggested Tokens

Use these as starting values, then tune in implementation:

```css
:root {
  --color-bg: oklch(0.975 0.006 255);
  --color-surface: oklch(0.992 0.004 255);
  --color-surface-muted: oklch(0.955 0.006 255);
  --color-border: oklch(0.86 0.008 255);
  --color-text: oklch(0.21 0.01 255);
  --color-text-muted: oklch(0.52 0.012 255);
  --color-accent: oklch(0.58 0.17 255);
  --color-accent-soft: oklch(0.93 0.035 255);
  --color-stable: oklch(0.56 0.105 155);
  --color-tension: oklch(0.62 0.12 55);
  --color-danger: oklch(0.58 0.18 25);
}
```

### 5.3 Typography

Primary UI font:

- Inter, system-ui, or an SF Pro equivalent.

Music and timing font:

- IBM Plex Mono, JetBrains Mono, or a similar technical mono.

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

### 5.5 Shape and Elevation

Use flat surfaces with subtle borders.

Recommended:

- Radius: 8px or below.
- Minimal shadow only for overlays or floating popovers.
- Hairline separators.
- Clear focus rings.

Avoid:

- Thick rounded cards everywhere.
- Nested cards.
- Heavy drop shadows.
- Floating marketing panels.

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
## 12. Final Decisions

- Visual direction: Apple-inspired minimalist music workspace.
- Theme: light, warm neutral.
- Surface style: flat, precise, low-shadow.
- Primary layout: command bar + central timeline + right inspector.
- Public entry: English-only landing page leading into the workspace.
- Workspace language: Chinese / English toggle.
- Primary color: system blue or refined indigo.
- Main interaction: listen, compare, inspect, export.
- No texture-based theme in MVP.
- No medieval, fantasy, or ink style in MVP.
- Desktop-first, with basic tablet/mobile adaptation.
