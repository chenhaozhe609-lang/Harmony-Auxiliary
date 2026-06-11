# Harmony Auxiliary PRD

## 1. Product Vision

Harmony Auxiliary is a web-based harmony assistant for music creation. It helps users turn a melody or MIDI sketch into several playable harmony options, then explains the harmonic logic behind each option.

The product should not behave like a one-click "auto composer". Its role is to support creative decision-making: generate candidates, make them audible, show the theory behind them, and let the user compare or revise the result.

The first product principle is:

> Use classical functional harmony as the default reasoning framework, then allow modern, non-common-practice color choices as explicit style extensions.

This makes the tool useful for music students while still being flexible enough for pop, film, and contemporary writing.

## 2. Target Users

### Primary User

Music students or early-stage composers who already understand basic notation, melody, and chord concepts, but want help choosing suitable harmony for their own material.

Typical needs:

- Import a MIDI sketch and hear possible chord choices quickly.
- Compare stable, pop-oriented, and more colorful harmony options.
- Understand why a chord works under a melody note.
- Export a harmonized result back into a DAW or notation workflow.

### Secondary Users

- Songwriters who want quick chord progression ideas.
- Piano or guitar learners who want accompaniment references.
- Teachers who want to demonstrate harmonic alternatives.
- Producers who want a rough harmonic draft before arranging.

## 3. Product Positioning

Harmony Auxiliary is a creation tool with learning-friendly explanations.

It is not:

- A full DAW.
- A professional notation editor.
- A strict four-part harmony grading system.
- A black-box AI composer.

It is:

- A melody-to-harmony assistant.
- A MIDI-based sketching companion.
- A harmonic comparison and audition tool.
- A theory-aware explanation layer for creative choices.

## 4. Core User Stories

1. As a music student, I want to upload a MIDI melody so I can hear several possible harmonizations.
2. As a creator, I want to choose between stable, pop, and tension-rich harmony modes so I can match the mood of the piece.
3. As a learner, I want to see chord names, Roman numerals, and functional labels so I can understand the harmonic role of each chord.
4. As a user without a MIDI file ready, I want to enter notes manually by clicking note names or a simple keyboard so I can test a short idea quickly.
5. As a composer, I want to export the chosen harmony as MIDI so I can continue editing it in another tool.
6. As a user comparing options, I want to solo or mute melody and harmony parts so I can judge whether the chord choices work.

## 5. MVP Scope

### In Scope

The MVP should include:

- MIDI file import for melody-first workflows.
- Manual note input through note-name buttons or a simple piano keyboard.
- Basic project settings:
  - Key.
  - Mode: major or minor.
  - Tempo.
  - Time signature.
  - Harmony rhythm: one chord per bar or one chord per half-bar.
- Generation of 3 harmony candidates:
  - Stable classical.
  - Pop / songwriting.
  - Color / tension.
- Audio playback:
  - Original melody.
  - Harmony only.
  - Melody plus harmony.
  - Candidate A / B / C comparison.
- Visual output:
  - Chord timeline.
  - Chord names.
  - Roman numerals.
  - Functional labels.
  - Piano-key highlight for current melody and harmony notes.
- Explanation output:
  - Short explanation per chord.
  - Overall explanation per candidate.
- MIDI export of the selected harmonized result.

### Out of Scope for MVP

The MVP should not include:

- Full five-line staff editing.
- Full MusicXML import/export.
- Advanced jazz substitutions.
- Complete four-part voice-leading validation.
- User accounts and cloud storage.
- Real-time collaborative editing.
- AI chat-based composition.
- Full DAW-style piano roll editing.

## 6. Input Design

### 6.1 MIDI Import

MIDI import is the primary input method for the creation workflow.

Expected behavior:

- User uploads a `.mid` or `.midi` file.
- System parses note pitch, start time, duration, velocity, and track/channel information where available.
- User can select which track should be treated as the melody if the MIDI has multiple tracks.
- System normalizes imported notes onto the project timeline.
- System provides a simple preview playback of the imported melody.

MVP assumptions:

