export type WarningType =
  | 'tab_switch'
  | 'face_absent'
  | 'distracted'
  | 'suspicious_audio'
  | 'multiple_faces';

export interface IntegrityWarning {
  id: number;
  type: WarningType;
  message: string;
  ts: number;
}

export const MAX_WARNINGS = 6;

const MESSAGES: Record<WarningType, string> = {
  tab_switch:       'Tab switch detected — stay on the exam page.',
  face_absent:      'Face not detected. Keep your face visible to the camera.',
  distracted:       'Prolonged distraction detected. Focus on your exam.',
  suspicious_audio: 'Loud audio detected in your environment.',
  multiple_faces:   'Multiple faces detected in the camera feed.',
};

export function createIntegrityEngine() {
  const warnings: IntegrityWarning[] = [];
  let counter = 0;

  function addWarning(type: WarningType): IntegrityWarning {
    const w: IntegrityWarning = {
      id: ++counter,
      type,
      message: MESSAGES[type],
      ts: Date.now(),
    };
    warnings.push(w);
    return w;
  }

  function getScore(): number {
    return Math.max(0, Math.round(100 - (warnings.length / MAX_WARNINGS) * 100));
  }

  function getWarnings(): IntegrityWarning[] {
    return [...warnings];
  }

  function isTerminated(): boolean {
    return warnings.length >= MAX_WARNINGS;
  }

  return { addWarning, getScore, getWarnings, isTerminated };
}
