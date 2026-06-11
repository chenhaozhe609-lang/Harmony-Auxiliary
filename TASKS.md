# Harmony Auxiliary Tasks

## Milestone Overview

The build is organized around five milestones from `TECHNICAL_DESIGN.md`.

- M1: Static Workspace.
- M2: Manual Melody and Harmony Engine.
- M3: Audio Playback.
- M4: MIDI Import.
- M5: MIDI Export and Polish.

Each task should produce a visible or testable outcome. Keep implementation local-first unless a later decision introduces a backend.

## M1: Static Workspace

Goal: establish the app shell, visual system, and core workspace layout without real music logic.

Status: Complete. The app shell, design tokens, workspace layout, empty state, static generation state, candidate selection, chord selection, and inspector updates are implemented.

### M1.1 Project Scaffold

- Initialize Git repository.
- Create Vite + React + TypeScript scaffold.
- Add package scripts:
  - `dev`.
  - `build`.
  - `preview`.
  - `test`.
- Add base TypeScript config.
- Add `.gitignore`.

Acceptance criteria:

- App starts with the local dev server.
- Production build command succeeds.
- Repository has an initial commit.

### M1.2 Design Tokens and Global Styles

- Add CSS design tokens from `UI_UX_DESIGN.md`.
- Add global layout, typography, focus, and button reset styles.
- Set light minimalist workspace theme.

Acceptance criteria:

- App uses the finalized Apple-inspired minimalist direction.
- No texture, medieval, fantasy, glass, or decorative theme remains.

### M1.3 Workspace Shell

- Build command bar.
- Build main timeline canvas shell.
- Build inspector shell.
- Build candidate strip shell.
- Add empty state actions:
  - Import MIDI.
  - Enter Notes.
  - Load Demo Melody.

Acceptance criteria:

- First screen is the actual workspace.
- Command bar, timeline, candidate area, and inspector are visible.
- Layout remains usable at desktop width.

### M1.4 Static Interaction States

- Add selected candidate state.
- Add selected chord placeholder state.
- Add disabled Generate state when no melody exists.
- Add loading placeholder for candidate generation.

Acceptance criteria:

- User can click static candidate strips and see inspector state change.

## M2: Manual Melody and Harmony Engine

Goal: generate explainable harmony candidates from manually entered notes.

### M2.1 Core Music Types

- Implement `NoteEvent`.
- Implement `ProjectSettings`.
- Implement `ChordDefinition`.
- Implement `HarmonySegment`.
- Implement `HarmonyCandidate`.
- Implement `PlacedChord`.
- Implement `ChordExplanation`.
- Implement versioned project snapshot type.

Acceptance criteria:

- Music types are defined in isolated modules.
- UI imports only public app models.
- Project snapshots are plain JSON-compatible data.

### M2.2 Runtime App State and Preferences

- Implement reducer or lightweight store for runtime project state.
- Keep active melody, settings, candidates, selection, import state, playback state, and errors in one state model.
- Persist lightweight preferences to `localStorage`:
  - key.
  - mode.
  - tempo.
  - meter.
  - harmony density.
  - input mode.

Acceptance criteria:

- Refreshing the page restores user preferences.
- Refreshing the page does not pretend to restore unsaved project data.
- UI components do not call `localStorage` directly.

### M2.3 Theory Utilities

- Implement pitch-class conversion.
- Implement key scale generation.
- Implement major-key diatonic chord palette.
- Implement chord symbol generation.
- Implement Roman numeral generation.
- Implement function labels.

Acceptance criteria:

- Unit tests cover C major and at least two transposed major keys.

### M2.4 Manual Input

- Build note-name input.
- Build simple duration selector.
- Append notes to melody timeline.
- Add undo / clear melody.

Acceptance criteria:

- User can create a short melody without MIDI.
- Melody appears in the timeline.

### M2.5 Segmentation and Scoring

- Segment melody by bar or half-bar.
- Score chord-tone fit.
- Weight strong beats and long notes.
- Penalize unsupported long non-chord tones.

Acceptance criteria:

- Simple C major melody produces plausible chord rankings per segment.

### M2.6 Candidate Generation

- Generate Stable Classical candidate.
- Generate Pop / Songwriting candidate.
- Generate Color / Tension candidate.
- Attach explanations to every placed chord.

Acceptance criteria:

- App displays 3 candidates after generation.
- Every chord has symbol, Roman numeral, function, and explanation.