- The imported MIDI is mostly monophonic or melody-led.
- Polyphonic MIDI can be accepted, but the user may need to select or simplify the melody track.
- If key detection is unreliable, the user-selected key takes priority.

### 6.2 Manual Note Input

Manual input is a fast sketching path for users without a prepared MIDI file.

MVP input modes:

- Note-name buttons: C, C#/Db, D, Eb, E, F, F#/Gb, G, Ab, A, Bb, B.
- Optional simple piano keyboard UI.
- Duration selector: whole, half, quarter, eighth.
- Bar-based timeline where notes are appended in sequence.

Manual input does not need to support full notation rules in the MVP.

### 6.3 Staff Notation

Five-line staff should be treated as a display layer in the MVP, not as an editing surface.

Rationale:

- Staff editing is significantly more complex than melody playback or MIDI parsing.
- Proper notation editing requires rests, ties, beams, accidentals, voices, tuplets, undo/redo, and measure-level constraints.
- A weak staff editor would distract from the core harmony tool.

Future direction:

- Use VexFlow, OpenSheetMusicDisplay, or a MusicXML-based pipeline if staff editing becomes necessary.

## 7. Output Design

### 7.1 Audio Output

Audio is the main output format. The product should make harmonic decisions audible before asking the user to read theory.

Required playback controls:

- Play / pause.
- Restart.
- Tempo adjustment.
- Candidate selection.
- Melody mute.
- Harmony mute.
- Volume balance between melody and harmony.

MVP sound sources:

- Browser synth or sampled piano for melody and harmony.
- Optional pad sound for sustained harmony.

Audio quality target:

- Good enough for harmonic judgment.
- Not required to match production-quality instrument libraries.

### 7.2 Harmony Text Output

Each generated candidate should display:

- Chord symbols: C, G/B, Am, Fmaj7.
- Roman numerals: I, V6, vi, IVmaj7.
- Functional labels:
  - T: tonic function.
  - PD: predominant function.
  - D: dominant function.
  - Color: non-functional or style-color choice.
- Measure or beat placement.

### 7.3 Visual Output

MVP visual elements:

- Timeline with bars and chord blocks.
- Piano keyboard highlighting:
  - Melody note.
  - Chord tones.
  - Optional root note emphasis.
- Compact explanation panel beside or below the selected chord.

Optional display:

- Read-only staff view for the melody if implementation cost remains reasonable.

### 7.4 Export Output

MVP export:

- Download selected result as MIDI.
- Copy chord progression as plain text.

Future export:

- MusicXML.
- PDF lead sheet.
- DAW-specific formats if demand appears.

## 8. Harmony Engine Logic

The harmony engine should be deterministic and explainable in the MVP. It can later add machine-learning or LLM-assisted suggestions, but the first version should rely on transparent scoring rules.

### 8.1 Data Model Concepts

Core entities:

- Note:
  - pitch class.
  - MIDI number.
  - start time.
  - duration.
  - velocity.
- Key:
  - tonic.
  - mode.
  - scale pitch classes.
- Chord:
  - root.
  - quality.
  - chord tones.
  - optional bass note.
  - Roman numeral.
  - function label.
- Segment:
  - bar or half-bar time range.
  - melody notes inside the range.
  - candidate chords.
- Harmony Candidate:
  - ordered chord sequence.
  - style mode.
  - score.
  - explanations.

### 8.2 Classical Functional Base Layer

The base layer should generate and score diatonic triads and seventh chords in the selected key.

Major-key default chord set:

- I: tonic.
- ii: predominant.
- iii: tonic substitute or weak color.
- IV: predominant.
- V: dominant.
- vi: tonic substitute.
- vii diminished: dominant function.

Minor-key default chord set:

- i: tonic.
- ii diminished: predominant or weak.
- III: color / relative major.
- iv: predominant.
- V: dominant, using raised leading tone when appropriate.
- VI: color / tonic substitute.
- vii diminished: dominant function.

Preferred functional motion:

- T to PD.
- PD to D.
- D to T.
- T to T substitute.
- PD to PD substitute.

Common cadence patterns:

- V to I / i.
- IV to V to I.
- ii to V to I.
- I to IV to V to I.

