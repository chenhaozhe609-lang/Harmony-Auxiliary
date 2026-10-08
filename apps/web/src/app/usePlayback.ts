import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { LazyAudioEngine } from "../music/audio/lazyAudioEngine";
import { isSampledTonePreset } from "../music/audio/tonePresets";
import { clearSampleCache } from "../music/audio/sampleCache";
import type { HarmonyCandidate } from "../music/types";
import type { AppState } from "./sessionTypes";
import type { AppAction } from "./appState";
import { createPlaybackProgress } from "./playbackProgress";
import { selectedCandidateFrom } from "./pianoRollLayout";

export function usePlayback(state: AppState, dispatch: Dispatch<AppAction>, t: (key: string) => string, active = true) {
  const progress = useMemo(createPlaybackProgress, []);
  const playbackRequest = useRef(0);
  const audioEngineRef = useRef<LazyAudioEngine | null>(null);
  const [auditioningCandidateId, setAuditioningCandidateId] = useState<string | null>(null);
  const [toneStatus, setToneStatus] = useState<"loading" | "sampled" | "fallback" | "synth">("loading");
  const selectedCandidate = selectedCandidateFrom(state.candidates, state.selectedCandidateId);
  const harmonyIsReady = state.harmonyStatus === "ready" && selectedCandidate !== null;
  const hasMelody = state.melody.length > 0;
  useEffect(() => {
    if (!active) return;
    audioEngineRef.current = new LazyAudioEngine();
    return () => { audioEngineRef.current?.dispose(); audioEngineRef.current = null; };
  }, [active]);

  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    let cancelled = false;
    if (isSampledTonePreset(state.settings.playbackTone)) {
      setToneStatus("loading");
    }
    engine
      .loadTone(state.settings.playbackTone)
      .then((status) => {
        if (!cancelled) setToneStatus(status);
      })
      .catch(() => {
        if (!cancelled) setToneStatus("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, [state.settings.playbackTone, active]);

  useEffect(() => {
    ++playbackRequest.current;
    audioEngineRef.current?.stop();
    setAuditioningCandidateId(null);
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      dispatch({ type: "set-current-beat", currentBeat: progress.getSnapshot() });
      dispatch({ type: "pause-playback" });
    }
  }, [state.melody, state.settings, state.candidates, progress, dispatch, active]);

  const pausePlayback = () => {
    ++playbackRequest.current;
    audioEngineRef.current?.stop();
    dispatch({ type: "set-current-beat", currentBeat: progress.getSnapshot() });
    setAuditioningCandidateId(null);
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      dispatch({ type: "pause-playback" });
    }
  };

  const resetPlayback = () => {
    ++playbackRequest.current;
    audioEngineRef.current?.stop();
    setAuditioningCandidateId(null);
    progress.set(0);
    dispatch({ type: "reset-playback" });
  };

  const startPlaybackAt = async (
    startBeat: number,
    errorMessage: string,
    candidateOverride?: HarmonyCandidate | null,
  ) => {
    if (!hasMelody || state.playback.status === "starting") return;
    const playbackCandidate =
      candidateOverride === undefined
        ? harmonyIsReady
          ? selectedCandidate
          : null
        : candidateOverride;
    ++playbackRequest.current;
    audioEngineRef.current?.stop();
    progress.set(startBeat);
    dispatch({ type: "set-current-beat", currentBeat: startBeat });
    dispatch({ type: "set-playback-status", status: "starting" });

    const request = playbackRequest.current;
    try {
      const started = await audioEngineRef.current?.playCandidate(
        state.melody,
        playbackCandidate,
        state.settings.tempo,
        {
          melodyMuted: state.playback.melodyMuted,
          harmonyMuted: !playbackCandidate || state.playback.harmonyMuted,
          tonePreset: state.settings.playbackTone,
          startBeat,
        },
        progress.set,
        () => {
          setAuditioningCandidateId(null);
          progress.set(0);
          dispatch({ type: "reset-playback" });
        },
      );
      if (!started || playbackRequest.current !== request) return;
      dispatch({ type: "set-playback-status", status: "playing" });
    } catch {
      if (playbackRequest.current !== request) return;
      setAuditioningCandidateId(null);
      progress.set(0);
      dispatch({ type: "reset-playback" });
      dispatch({ type: "set-error", id: "audio", message: errorMessage });
    }
  };

  const playSelectedCandidate = async () => {
    if (!hasMelody || state.playback.status === "starting") return;

    if (state.playback.status === "playing") {
      pausePlayback();
      return;
    }

    await startPlaybackAt(progress.getSnapshot(), t("message.audioStart"));
  };

  const handlePlayFromStart = async () => {
    await startPlaybackAt(0, t("message.audioRestart"));
  };

  const handlePlayFromCurrentMeasure = async () => {
    const beatsPerMeasure = state.settings.timeSignature.numerator;
    const anchorBeat = progress.getSnapshot();
    const measureStartBeat = Math.floor(anchorBeat / beatsPerMeasure) * beatsPerMeasure;
    await startPlaybackAt(measureStartBeat, t("message.audioRestart"));
  };

  const toggleMelodyMute = () => {
    if (state.playback.status === "playing") pausePlayback();
    dispatch({ type: "toggle-melody-muted" });
  };

  const toggleHarmonyMute = () => {
    if (state.playback.status === "playing") pausePlayback();
    dispatch({ type: "toggle-harmony-muted" });
  };

  const handleSelectCandidate = (candidateId: string) => {
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      pausePlayback();
    }
    dispatch({ type: "select-candidate", candidateId });
  };

  const handlePreviewCandidate = async (candidateId: string) => {
    const candidate = state.candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    if (auditioningCandidateId === candidateId && state.playback.status === "playing") {
      pausePlayback();
      return;
    }
    if (state.playback.status === "playing" || state.playback.status === "starting") {
      ++playbackRequest.current;
      audioEngineRef.current?.stop();
    }
    dispatch({ type: "select-candidate", candidateId });
    setAuditioningCandidateId(candidateId);
    await startPlaybackAt(0, t("message.audioRestart"), candidate);
  };

  const auditionPitch = (midi: number) => {
    void audioEngineRef.current?.previewNote(midi, state.settings.playbackTone).catch(() => {
      dispatch({ type: "set-error", id: "audio", message: t("message.audioStart") });
    });
  };
  const clearAudioData = async () => {
    resetPlayback();
    audioEngineRef.current?.dispose();
    try { await clearSampleCache(); } finally {
      audioEngineRef.current = new LazyAudioEngine();
      setToneStatus("fallback");
    }
  };
  return { clearAudioData, progress, auditioningCandidateId, setAuditioningCandidateId, toneStatus, pausePlayback, resetPlayback,
    handlePlayFromStart, handlePlayFromCurrentMeasure, playSelectedCandidate, toggleMelodyMute,
    toggleHarmonyMute, handleSelectCandidate, handlePreviewCandidate, auditionPitch };
}
