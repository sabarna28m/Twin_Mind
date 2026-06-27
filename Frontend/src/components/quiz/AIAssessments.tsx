import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface Material {
  id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string | null;
}

interface QuizQuestion {
  id: number;
  type: 'MCQ' | 'true_false' | 'fill_blank' | 'short_answer' | 'long_answer';
  question: string;
  options?: string[];
  correct_answer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  marks: number;
}

interface GeneratedQuiz {
  questions: QuizQuestion[];
  material_id: number;
  material_name: string;
  difficulty: string;
  question_types: string[];
  error?: string;
}

type View = 'config' | 'quiz' | 'results';
type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
type QType = 'MCQ' | 'true_false' | 'fill_blank' | 'short_answer' | 'long_answer';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fileIcon(mime: string) {
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('text/')) return '📝';
  if (mime.includes('word')) return '📘';
  if (mime.includes('presentation')) return '📊';
  return '📎';
}

const DIFF_COLORS: Record<string, string> = { easy: '#34d399', medium: '#fbbf24', hard: '#f87171', mixed: '#a78bfa' };
const TYPE_LABELS: Record<QType, string> = {
  MCQ:          'MCQ',
  true_false:   'True / False',
  fill_blank:   'Fill in the Blank',
  short_answer: 'Short Answer',
  long_answer:  'Long Answer',
};
const Q_TYPE_OPTIONS: QType[] = ['MCQ', 'true_false', 'fill_blank', 'short_answer', 'long_answer'];