### 8.3 Melody Matching Layer

For each segment, the engine scores candidate chords against the melody notes.

Scoring signals:

- Strong-beat melody notes that are chord tones should score high.
- Melody notes that are chord thirds or sevenths can receive extra color value.
- Repeated or long-duration notes should influence scoring more than passing notes.
- Dissonant non-chord tones should be acceptable if they are short, weak-beat, or resolved.
- Chords that support cadential movement near phrase endings should score higher.

Basic note relationship labels:

- Root.
- Third.
- Fifth.
- Seventh.
- Non-chord tone.
- Passing tone, if detectable by stepwise motion.
- Neighbor tone, if detectable by departure and return.

### 8.4 Candidate Generation Modes

#### Stable Classical

Goal:

- Produce clear, functional, easy-to-explain harmony.

Behavior:

- Prefer diatonic triads.
- Use common cadences.
- Avoid abrupt chromatic choices.
- Prefer root-position or simple inversions.

#### Pop / Songwriting

Goal:

- Produce familiar, usable progressions for contemporary songs.

Behavior:

- Prefer common loops:
  - I - V - vi - IV.
  - vi - IV - I - V.
  - I - vi - IV - V.
  - I - IV - V - IV.
- Allow slash chords for smoother bass motion.
- Allow sus2, sus4, add9, and maj7 selectively.

#### Color / Tension

Goal:

- Produce more expressive or cinematic alternatives while staying explainable.

Behavior:

- Allow borrowed chords from parallel mode.
- Allow secondary dominants in obvious resolution contexts.
- Allow pedal-tone harmony.
- Allow modal color chords.
- Mark these choices as color or style choices rather than strict classical function.

## 9. Explanation Requirements

Explanations should be concise and tied to the actual generated result.

Each chord explanation should answer:

- Why this chord fits the melody at this moment.
- What function or color role it has.
- Whether it is stable, transitional, dominant, or coloristic.

Example explanations:

- "The melody note E is the third of C major, so the chord sounds stable and clearly tonic."
- "G7 creates dominant tension that resolves naturally to C in the next bar."
- "Am supports the melody note C as its third, giving the same note a softer tonic-substitute color."
- "F minor is borrowed from the parallel minor, adding color rather than following strict diatonic harmony."

Explanations should avoid pretending there is only one correct answer.

Preferred tone:

- Clear.
- Educational.
- Useful for creative comparison.
- Not overly academic unless the user requests deeper analysis.

## 10. UX Flow

### Public Landing Page

The deployed product should open with a concise English-only landing page before entering the workspace.

Purpose:

- Explain the product value to first-time visitors.
- Make the local-first privacy model visible before MIDI import.
- Provide one primary path into the workspace.
- Keep the product positioned as a creative harmony assistant, not a generic SaaS tool.

Landing page requirements:

- Copy is English-only and does not participate in the app language toggle.
- Primary CTA: open the workspace.
- Secondary cues: MIDI import, harmony candidates, audio playback, MIDI export.
- Include a product-relevant visual preview of the harmony workspace.
- Avoid long marketing sections, pricing, account prompts, and generic feature-card grids.

### Workspace Screen

After entering the app, the workspace remains the main product surface.

Recommended layout:

- Left or top input panel:
  - Upload MIDI.
  - Manual input.
  - Key, tempo, meter, harmony rhythm.
- Main workspace:
  - Timeline.
  - Chord candidates.
  - Playback controls.
- Right or bottom analysis panel:
  - Selected chord details.
  - Candidate explanation.
  - Export controls.

### Main Workflow

1. User imports MIDI or enters notes manually.
2. User confirms key, tempo, and harmony rhythm.
3. User selects one or more generation modes.
4. User clicks Generate.
5. System displays 3 candidates.
6. User plays each candidate.
7. User inspects chord labels and explanations.
8. User chooses a candidate.
9. User exports MIDI or copies the progression.

### UX Principles

