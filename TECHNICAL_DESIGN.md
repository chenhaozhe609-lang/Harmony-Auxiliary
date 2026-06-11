# Harmony Auxiliary Technical Design

## 1. Technical Goal

Build a frontend-first web application that can import or create a simple melody, generate several explainable harmony candidates, play them in the browser, and export the selected harmonization as MIDI.

The MVP should stay local-first:

- MIDI files are parsed in the browser.
- Audio playback is scheduled in the browser.
- Harmony generation is deterministic and client-side.
- No backend is required for the first version.

## 2. Recommended Stack

### 2.1 Application

Recommended:

- Vite.
- React.
- TypeScript.

Rationale:

- Vite is built for modern web development with fast dev server behavior and production bundling.
- React is suitable for a stateful workspace UI with timeline selection, inspector updates, and playback state.
- TypeScript is important because the app has musical data models where accidental shape drift will cause subtle bugs.

### 2.2 Audio

Recommended:

- Tone.js.

Rationale:

- Tone.js is a browser Web Audio framework for interactive music.
- It provides transport-style scheduling, synths, effects, and tempo-relative timing concepts that match this product.
- It keeps MVP audio local and avoids server rendering of audio.

Important implementation note:

- Browser audio must start from a user gesture. The play button should call the audio-start path before scheduling playback.

### 2.3 MIDI Import

Recommended:

- `@tonejs/midi`.

Rationale:

- It reads MIDI into JavaScript-friendly structures.
- Parsed tracks expose notes with values such as MIDI number, time, duration, and name.
- It can also encode MIDI, though export can be handled by a dedicated writer if preferred.

### 2.4 MIDI Export

Recommended options:

- Primary option: use `@tonejs/midi` for both import and export if its output API is sufficient.
- Alternative option: use `midi-writer-js` if we need clearer multi-track file generation APIs.

Rationale:

- `midi-writer-js` supports browser usage, TypeScript definitions, note names or MIDI numbers, chords, arpeggios, and multi-track MIDI generation.

### 2.5 State Management

Recommended:

- React state for local component state.
- Zustand or a small reducer-based store for project state if the UI grows.

Initial implementation can use a reducer before adding a dependency.

### 2.6 Styling

Recommended:

- Plain CSS modules or vanilla CSS with design tokens.

Rationale:

- The design depends on precision rather than component library defaults.
- A small, custom component set will better match the Apple-inspired minimalist direction.

Avoid large UI kits in MVP unless development speed becomes a bigger constraint than visual control.

## 3. High-Level Architecture

```text
src/
  app/
    App.tsx
    appState.ts
    i18n.ts
  components/
    CommandBar/
    Timeline/
    CandidateStrip/
    Inspector/
    ManualInput/
    PianoKeyboard/
  music/
    theory/
      keys.ts
      chords.ts
      romanNumerals.ts
      functions.ts
    harmony/
      segmentMelody.ts
      scoreChords.ts
      generateCandidates.ts
      explainHarmony.ts
    midi/
      importMidi.ts
      exportMidi.ts
      normalizeMidi.ts
    audio/
      audioEngine.ts
      scheduler.ts
      instruments.ts
    storage/
      storageTypes.ts
      projectRepository.ts
      preferencesRepository.ts
      autosave.ts
  styles/
    tokens.css
    global.css
```

Architecture rules:

- UI components should not contain music theory logic.
- MIDI parsing should normalize into the app's internal `NoteEvent` model immediately.
- Harmony generation should be deterministic and testable without React.
- Audio scheduling should consume normalized project data, not raw MIDI structures.
- Persistence should go through storage repositories, not direct `localStorage` or IndexedDB calls from UI components.
- Public landing content should remain static and English-only.
- Workspace copy should be read through a small i18n dictionary, not scattered string literals, for user-visible labels, actions, statuses, and errors.

## 4. Core Data Model

### 4.1 NoteEvent

```ts
type NoteEvent = {
  id: string;
  midi: number;
  pitchClass: number;
  name: string;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  source: "midi" | "manual" | "generated";
};
```