/* ── Single question display (during quiz) ─────────────────────────────────── */
function QuestionCard({
  q, index, total, answer, onAnswer,
}: {
  q: QuizQuestion; index: number; total: number;
  answer: string | undefined; onAnswer: (a: string) => void;
}) {
  const diffColor = DIFF_COLORS[q.difficulty] ?? '#64748b';
  return (
    <div style={qc.wrap}>
      {/* Header */}
      <div style={qc.head}>
        <span style={qc.qNum}>Q{index + 1} / {total}</span>
        <span style={{ ...qc.diffChip, color: diffColor, borderColor: `${diffColor}40`, background: `${diffColor}12` }}>
          {q.difficulty}
        </span>
        <span style={qc.topicChip}>{q.topic}</span>
        <span style={qc.marksChip}>{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
      </div>

      {/* Question text */}
      <p style={qc.qText}>{q.question}</p>

      {/* Answer input based on type */}
      {q.type === 'MCQ' && (q.options ?? []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {q.options!.map((opt, oi) => {
            const letter = opt[0]; // 'A', 'B', 'C', 'D'
            const selected = answer === letter;
            return (
              <button key={oi} onClick={() => onAnswer(letter)} style={{
                ...qc.optBtn,
                background: selected ? 'rgba(0,212,255,0.15)' : '#ffffff',
                borderColor: selected ? 'rgba(0,212,255,0.5)' : '#e2e8f0',
                color: selected ? '#00D4FF' : 'rgba(226,232,240,0.78)',
              }}>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'true_false' && (
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {['True', 'False'].map(v => (
            <button key={v} onClick={() => onAnswer(v)} style={{
              ...qc.tfBtn,
              background: answer === v ? (v === 'True' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)') : '#ffffff',
              borderColor: answer === v ? (v === 'True' ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)') : '#e2e8f0',
              color: answer === v ? (v === 'True' ? '#34d399' : '#f87171') : 'rgba(148,163,184,0.7)',
            }}>{v}</button>
          ))}
        </div>
      )}

      {(q.type === 'fill_blank' || q.type === 'short_answer') && (
        <input
          type="text"
          placeholder={q.type === 'fill_blank' ? 'Fill in the blank…' : 'Short answer…'}
          value={answer ?? ''}
          onChange={e => onAnswer(e.target.value)}
          style={qc.textInput}
        />
      )}

      {q.type === 'long_answer' && (
        <textarea
          rows={4}
          placeholder="Write your detailed answer…"
          value={answer ?? ''}
          onChange={e => onAnswer(e.target.value)}
          style={qc.textarea}
        />
      )}
    </div>
  );
}
const qc: Record<string, React.CSSProperties> = {
  wrap:      { display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.25rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' },
  head:      { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' as const },
  qNum:      { fontSize: '0.7rem', fontWeight: 800, color: '#64748b' },
  diffChip:  { padding: '0.12rem 0.4rem', borderRadius: '99px', fontSize: '0.63rem', fontWeight: 700, border: '1px solid' },
  topicChip: { padding: '0.12rem 0.4rem', borderRadius: '99px', fontSize: '0.63rem', fontWeight: 600, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#a78bfa' },
  marksChip: { marginLeft: 'auto', padding: '0.12rem 0.4rem', borderRadius: '99px', fontSize: '0.63rem', fontWeight: 700, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' },
  qText:     { margin: 0, fontSize: '0.92rem', fontWeight: 600, color: 'rgba(226,232,240,0.9)', lineHeight: 1.55 },
  optBtn:    { textAlign: 'left' as const, padding: '0.6rem 0.85rem', border: '1.5px solid', borderRadius: '10px', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'inherit', transition: 'background 0.18s, border-color 0.18s', fontWeight: 500 },
  tfBtn:     { flex: 1, padding: '0.65rem', border: '1.5px solid', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', transition: 'background 0.18s, border-color 0.18s' },
  textInput: { padding: '0.6rem 0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', color: 'var(--text-h)', fontSize: '0.85rem', fontFamily: 'inherit', outline: 'none' },
  textarea:  { padding: '0.65rem 0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', color: 'var(--text-h)', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const, lineHeight: 1.5 },
};

/* ── Review card (after submission) ─────────────────────────────────────────── */
function ReviewCard({ q, userAnswer }: { q: QuizQuestion; userAnswer: string | undefined }) {
  const [showExp, setShowExp] = useState(false);
  const isObjective = ['MCQ', 'true_false'].includes(q.type);
  const isCorrect   = isObjective
    ? (userAnswer ?? '').toUpperCase() === q.correct_answer.toUpperCase()
    : true; // subjective — no auto-grade

  return (
    <div style={{
      ...qc.wrap,
      borderColor: !isObjective ? '#e2e8f0' : isCorrect ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)',
      background:  !isObjective ? '#ffffff' : isCorrect ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)',
    }}>
      <div style={qc.head}>
        <span style={qc.qNum}>Q{q.id}</span>
        <span style={{ ...qc.diffChip, color: DIFF_COLORS[q.difficulty], borderColor: `${DIFF_COLORS[q.difficulty]}40`, background: `${DIFF_COLORS[q.difficulty]}12` }}>{q.difficulty}</span>
        {isObjective && (
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isCorrect ? '#34d399' : '#f87171' }}>
            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </span>
        )}
        {!isObjective && <span style={{ fontSize: '0.7rem', color: '#a78bfa', fontWeight: 600 }}>Self-review</span>}
      </div>

      <p style={qc.qText}>{q.question}</p>

      {/* User's answer */}
      <div style={{ padding: '0.5rem 0.75rem', background: '#ffffff', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 0.15rem', fontSize: '0.62rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Your Answer</p>
        <p style={{ margin: 0, fontSize: '0.82rem', color: isObjective ? (isCorrect ? '#34d399' : '#f87171') : 'rgba(226,232,240,0.8)', fontWeight: 600 }}>
          {userAnswer ?? <em style={{ opacity: 0.4 }}>Not answered</em>}
        </p>
      </div>

      {/* Correct answer (for objective) */}
      {isObjective && !isCorrect && (
        <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.62rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Correct Answer</p>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#34d399', fontWeight: 700 }}>{q.correct_answer}</p>
        </div>
      )}

      {/* Explanation */}
      <button onClick={() => setShowExp(v => !v)} style={{
        padding: '0.3rem 0.6rem', background: 'transparent', border: '1px solid #e2e8f0',
        borderRadius: '7px', fontSize: '0.7rem', color: '#475569', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
      }}>
        {showExp ? '▲ Hide' : '▼ Show'} Explanation
      </button>
      {showExp && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(226,232,240,0.65)', lineHeight: 1.55, padding: '0.5rem', background: '#ffffff', borderRadius: '8px' }}>
          {q.explanation}
        </p>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function AIAssessments() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [materials,  setMaterials]  = useState<Material[]>([]);
  const [libLoading, setLibLoading] = useState(true);
  const [selected,   setSelected]   = useState<Material | null>(null);

  const [subject,    setSubject]    = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [count,      setCount]      = useState(10);
  const [types,      setTypes]      = useState<QType[]>(['MCQ']);

  const [quiz,       setQuiz]       = useState<GeneratedQuiz | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState('');

  const [view,       setView]       = useState<View>('config');
  const [current,    setCurrent]    = useState(0);
  const [answers,    setAnswers]    = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<Material[]>('/materials', { headers })
      .then(r => setMaterials(r.data))
      .finally(() => setLibLoading(false));
  }, []);

  function toggleType(t: QType) {
    setTypes(prev => prev.includes(t) ? (prev.length > 1 ? prev.filter(x => x !== t) : prev) : [...prev, t]);
  }

  async function generateQuiz() {
    if (!selected) return;
    setGenerating(true);
    setGenError('');
    setQuiz(null);
    try {
      const { data } = await api.post<GeneratedQuiz>(
        `/materials/${selected.id}/generate-quiz`,
        { subject, difficulty, count, question_types: types },
        { headers },
      );
      if (data.error) { setGenError(data.error); }
      else { setQuiz(data); setView('quiz'); setCurrent(0); setAnswers({}); }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGenError(detail ?? 'Quiz generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  function submitQuiz() { setView('results'); }
  function retakeQuiz() { setCurrent(0); setAnswers({}); setView('quiz'); }
  function newQuiz() { setQuiz(null); setView('config'); setCurrent(0); setAnswers({}); }

  /* Score calculation */
  const questions = quiz?.questions ?? [];
  const objective = questions.filter(q => ['MCQ', 'true_false'].includes(q.type));
  const correctCount = objective.filter(q => (answers[q.id] ?? '').toUpperCase() === q.correct_answer.toUpperCase()).length;
  const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
  const earnedMarks = objective
    .filter(q => (answers[q.id] ?? '').toUpperCase() === q.correct_answer.toUpperCase())
    .reduce((s, q) => s + q.marks, 0);
  const pct = objective.length > 0 ? Math.round((correctCount / objective.length) * 100) : 0;

  /* ── Config view ── */
  if (view === 'config') return (
    <div style={s.wrap}>
      <div style={s.pageHead}>
        <p style={s.pageTitle}>🤖 AI Quiz Generator</p>
        <p style={s.pageSub}>Generate a custom quiz from any uploaded study material</p>
      </div>

      {/* Material selector */}
      <div style={s.card}>
        <p style={s.cardTitle}>1. Select Study Material</p>
        {libLoading ? (
          <p style={s.hint}>Loading library…</p>
        ) : materials.length === 0 ? (
          <p style={s.hint}>No materials uploaded yet. Go to Study Resources to upload a file.</p>
        ) : (
          <div style={s.matGrid}>
            {materials.map(m => (
              <div
                key={m.id}
                onClick={() => setSelected(m)}
                style={{
                  ...s.matCard,
                  borderColor: selected?.id === m.id ? 'rgba(0,212,255,0.5)' : '#e2e8f0',
                  background:  selected?.id === m.id ? 'rgba(0,212,255,0.08)' : '#ffffff',
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{fileIcon(m.mime_type)}</span>
                <p style={s.matName}>{m.original_name}</p>
                {selected?.id === m.id && <span style={s.selectedMark}>✓</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quiz config */}
      <div style={s.card}>
        <p style={s.cardTitle}>2. Configure Quiz</p>
        <div style={s.configGrid}>
          {/* Subject/topic */}
          <div style={s.configField}>
            <label style={s.configLabel}>Subject / Topic (optional)</label>
            <input
              type="text"
              placeholder="e.g. Anatomy Chapter 4, Cardiac Physiology…"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={s.textInput}
            />
          </div>

          {/* Difficulty */}
          <div style={s.configField}>
            <label style={s.configLabel}>Difficulty</label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' as const }}>
              {(['easy', 'medium', 'hard', 'mixed'] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)} style={{
                  ...s.diffBtn,
                  borderColor: difficulty === d ? DIFF_COLORS[d] : '#e2e8f0',
                  background:  difficulty === d ? `${DIFF_COLORS[d]}18` : 'transparent',
                  color:       difficulty === d ? DIFF_COLORS[d] : 'rgba(148,163,184,0.55)',
                }}>{d.charAt(0).toUpperCase() + d.slice(1)}</button>
              ))}
            </div>
          </div>

          {/* Question count */}
          <div style={s.configField}>
            <label style={s.configLabel}>Number of Questions: <strong style={{ color: '#00D4FF' }}>{count}</strong></label>
            <input type="range" min={5} max={30} step={5} value={count} onChange={e => setCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#00D4FF' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: '#64748b', marginTop: '0.1rem' }}>
              <span>5</span><span>15</span><span>30</span>
            </div>
          </div>

          {/* Question types */}
          <div style={s.configField}>
            <label style={s.configLabel}>Question Types</label>
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.35rem' }}>
              {Q_TYPE_OPTIONS.map(t => (
                <button key={t} onClick={() => toggleType(t)} style={{
                  ...s.typeBtn,
                  borderColor: types.includes(t) ? 'rgba(99,102,241,0.5)' : '#e2e8f0',
                  background:  types.includes(t) ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color:       types.includes(t) ? '#a78bfa' : 'rgba(148,163,184,0.55)',
                }}>{TYPE_LABELS[t]}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {genError && <p style={s.error}>{genError}</p>}

      <button
        onClick={generateQuiz}
        disabled={!selected || generating}
        style={{ ...s.primaryBtn, opacity: (!selected || generating) ? 0.5 : 1, cursor: (!selected || generating) ? 'not-allowed' : 'pointer' }}
      >
        {generating ? '⏳ Generating quiz…' : '✨ Generate Quiz from Material'}
      </button>

      {generating && (
        <div style={s.loadingRow}>
          <div style={s.spinner} />
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(148,163,184,0.55)' }}>
            AI is reading the material and crafting {count} questions at {difficulty} difficulty…
          </p>
        </div>
      )}
    </div>
  );

  /* ── Quiz view ── */
  if (view === 'quiz' && quiz) {
    const q = questions[current];
    const answered = Object.keys(answers).length;
    const progressPct = Math.round((answered / questions.length) * 100);
    return (
      <div style={s.wrap}>
        {/* Quiz header */}
        <div style={s.quizHeader}>
          <div>
            <p style={s.quizTitle}>{quiz.material_name}</p>
            <p style={s.quizMeta}>{questions.length} questions · {quiz.difficulty} · {quiz.question_types.join(', ')}</p>
          </div>
          <button onClick={newQuiz} style={s.outlineBtn}>✕ Exit</button>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ flex: 1, height: '5px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg, #00D4FF, #7c3aed)', borderRadius: '99px', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
            {answered} / {questions.length} answered
          </span>
        </div>

        {/* Question */}
        <QuestionCard
          q={q} index={current} total={questions.length}
          answer={answers[q.id]}
          onAnswer={a => setAnswers(prev => ({ ...prev, [q.id]: a }))}
        />

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            style={{ ...s.outlineBtn, opacity: current === 0 ? 0.4 : 1 }}
          >
            ← Previous
          </button>

          <div style={{ display: 'flex', gap: '0.3rem' }}>
            {questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%', border: '1.5px solid',
                  fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  background: i === current ? 'rgba(0,212,255,0.2)' : answers[questions[i].id] !== undefined ? 'rgba(52,211,153,0.12)' : '#ffffff',
                  borderColor: i === current ? 'rgba(0,212,255,0.5)' : answers[questions[i].id] !== undefined ? 'rgba(52,211,153,0.3)' : '#e2e8f0',
                  color: i === current ? '#00D4FF' : answers[questions[i].id] !== undefined ? '#34d399' : '#64748b',
                }}
              >{i + 1}</button>
            ))}
          </div>

          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent(c => c + 1)} style={s.primaryBtn}>
              Next →
            </button>
          ) : (
            <button onClick={submitQuiz} style={{ ...s.primaryBtn, background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
              Submit Quiz ✓
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Results view ── */
  if (view === 'results' && quiz) {
    const scoreColor = pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
    return (
      <div style={s.wrap}>
        {/* Score card */}
        <div style={{ ...s.card, textAlign: 'center', padding: '2rem 1.5rem' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '3rem', fontWeight: 900, color: scoreColor,
            textShadow: `0 0 30px ${scoreColor}50` }}>
            {pct}%
          </p>
          <p style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '1rem', color: 'rgba(226,232,240,0.88)' }}>
            {pct >= 80 ? '🏆 Excellent!' : pct >= 65 ? '👍 Good Job!' : pct >= 50 ? '📖 Keep Practicing' : '💪 Need More Study'}
          </p>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
            {correctCount} / {objective.length} correct · {earnedMarks} / {totalMarks} marks
            {questions.length > objective.length && ` · ${questions.length - objective.length} subjective (self-review)`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' as const }}>
            <button onClick={retakeQuiz} style={s.outlineBtn}>🔄 Retake Quiz</button>
            <button onClick={newQuiz} style={s.primaryBtn}>✨ New Quiz</button>
          </div>
        </div>

        {/* Review */}
        <p style={{ margin: '0.25rem 0', fontWeight: 700, fontSize: '0.85rem', color: 'rgba(226,232,240,0.7)' }}>
          📋 Question Review
        </p>
        {questions.map(q => (
          <ReviewCard key={q.id} q={q} userAnswer={answers[q.id]} />
        ))}
      </div>
    );
  }

  return null;
}

const s: Record<string, React.CSSProperties> = {
  wrap:       { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', maxWidth: '820px', margin: '0 auto' },
  pageHead:   { paddingBottom: '0.5rem', borderBottom: '1px solid #e2e8f0' },
  pageTitle:  { margin: '0 0 0.2rem', fontWeight: 900, fontSize: '1.05rem', color: 'rgba(226,232,240,0.92)' },
  pageSub:    { margin: 0, fontSize: '0.75rem', color: '#64748b' },
  card:       { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  cardTitle:  { margin: 0, fontWeight: 800, fontSize: '0.9rem', color: 'rgba(226,232,240,0.88)' },
  hint:       { margin: 0, fontSize: '0.78rem', color: '#64748b', textAlign: 'center' as const },
  matGrid:    { display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '200px', overflowY: 'auto' as const },
  matCard:    { display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem', borderRadius: '10px', border: '1px solid', cursor: 'pointer', transition: 'border-color 0.18s, background 0.18s' },
  matName:    { flex: 1, margin: 0, fontSize: '0.78rem', fontWeight: 600, color: 'rgba(226,232,240,0.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  selectedMark:{ fontSize: '0.75rem', fontWeight: 800, color: '#00D4FF', flexShrink: 0 },
  configGrid: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  configField:{ display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  configLabel:{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  textInput:  { padding: '0.55rem 0.85rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', color: 'var(--text-h)', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none' },
  diffBtn:    { flex: '1 1 70px', padding: '0.4rem 0.6rem', border: '1px solid', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 700, transition: 'all 0.18s' },
  typeBtn:    { padding: '0.3rem 0.6rem', border: '1px solid', borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700, transition: 'all 0.18s' },
  error:      { padding: '0.55rem 0.8rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.8rem', margin: 0 },
  primaryBtn: { padding: '0.65rem 1.4rem', border: 'none', borderRadius: '10px', background: 'linear-gradient(135deg, #00D4FF, #7c3aed)', color: '#fff', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(0,212,255,0.22)', transition: 'opacity 0.2s' },
  outlineBtn: { padding: '0.55rem 1rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '9px', color: 'rgba(148,163,184,0.7)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  loadingRow: { display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem', background: '#ffffff', borderRadius: '10px' },
  spinner:    { width: '18px', height: '18px', border: '2px solid rgba(0,212,255,0.15)', borderTopColor: '#00D4FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 },
  quizHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' },
  quizTitle:  { margin: '0 0 0.15rem', fontWeight: 800, fontSize: '0.9rem', color: 'rgba(226,232,240,0.88)' },
  quizMeta:   { margin: 0, fontSize: '0.7rem', color: '#64748b' },
};