## M3: Audio Playback

Goal: make generated candidates audible in the browser.

### M3.1 Audio Engine Wrapper

- Add Tone.js dependency.
- Create `audioEngine`.
- Handle browser user-gesture audio start.
- Add start, stop, pause, and restart functions.

Acceptance criteria:

- Play button starts audio without console errors.

### M3.2 Melody Playback

- Schedule melody notes.
- Respect tempo.
- Support melody mute.

Acceptance criteria:

- Manually entered melody plays at expected timing.

### M3.3 Harmony Playback

- Convert placed chords to voicings.
- Schedule harmony notes.
- Support harmony mute.

Acceptance criteria:

- Selected candidate plays with melody and harmony together.

### M3.4 Playback UI Sync

- Add playback cursor.
- Update current bar/beat.
- Highlight current chord during playback.
- Stop previous schedules when switching candidates.

Acceptance criteria:

- Playback cursor and selected chord stay in sync with audio.

## M4: MIDI Import

Goal: support MIDI-first creation workflow.

### M4.1 MIDI Parser Integration

- Add `@tonejs/midi`.
- Read `.mid` and `.midi` files as ArrayBuffer.
- Parse note tracks.
- Convert parsed notes to `NoteEvent[]`.

Acceptance criteria:

- A simple MIDI melody imports and appears in the timeline.

### M4.2 Track Selection

- Detect note-containing tracks.
- Show track selector if multiple tracks exist.
- Use a reasonable fallback when only one track exists.

Acceptance criteria:

- User can choose which MIDI track is the melody.

### M4.3 MIDI Normalization

- Normalize note start and duration into beats.
- Read tempo where available.
- Read meter where available if parser exposes it.
- Allow user override.

Acceptance criteria:

- Imported notes align visibly with the timeline grid.

### M4.4 Generate From MIDI

- Run the M2 harmony engine on imported melody.
- Preserve imported melody when changing key or density.

Acceptance criteria:

- User can import MIDI, generate 3 candidates, and inspect explanations.

### M4.5 IndexedDB Autosave

- Add IndexedDB project repository.
- Store one active autosave slot.
- Save active project snapshot after melody, settings, or candidate changes.
- Debounce autosave writes.
- Store import metadata.
- Store original MIDI blob only when explicitly saving a draft.

Acceptance criteria:

- Active project can be restored after refresh.
- User can discard recovered autosave.
- Autosave does not block playback or generation.

## M5: MIDI Export and Polish

Goal: complete the MVP loop and harden the app.

### M5.1 MIDI Export

- Add export writer using `@tonejs/midi` or `midi-writer-js`.
- Export melody track.
- Export harmony track.
- Include tempo and meter if supported.

Acceptance criteria:

- Downloaded MIDI opens in a MIDI viewer or DAW.

### M5.2 Chord Replacement

- Show alternative chords for selected segment.
- Allow replacing a chord in the selected candidate.
- Regenerate explanation for replacement.

Acceptance criteria:

- User can make at least one manual chord edit before export.

### M5.3 Error States

- Unsupported file type.
- MIDI parse failure.
- No note tracks.
- Generate without melody.
- Export without selected candidate.
- Audio context failure.

Acceptance criteria:

- Every expected error has clear user-facing copy.

### M5.4 Local Data Management

- Add clear local data action.
- Add saved draft restore / discard flow if saved drafts exist.
- Make privacy behavior visible in copy near import or settings.

Acceptance criteria:

- User can remove locally stored project data.
- The product clearly states MIDI stays local in the MVP.

### M5.5 Responsive and Accessibility Pass

- Add keyboard focus states.
- Add accessible labels.
- Ensure candidate identity does not rely on color alone.
- Add tablet layout.
- Add mobile preview layout.

Acceptance criteria:

- Basic keyboard navigation works.
- Layout does not overlap at common desktop and tablet widths.

### M5.6 Test Coverage

- Add unit tests for theory utilities.
- Add unit tests for segmentation and scoring.
- Add integration test for generation from a fixture melody.
- Add storage repository tests for project snapshot save / restore.
- Add UI test for empty to generated flow if test tooling is available.

Acceptance criteria:

- Test command runs in CI-like local environment.

## Deferred Tasks

- Full staff editing.
- MusicXML import/export.
- Advanced jazz substitution.
- Four-part writing checks.
- User accounts.
- Cloud projects.
- AI-assisted reharmonization.
- Collaboration.
