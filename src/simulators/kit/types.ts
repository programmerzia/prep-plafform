import type { ReactNode } from 'react';

/** One frame of a run. `state` is what the simulator draws; `en`/`bn` is the narration for this frame. */
export interface SimStep<S> {
  state: S;
  en: string;
  bn?: string;
  /** Colour hint for the narration line: green = correct/safe, red = wrong/conflict, amber = waiting. */
  tone?: 'ok' | 'bad' | 'wait';
}

export interface SimChoice {
  id: string;
  label: string;
}

/** The predict-first prompt for the current mode + preset. */
export interface SimPrediction {
  question: string;
  choices: SimChoice[];
  /** id of the choice that matches what actually happens */
  correct: string;
  /** shown next to the actual outcome, e.g. "1 4 3 2" */
  actual: string;
}

export interface SimNotice {
  bullets: string[];
  takeaway: string;
  takeawayBn?: string;
  challenge: string;
}

export interface SimShellProps<S> {
  /** registry id, used to store prediction accuracy */
  id: string;
  title: string;
  /** 2–3 sentences of the real-life story */
  story: string;
  storyBn?: string;
  /** Broken / Fixed (labels can be renamed). Exactly the modes the simulator supports. */
  modes: SimChoice[];
  mode: string;
  onMode: (id: string) => void;
  presets?: SimChoice[];
  preset?: string;
  onPreset?: (id: string) => void;
  /** Extra simulator-specific controls (sliders, inputs) rendered under the presets. */
  extras?: ReactNode;
  /** The full run for the current mode + preset. steps[0] is the initial state. */
  steps: SimStep<S>[];
  render: (state: S, index: number, steps: SimStep<S>[]) => ReactNode;
  prediction: SimPrediction;
  notice: SimNotice;
}