### 4.2 ProjectSettings

```ts
type ProjectSettings = {
  keyTonic: PitchClass;
  mode: "major" | "minor";
  tempo: number;
  timeSignature: {
    numerator: number;
    denominator: number;
  };
  harmonyDensity: "bar" | "half-bar";
};
```

### 4.3 ChordDefinition

```ts
type ChordDefinition = {
  id: string;
  root: PitchClass;
  quality: ChordQuality;
  tones: PitchClass[];
  bass?: PitchClass;
  symbol: string;
  roman: string;
  functionLabel: "T" | "PD" | "D" | "Color";
};
```

### 4.4 HarmonySegment

```ts
type HarmonySegment = {
  id: string;
  startBeat: number;
  durationBeats: number;
  melodyNotes: NoteEvent[];
  candidateChords: ScoredChord[];
};
```

### 4.5 HarmonyCandidate

```ts
type HarmonyCandidate = {
  id: string;
  mode: "stable-classical" | "pop-songwriting" | "color-tension";
  title: string;
  chords: PlacedChord[];
  score: number;
  summary: string;
};
```

### 4.6 PlacedChord

```ts
type PlacedChord = {
  id: string;
  chord: ChordDefinition;
  startBeat: number;
  durationBeats: number;
  explanation: ChordExplanation;
};
```

### 4.7 ChordExplanation

```ts
type ChordExplanation = {
  fitReason: string;
  functionReason: string;
  melodyRelationships: MelodyRelationship[];
  warnings: string[];
};
```

## 5. Harmony Engine

### 5.1 Engine Pipeline

```text
Input notes
  -> normalize timing
  -> segment melody by harmony density
  -> build key chord palette
  -> score chords per segment
  -> generate style-specific progressions
  -> smooth chord transitions
  -> attach explanations
  -> return candidates
```

### 5.2 Segmentation

Inputs:

- Melody notes.
- Time signature.
- Harmony density.

Outputs:

- Bar-length segments or half-bar segments.

Rules:

- Strong-beat notes carry more weight.
- Longer notes carry more weight.
- Empty segments can inherit harmonic context or use a stable continuation chord.

### 5.3 Chord Palette

MVP chord palette:

- Major key diatonic triads.
- Major key dominant seventh on V.
- Major key optional maj7/add9 in pop mode.
- Minor key support can be implemented after major key if needed.

Recommended build order:

1. Major keys.
2. Natural minor plus harmonic minor V.
3. Borrowed chords and secondary dominants.

### 5.4 Scoring Signals

For each segment and chord:

- Chord-tone coverage.
- Strong-beat fit.
- Long-note fit.
- Third or seventh color fit.
- Non-chord-tone penalty.
- Cadence bonus near phrase endings.
- Functional motion bonus from previous chord.
- Style preference bonus.

### 5.5 Candidate Modes

Stable Classical:

- Prefer I, IV, V, ii, vi.
- Prefer common cadences.
- Penalize chromatic color.

Pop / Songwriting:

- Prefer common loops.
- Allow sus/add9/maj7 color.
- Prefer smoother repetition and memorable cycles.

Color / Tension:

- Allow borrowed chords.
- Allow obvious secondary dominants.
- Allow pedal-tone-compatible choices.
- Clearly mark color choices in explanations.

### 5.6 Explainability

Every placed chord must include:

- Why it fits the current melody.
- What role it plays in the progression.
- Whether any note is treated as a non-chord tone.
- Whether the chord is functional or coloristic.

The engine should never return an unexplained chord.

## 6. MIDI Handling

### 6.1 Import Flow

1. User chooses a MIDI file.
2. App reads it as an ArrayBuffer.
3. MIDI parser extracts tracks and notes.
4. App shows track options if multiple tracks contain notes.
5. Selected track is normalized to `NoteEvent[]`.
6. Tempo and time signature are read when available.
7. User can override key, tempo, meter, and density.

### 6.2 Track Selection

Initial heuristic:

- Prefer non-percussion tracks.
- Prefer tracks with a clear melodic register.
- Prefer tracks with moderate note density.
- If uncertain, ask user to select from a list.

MVP fallback:

- Use the track with the highest count of pitched notes.

### 6.3 Export Flow

Export selected candidate as a MIDI file with:

- Melody track.
- Harmony track.
- Tempo event.
- Time signature event if supported by the writer.
- Track names: "Melody" and "Harmony".

Harmony voicing:

- MVP can use close-position triads or seventh chords near C3-C5.
- Later versions can add inversion and voice-leading controls.

## 7. Audio Engine

### 7.1 Playback Model

Playback modes:

- Melody only.
- Harmony only.
- Melody plus harmony.
- Candidate A/B/C.

Playback state:

- stopped.
- starting.
- playing.
- paused.

### 7.2 Scheduling

Audio scheduler consumes:

- `NoteEvent[]` for melody.
- `PlacedChord[]` for harmony.
- Tempo.
- Start beat.

The scheduler should:

- Convert beats to Tone.js timing.
- Schedule melody notes.
- Schedule chord tones.
- Update UI playback cursor using a synced animation loop.
- Cancel scheduled events when stopping or switching candidates.

### 7.3 Instruments

MVP instruments:

- Melody: simple piano-like synth.
- Harmony: softer electric piano or pad-like synth.

Future:

- Sampled piano.
- Strings pad.
- User-selectable sound.

## 8. UI State Model

Recommended top-level state:

```ts
type AppState = {
  settings: ProjectSettings;
  melody: NoteEvent[];
  candidates: HarmonyCandidate[];
  selectedCandidateId: string | null;
  selectedChordId: string | null;
  playback: PlaybackState;
  importState: MidiImportState;
  errors: AppError[];
};
```

State rules:

- Settings changes do not automatically discard melody.
- Melody changes invalidate generated candidates.
- Candidate selection updates the timeline and inspector.
- Chord selection updates only the inspector and timeline highlight.
- Playback candidate cannot be missing from candidates.

### 8.1 Screen State

The app can use a lightweight in-memory screen state rather than a router for the immediate enhancement:

```ts
type Screen = "landing" | "workspace";
```

Rules:

- Initial screen is `landing`.
- Landing page is English-only.
- Workspace state is not destroyed when the user returns to the landing page in the same browser session.
- A future router can replace this if separate URLs become necessary.

### 8.2 Workspace i18n

Use a dictionary-based i18n layer:

```ts
type Language = "zh" | "en";
type TranslationKey = string;
```

Rules:

- Persist language in `localStorage` with the rest of workspace preferences.
- Translate only workspace UI, messages, and explanatory chrome.
- Do not translate chord symbols, Roman numerals, imported file names, MIDI metadata, generated MIDI content, or exported filenames.
- Landing page copy remains English literals.
- Avoid runtime translation services. All MVP copy should be bundled in the app.

## 9. Local Data Storage

The MVP uses a local-first storage model. User music data should stay in the browser unless the user explicitly exports a file or a future backend feature is added.

### 9.1 Storage Layers

Use four storage layers:

1. Runtime memory.
2. `localStorage`.
3. IndexedDB.
4. User-initiated file export.

### 9.2 Runtime Memory

Runtime memory stores the active editing session.

Data:

- Current `AppState`.
- Imported melody as normalized `NoteEvent[]`.
- Generated harmony candidates.
- Selected candidate and chord.
- Playback state.
- Temporary import and error state.

Behavior:

- Fastest source of truth while the app is open.
- Lost on refresh unless autosaved.
- Should remain serializable except for live audio objects.
- Audio nodes, timers, and file handles must not be stored in app state.

### 9.3 `localStorage`

`localStorage` stores small preferences only.

Allowed data:

- Last selected key.
- Last selected mode.
- Last tempo.
- Last time signature.
- Last harmony density.
- Last input mode.
- Last workspace language.
- UI preferences such as collapsed panels if added later.

Disallowed data:

- Raw MIDI files.
- Full project snapshots.
- Generated candidate arrays for real projects.
- Audio data.

Rationale:

- `localStorage` is simple, synchronous, and small. It is suitable for preferences, not user compositions.

Suggested key:

```text
harmony-auxiliary/preferences/v1
```

### 9.4 IndexedDB

IndexedDB stores project drafts and import metadata.

Use IndexedDB for:

- Autosaved active project.
- User-created project drafts.
- Normalized melody notes.
- Project settings.
- Generated candidates if the user chooses to save or autosave them.
- Original MIDI file metadata:
  - file name.
  - file size.
  - last modified timestamp.
  - selected track index.
- Optional original MIDI blob if the user explicitly saves a project draft.

Do not store:

- Audio playback nodes.
- Live Tone.js objects.
- Unbounded history without quota control.

Recommended database:

```text
harmony-auxiliary-db
```

Recommended object stores:

- `projects`.
- `autosaves`.
- `imports`.

### 9.5 Project Snapshot

Persist projects as versioned snapshots.

```ts
type StoredProjectSnapshot = {
  schemaVersion: 1;
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  melody: NoteEvent[];
  candidates: HarmonyCandidate[];
  selectedCandidateId: string | null;
  selectedChordId: string | null;
  sourceImport?: {
    fileName: string;
    fileSize: number;
    lastModified: number;
    selectedTrackIndex: number | null;
    storedBlobId?: string;
  };
};
```

Rules:

- Persist only plain JSON-compatible data in snapshots.
- Include `schemaVersion` from the start.
- Add migrations when the shape changes.
- Treat generated candidates as reproducible cache. If the generation algorithm changes, candidates may be regenerated.

### 9.6 Autosave

MVP autosave should be conservative.

Behavior:

- Autosave active project after melody, settings, or candidate changes.
- Debounce writes by 800-1500ms.
- Keep one active autosave slot.
- Show recovery prompt on next load if an autosave exists.

Suggested key / store record:

```text
autosaves.active
```

Recovery behavior:

1. App starts.
2. Check for active autosave.
3. If present, show inline recovery option in the empty state.
4. User can restore or discard.

### 9.7 Export as Durable Save

MIDI export is the MVP's explicit durable save path.

Export can include:

- Melody track.
- Harmony track.
- Tempo.
- Time signature if supported.

This file belongs to the user and can be opened in a DAW or notation tool.

### 9.8 Privacy and Data Control

Privacy rules:

- Do not upload MIDI files in MVP.
- Do not send project snapshots to any server.
- Do not use imported melodies for analytics.
- Provide a "Clear local data" action before shipping beyond MVP.

Future backend features must be opt-in and should clearly say when project data leaves the browser.

### 9.9 Implementation Order

Recommended build order:

1. M2: runtime app state only.
2. M2 late: `localStorage` for preferences.
3. M4: IndexedDB for autosaved active project and import metadata.
4. M5: saved project list and clear local data action if time allows.

## 10. Error Handling

Required error cases:

- Unsupported file type.
- MIDI parse failure.
- MIDI contains no note tracks.
- Audio context could not start.
- Generation attempted without melody.
- Export attempted without selected candidate.

Errors should be actionable:

- "This MIDI file has no note tracks. Try another file or enter notes manually."
- "Audio can only start after pressing Play. Please try again."

## 11. Testing Strategy

### 11.1 Unit Tests

Must cover:

- Pitch class conversion.
- Key scale generation.
- Diatonic chord generation.
- Roman numeral generation.
- Melody segmentation.
- Chord scoring.
- Candidate generation.
- Explanation generation.

### 11.2 Integration Tests

Should cover:

- Import simple MIDI fixture.
- Generate candidates from fixture notes.
- Export selected candidate.
- Audio scheduling data preparation without actually playing audio.
- Save and restore a project snapshot through storage repositories.

### 11.3 UI Tests

Should cover:

- Empty state.
- MIDI import state.
- Generated candidate state.
- Candidate selection.
- Inspector updates.
- Playback button starts audio path.
- Autosave recovery prompt when stored project data exists.

