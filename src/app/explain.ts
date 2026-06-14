import type { Language } from "./i18n";
import type {
  ChordDefinition,
  ChordToneRole,
  FitInfo,
  FunctionInfo,
  FunctionLabel,
} from "../music/types";

type Relationship = ChordToneRole | "non-chord tone";

const ROLE_LABELS: Record<Language, Record<Relationship, string>> = {
  en: {
    root: "root",
    third: "third",
    fifth: "fifth",
    seventh: "seventh",
    extension: "extension",
    "non-chord tone": "non-chord tone",
  },
  zh: {
    root: "根音",
    third: "三音",
    fifth: "五音",
    seventh: "七音",
    extension: "延伸音",
    "non-chord tone": "非和弦音",
  },
};

export function relationshipLabel(language: Language, relationship: Relationship): string {
  return ROLE_LABELS[language][relationship];
}

export function describeFit(
  language: Language,
  chord: ChordDefinition,
  fit: FitInfo | undefined,
  fallback: string,
): string {
  if (!fit) return fallback;
  const symbol = chord.symbol;
  if (language === "zh") {
    switch (fit.kind) {
      case "no-notes":
        return "本段没有旋律音，因此该和弦按其和声功能来判断。";
      case "chord-tone":
        return `${fit.noteName} 是 ${symbol} 的${ROLE_LABELS.zh[fit.role]}，与该段契合清晰。`;
      case "non-chord":
        return `${fit.noteName} 不在 ${symbol} 之内，因此该选择需要上下文支撑。`;
    }
  }
  switch (fit.kind) {
    case "no-notes":
      return "No melody notes occur in this segment, so the chord is judged by harmonic role.";
    case "chord-tone":
      return `${fit.noteName} is the ${fit.role} of ${symbol}, giving the segment a clear fit.`;
    case "non-chord":
      return `${fit.noteName} is outside ${symbol}, so this choice needs contextual support.`;
  }
}

function baseFunctionSentence(
  language: Language,
  symbol: string,
  label: FunctionLabel,
): string {
  if (language === "zh") {
    switch (label) {
      case "T":
        return `${symbol} 起到主功能或主功能替代的作用。`;
      case "PD":
        return `${symbol} 为属功能做准备，不显终止感。`;
      case "D":
        return `${symbol} 增加指向主功能的属张力。`;
      case "Color":
        return `${symbol} 是色彩性选择，而非严格的自然音功能。`;
    }
  }
  switch (label) {
    case "T":
      return `${symbol} works as a tonic or tonic-substitute sonority.`;
    case "PD":
      return `${symbol} prepares dominant motion without sounding final.`;
    case "D":
      return `${symbol} adds dominant pull toward tonic.`;
    case "Color":
      return `${symbol} is a color choice rather than a strict diatonic function.`;
  }
}

function motionSentence(
  language: Language,
  motion: NonNullable<FunctionInfo["motion"]>,
): string {
  if (language === "zh") {
    switch (motion.kind) {
      case "open-tonic":
        return "古典进行：乐句从主功能的稳定感开始。";
      case "open-prep":
        return `古典进行：乐句以 ${motion.to} 功能开始做准备。`;
      case "d-to-t":
        return "古典进行：属功能解决到主功能。";
      case "pd-to-d":
        return "古典进行：下属功能为属功能做准备。";
      case "t-to-pd":
        return "古典进行：主功能转向下属准备。";
      case "close-tonic":
        return "古典进行：乐句收束在主功能上。";
      case "general":
        return `古典进行：${motion.from} 到 ${motion.to} 让进行保持可解释。`;
    }
  }
  switch (motion.kind) {
    case "open-tonic":
      return "Classical motion: the phrase opens from tonic stability.";
    case "open-prep":
      return `Classical motion: the phrase opens with ${motion.to} function for preparation.`;
    case "d-to-t":
      return "Classical motion: dominant resolves to tonic.";
    case "pd-to-d":
      return "Classical motion: predominant prepares dominant.";
    case "t-to-pd":
      return "Classical motion: tonic moves toward predominant preparation.";
    case "close-tonic":
      return "Classical motion: the phrase closes on tonic function.";
    case "general":
      return `Classical motion: ${motion.from} to ${motion.to} keeps the progression explainable.`;
  }
}

export function describeFunction(
  language: Language,
  chord: ChordDefinition,
  info: FunctionInfo | undefined,
  fallback: string,
): string {
  if (!info) return fallback;
  const base = baseFunctionSentence(language, chord.symbol, info.functionLabel);
  if (!info.motion) return base;
  return `${base} ${motionSentence(language, info.motion)}`;
}

export function describeWarnings(
  language: Language,
  chord: ChordDefinition,
  warningNotes: string[] | undefined,
  fallback: string[],
): string {
  if (!warningNotes) return fallback.join(" ");
  if (language === "zh") {
    return warningNotes.map((note) => `${note} 是相对 ${chord.symbol} 的持续非和弦音。`).join(" ");
  }
  return warningNotes
    .map((note) => `${note} is a sustained non-chord tone against ${chord.symbol}.`)
    .join(" ");
}