- Audio controls must be always easy to reach.
- Candidate comparison should be quick.
- Theory output should support listening, not bury it.
- The interface should feel like a compact creative workspace.
- Do not force users into notation-heavy workflows before they can hear results.
- Mobile users should be able to preview, import or enter a short melody, generate, inspect, play, and export without layout overlap, though desktop remains the primary creation target.
- The workspace should support Chinese and English UI copy. Music notation such as chord symbols and Roman numerals should remain language-neutral.

### Language Behavior

Workspace language support:

- Chinese and English toggle inside the workspace command area.
- Default language can be Chinese for the intended early users.
- Persist the last selected workspace language in local preferences.
- Keep chord symbols, Roman numerals, MIDI file names, candidate IDs, and exported MIDI content unchanged by language.
- Error and status messages should use the active workspace language.

Landing page language support:

- Landing page remains English-only.
- Landing page does not need a language switcher.

## 11. Technical Product Requirements

### Frontend Requirements

Likely stack:

- React or Vue.
- Web Audio API or Tone.js for playback.
- MIDI parser library for import.
- MIDI writer library for export.
- Optional VexFlow for read-only notation display.

Required frontend capabilities:

- Local MIDI file parsing.
- Timeline rendering.
- Browser audio scheduling.
- State management for notes, chords, candidates, and playback.
- Responsive layout for desktop-first usage.

### Backend Requirements

MVP can be frontend-only if:

- MIDI parsing and audio rendering run locally.
- No accounts or cloud saves are needed.
- Harmony engine is deterministic and implemented client-side.

Backend may be introduced later for:

- User accounts.
- Saved projects.
- AI-assisted explanation or reharmonization.
- Large model-based style generation.
- Shared project links.

### Privacy Requirements

For MVP:

- Imported MIDI files should remain local in the browser.
- No upload to server unless a future backend feature clearly requires it.

This is important because users may import unfinished original music.

## 12. MVP Success Criteria

The MVP is successful if a user can:

- Import a simple MIDI melody.
- Generate at least 3 harmony candidates.
- Hear the melody with each candidate.
- Understand the basic theory behind the selected chords.
- Export a harmonized MIDI result.
- Use the product without needing to understand software setup or music-theory jargon beyond basic chord names.

Quality bar:

- The generated results do not need to be brilliant.
- They must be musically plausible, audible, editable, and explainable.

## 13. Future Roadmap

### V1.1

- Better MIDI track selection.
- Read-only staff notation.
- Chord inversion controls.
- More detailed non-chord-tone labeling.
- Manual chord editing on the timeline.

### V1.2

- Four-part voicing mode.
- Basic voice-leading checks.
- Parallel fifth and octave warnings.
- More robust phrase and cadence detection.

### V2

- MusicXML import/export.
- Full piano-roll editing.
- Style packs:
  - classical.
  - pop ballad.
  - jazz beginner.
  - film.
  - R&B / neo soul.
- AI-assisted reharmonization suggestions.
- Natural-language explanation depth control.

### V3

- User accounts.
- Cloud projects.
- Collaboration.
- Teacher review mode.
- Community preset sharing.

## 14. Open Questions

1. Should the first implementation be desktop-first only, or should mobile be meaningfully supported from the start?
2. Should the MVP prioritize major keys first, then add minor keys after the main flow works?
3. How much manual editing should be available in the first version: chord replacement only, or note-level editing too?
4. Should the product use English music terms, Chinese explanations, or bilingual labels?
5. Should style modes be strict presets or user-adjustable sliders, such as stable to colorful and simple to dense?
6. Should the first audio engine use simple browser synth sounds or a bundled piano sample library?
7. Should the harmony engine support only one melody track at first, or attempt to infer melody from polyphonic MIDI?

## 15. Recommended MVP Decision Set

For the first build, use the following decisions unless changed later:

- Product type: creation tool with learning explanations.
- Main input: MIDI import.
- Secondary input: note-name buttons and simple piano keyboard.
- Staff notation: read-only or deferred.
- Main output: audio playback.
- Supporting output: chord timeline, Roman numerals, functional labels, short explanations.
- Engine: deterministic rule-based scoring.
- Architecture: frontend-first, local-only MVP.
- Export: MIDI plus copyable chord progression.
- Initial styles: stable classical, pop / songwriting, color / tension.
