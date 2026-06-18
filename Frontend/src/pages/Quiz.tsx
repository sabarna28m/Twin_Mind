import { useState } from 'react';
import QuizModeSelector from '../components/quiz/QuizModeSelector';
import PracticeQuiz     from '../components/quiz/PracticeQuiz';
import FocusModeQuiz    from '../components/quiz/FocusModeQuiz';

type Mode = null | 'practice' | 'focus';

export default function Quiz() {
  const [mode, setMode] = useState<Mode>(null);

  if (mode === 'practice') return <PracticeQuiz onBack={() => setMode(null)} />;
  if (mode === 'focus')    return <FocusModeQuiz onBack={() => setMode(null)} />;
  return <QuizModeSelector onSelectMode={setMode} />;
}
