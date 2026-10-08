import { useState } from "react";
import { GUIDE_STEPS } from "./workspaceConstants";

export function useGuide(hasMelody: boolean, showCandidates: boolean, hasSelectedCandidate: boolean) {
  const [activeStep, setActiveStep] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const stepGates = [
    hasMelody, // input -> settings
    hasMelody, // settings -> generate
    showCandidates, // generate -> audition
    hasSelectedCandidate, // audition -> select
    hasSelectedCandidate, // select -> export
    false, // export is the last step
  ];
  let furthestReachable = 0;
  while (furthestReachable < GUIDE_STEPS.length - 1 && stepGates[furthestReachable]) {
    furthestReachable += 1;
  }
  const guideStep = Math.min(activeStep, furthestReachable);
  const canAdvanceStep = stepGates[guideStep];
  const goToStep = (index: number) => setActiveStep(Math.max(0, Math.min(furthestReachable, index)));

  return { setActiveStep, guideOpen, setGuideOpen, guideStep, furthestReachable, canAdvanceStep, goToStep };
}