### 11.4 Manual Audio QA

Before shipping MVP:

- Verify melody-only playback.
- Verify harmony-only playback.
- Verify combined playback.
- Verify candidate switching stops old scheduled audio.
- Verify exported MIDI opens in a common DAW or MIDI viewer.

## 12. Performance

MVP targets:

- Import and parse normal short MIDI files instantly or near-instantly.
- Generate candidates for a short melody in under 200ms on a typical laptop.
- Keep playback cursor smooth.
- Avoid rerendering the entire timeline on every animation frame.

Implementation guidance:

- Keep music engine functions pure.
- Memoize timeline layout calculations.
- Store playback cursor separately from heavy project data.
- Use SVG or canvas only if DOM rendering becomes slow.
- Debounce storage writes and keep them off the playback-critical path.

## 13. Build Milestones

### M1: Static Workspace

- Scaffold app.
- Add design tokens.
- Build command bar, timeline shell, candidate strips, inspector shell.
- No real MIDI or audio yet.

### M2: Manual Melody and Harmony Engine

- Add manual note input.
- Add runtime project state model.
- Persist lightweight preferences in `localStorage`.
- Add major-key chord palette.
- Segment melody.
- Generate three deterministic candidates.
- Show chord timeline and explanations.

### M3: Audio Playback

- Add Tone.js audio engine.
- Play melody.
- Play harmony.
- Play selected candidate.
- Add mute and restart controls.

### M4: MIDI Import

- Parse MIDI.
- Select melody track.
- Normalize notes.
- Add IndexedDB autosave for active project and import metadata.
- Generate candidates from imported melody.

### M5: MIDI Export and Polish

- Export selected candidate.
- Add saved project restore / discard flow.
- Add clear local data action if time allows.
- Add error states.
- Add responsive refinements.
- Add tests for theory and generation modules.

### M6: Landing, Mobile, and Bilingual Workspace

- Add English-only landing page.
- Add explicit workspace entry action.
- Add Chinese / English workspace language toggle.
- Persist workspace language preference.
- Refine mobile layout for first-run, manual input, candidate comparison, inspector, and export.
- Add smoke verification for landing-to-workspace and mobile viewport behavior.

## 14. Technical Risks

### 14.1 Harmony Quality

Risk:

- Rule-based output may sound too plain or occasionally awkward.

Mitigation:

- Keep multiple candidates.
- Make explanations honest.
- Allow chord replacement after MVP.

### 14.2 MIDI Complexity

Risk:

- User MIDI files can be multi-track, polyphonic, quantized poorly, or lack clear melody.

Mitigation:

- Start with explicit track selection.
- Add normalization and quantization later.
- Treat complex MIDI inference as future work.

### 14.3 Browser Audio Timing

Risk:

- Scheduling bugs can make playback feel unreliable.

Mitigation:

- Centralize scheduling.
- Cancel events aggressively on candidate switch.
- Keep UI cursor driven by the same transport timing source.

### 14.4 UI Density

Risk:

- Music tools can become visually crowded.

Mitigation:

- Keep inspector contextual.
- Keep advanced settings collapsed.
- Prioritize timeline space.

### 14.5 Local Storage Drift

Risk:

- Stored project snapshots may become incompatible as the music data model evolves.

Mitigation:

- Version every snapshot.
- Add migration functions.
- Keep generated candidates regeneratable.
- Keep original melody and settings as the durable core of each project.

### 14.6 Browser Storage Quotas

Risk:

- Large MIDI blobs or too many autosaves can hit browser storage limits.

Mitigation:

- Store original MIDI blobs only when the user explicitly saves a draft.
- Keep one active autosave slot in MVP.
- Add a clear local data action.

## 15. Source Notes

These references informed the technical recommendations:

- Vite guide: https://vite.dev/guide/
- Tone.js docs: https://tonejs.github.io/
- `@tonejs/midi`: https://github.com/Tonejs/Midi
- `midi-writer-js`: https://github.com/grimmdude/MidiWriterJS
