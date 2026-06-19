import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
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

interface Analysis {
  material_id: number;
  material_name: string;
  quick_summary?: string[];
  detailed_summary?: string;
  chapter_breakdown?: { title: string; summary: string; key_points: string[] }[];
  important_concepts?: string[];
  key_definitions?: { term: string; definition: string }[];
  exam_notes?: string;
  flashcards?: { front: string; back: string }[];
  important_questions?: string[];
  revision_notes?: string;
  topics?: string[];
  keywords?: string[];
  mind_map?: { central: string; branches: { label: string; children: string[] }[] };
  error?: string;
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

type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';
type PageView       = 'library' | 'quiz' | 'results';
type AnalysisTab    = 'summary' | 'chapters' | 'flashcards' | 'questions' | 'definitions' | 'exam' | 'mindmap' | 'revision';
type QType          = 'MCQ' | 'true_false' | 'fill_blank' | 'short_answer' | 'long_answer';
type Difficulty     = 'easy' | 'medium' | 'hard' | 'mixed';

/* ── Constants ──────────────────────────────────────────────────────────────── */
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.docx,.pptx,.doc';

const ANALYSIS_TABS: { key: AnalysisTab; icon: string; label: string }[] = [
  { key: 'summary',     icon: '📋', label: 'Summary'     },
  { key: 'chapters',    icon: '📖', label: 'Chapters'    },
  { key: 'flashcards',  icon: '🃏', label: 'Flashcards'  },
  { key: 'questions',   icon: '❓', label: 'Questions'   },
  { key: 'definitions', icon: '📚', label: 'Definitions' },
  { key: 'exam',        icon: '📝', label: 'Exam Notes'  },
  { key: 'mindmap',     icon: '🗺', label: 'Mind Map'    },
  { key: 'revision',    icon: '🔄', label: 'Revision'    },
];

const Q_TYPE_OPTIONS: { key: QType; label: string }[] = [
  { key: 'MCQ',          label: 'MCQ'           },
  { key: 'true_false',   label: 'True / False'  },
  { key: 'fill_blank',   label: 'Fill in Blank' },
  { key: 'short_answer', label: 'Short Answer'  },
  { key: 'long_answer',  label: 'Long Answer'   },
];

const DIFF_COLORS: Record<string, string> = {
  easy: '#34d399', medium: '#fbbf24', hard: '#f87171', mixed: '#a78bfa',
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fileIcon(mime: string) {
  if (mime === 'application/pdf')    return '📄';
  if (mime.startsWith('image/'))     return '🖼';
  if (mime.startsWith('text/'))      return '📝';
  if (mime.includes('word'))         return '📘';
  if (mime.includes('presentation')) return '📊';
  return '📎';
}
function fmtSize(b: number) {
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function isPreviewable(mime: string) {
  return mime.startsWith('image/') || mime === 'application/pdf';
}

/* ── Flashcard ──────────────────────────────────────────────────────────────── */
function Flashcard({ front, back, index, total }: { front: string; back: string; index: number; total: number }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem' }}>
      <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(148,163,184,0.4)', fontWeight: 600 }}>
        {index + 1} / {total}
      </p>
      <div onClick={() => setFlipped(f => !f)} style={{
        width: '100%', minHeight: '130px', cursor: 'pointer',
        background: flipped ? 'rgba(99,102,241,0.1)' : 'rgba(0,212,255,0.07)',
        border: `1.5px solid ${flipped ? 'rgba(99,102,241,0.3)' : 'rgba(0,212,255,0.2)'}`,
        borderRadius: '14px', padding: '1.4rem', display: 'flex',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center' as const,
        transition: 'background 0.25s, border-color 0.25s',
      }}>
        <div>
          <p style={{ margin: '0 0 0.35rem', fontSize: '0.6rem', fontWeight: 800,
            color: flipped ? '#a78bfa' : '#00D4FF', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
            {flipped ? '✓ Answer' : '? Question'}
          </p>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600,
            color: 'rgba(226,232,240,0.88)', lineHeight: 1.5 }}>
            {flipped ? back : front}
          </p>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: '0.62rem', color: 'rgba(148,163,184,0.35)' }}>
        Tap to {flipped ? 'see question' : 'reveal answer'}
      </p>
    </div>
  );
}

/* ── MindMap ────────────────────────────────────────────────────────────────── */
function MindMap({ data }: { data: { central: string; branches: { label: string; children: string[] }[] } }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', minWidth: '300px', padding: '0.5rem 0' }}>
        <div style={{ padding: '0.6rem 1.3rem', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
          borderRadius: '99px', fontWeight: 800, fontSize: '0.85rem', color: '#fff',
          boxShadow: '0 0 20px rgba(99,102,241,0.35)', textAlign: 'center' as const }}>
          {data.central}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.65rem', justifyContent: 'center' }}>
          {data.branches.map((branch, bi) => (
            <div key={bi} style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.22)',
              borderRadius: '12px', padding: '0.55rem 0.8rem', minWidth: '110px' }}>
              <p style={{ margin: '0 0 0.35rem', fontWeight: 700, fontSize: '0.72rem',
                color: '#a78bfa', textAlign: 'center' as const }}>{branch.label}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18rem' }}>
                {branch.children.map((child, ci) => (
                  <p key={ci} style={{ margin: 0, fontSize: '0.63rem', color: 'rgba(148,163,184,0.65)',
                    paddingLeft: '0.35rem', borderLeft: '2px solid rgba(99,102,241,0.28)' }}>{child}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── QuizQuestionCard ───────────────────────────────────────────────────────── */
function QuizQuestionCard({ q, index, total, answer, onAnswer }: {
  q: QuizQuestion; index: number; total: number;
  answer: string | undefined; onAnswer: (a: string) => void;
}) {
  const dc = DIFF_COLORS[q.difficulty] ?? '#94a3b8';
  return (
    <div style={qs.wrap}>
      <div style={qs.head}>
        <span style={qs.qNum}>Q{index + 1} / {total}</span>
        <span style={{ ...qs.chip, color: dc, borderColor: `${dc}40`, background: `${dc}10` }}>{q.difficulty}</span>
        <span style={qs.topicChip}>{q.topic}</span>
        <span style={qs.marksChip}>{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
      </div>
      <p style={qs.qText}>{q.question}</p>

      {q.type === 'MCQ' && (q.options ?? []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {q.options!.map((opt, oi) => {
            const letter = opt.charAt(0);
            const sel = answer === letter;
            return (
              <button key={oi} onClick={() => onAnswer(letter)} style={{
                ...qs.optBtn,
                background: sel ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.03)',
                borderColor: sel ? 'rgba(0,212,255,0.45)' : 'rgba(255,255,255,0.09)',
                color: sel ? '#00D4FF' : 'rgba(226,232,240,0.75)',
              }}>{opt}</button>
            );
          })}
        </div>
      )}

      {q.type === 'true_false' && (
        <div style={{ display: 'flex', gap: '0.55rem' }}>
          {['True', 'False'].map(v => (
            <button key={v} onClick={() => onAnswer(v)} style={{
              ...qs.tfBtn,
              background: answer === v ? (v === 'True' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)') : 'rgba(255,255,255,0.03)',
              borderColor: answer === v ? (v === 'True' ? 'rgba(52,211,153,0.45)' : 'rgba(248,113,113,0.45)') : 'rgba(255,255,255,0.09)',
              color: answer === v ? (v === 'True' ? '#34d399' : '#f87171') : 'rgba(148,163,184,0.65)',
            }}>{v}</button>
          ))}
        </div>
      )}

      {(q.type === 'fill_blank' || q.type === 'short_answer') && (
        <input type="text" placeholder={q.type === 'fill_blank' ? 'Fill in the blank…' : 'Your answer…'}
          value={answer ?? ''} onChange={e => onAnswer(e.target.value)} style={qs.textInput} />
      )}

      {q.type === 'long_answer' && (
        <textarea rows={4} placeholder="Write your detailed answer…"
          value={answer ?? ''} onChange={e => onAnswer(e.target.value)} style={qs.textarea} />
      )}
    </div>
  );
}
const qs: Record<string, React.CSSProperties> = {
  wrap:      { display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.1rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' },
  head:      { display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' as const },
  qNum:      { fontSize: '0.68rem', fontWeight: 800, color: 'rgba(148,163,184,0.45)' },
  chip:      { padding: '0.1rem 0.38rem', borderRadius: '99px', fontSize: '0.6rem', fontWeight: 700, border: '1px solid' },
  topicChip: { padding: '0.1rem 0.38rem', borderRadius: '99px', fontSize: '0.6rem', fontWeight: 600, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.22)', color: '#a78bfa' },
  marksChip: { marginLeft: 'auto', padding: '0.1rem 0.38rem', borderRadius: '99px', fontSize: '0.6rem', fontWeight: 700, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)', color: '#fbbf24' },
  qText:     { margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'rgba(226,232,240,0.9)', lineHeight: 1.55 },
  optBtn:    { textAlign: 'left' as const, padding: '0.55rem 0.8rem', border: '1.5px solid', borderRadius: '9px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', transition: 'background 0.18s, border-color 0.18s', fontWeight: 500 },
  tfBtn:     { flex: 1, padding: '0.6rem', border: '1.5px solid', borderRadius: '9px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'inherit', transition: 'all 0.18s' },
  textInput: { padding: '0.55rem 0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', color: 'var(--text-h)', fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const },
  textarea:  { padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', color: 'var(--text-h)', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const, lineHeight: 1.5, width: '100%', boxSizing: 'border-box' as const },
};

/* ── ReviewCard ─────────────────────────────────────────────────────────────── */
function ReviewCard({ q, userAnswer }: { q: QuizQuestion; userAnswer: string | undefined }) {
  const [showExp, setShowExp] = useState(false);
  const isObj = ['MCQ', 'true_false'].includes(q.type);
  const isCorrect = isObj ? (userAnswer ?? '').toUpperCase() === q.correct_answer.toUpperCase() : true;
  const dc = DIFF_COLORS[q.difficulty] ?? '#94a3b8';

  return (
    <div style={{
      ...qs.wrap,
      borderColor: !isObj ? 'rgba(255,255,255,0.08)' : isCorrect ? 'rgba(52,211,153,0.28)' : 'rgba(248,113,113,0.28)',
      background:  !isObj ? 'rgba(255,255,255,0.025)' : isCorrect ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)',
    }}>
      <div style={qs.head}>
        <span style={qs.qNum}>Q{q.id}</span>
        <span style={{ ...qs.chip, color: dc, borderColor: `${dc}40`, background: `${dc}10` }}>{q.difficulty}</span>
        {isObj && (
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isCorrect ? '#34d399' : '#f87171' }}>
            {isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </span>
        )}
        {!isObj && <span style={{ fontSize: '0.68rem', color: '#a78bfa', fontWeight: 600 }}>Self-review</span>}
      </div>
      <p style={qs.qText}>{q.question}</p>

      <div style={{ padding: '0.45rem 0.7rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 0.1rem', fontSize: '0.58rem', fontWeight: 700, color: 'rgba(148,163,184,0.45)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Your Answer</p>
        <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600,
          color: isObj ? (isCorrect ? '#34d399' : '#f87171') : 'rgba(226,232,240,0.8)' }}>
          {userAnswer ?? <em style={{ opacity: 0.4 }}>Not answered</em>}
        </p>
      </div>

      {isObj && !isCorrect && (
        <div style={{ padding: '0.45rem 0.7rem', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.18)', borderRadius: '8px' }}>
          <p style={{ margin: '0 0 0.1rem', fontSize: '0.58rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Correct Answer</p>
          <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#34d399' }}>{q.correct_answer}</p>
        </div>
      )}

      <button onClick={() => setShowExp(v => !v)} style={{ padding: '0.25rem 0.55rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '7px', fontSize: '0.67rem', color: 'rgba(148,163,184,0.55)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}>
        {showExp ? '▲ Hide' : '▼ Show'} Explanation
      </button>
      {showExp && (
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(226,232,240,0.62)', lineHeight: 1.55, padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
          {q.explanation}
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════════ */
export default function StudyResources() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const inputRef = useRef<HTMLInputElement>(null);

  /* Library */
  const [materials,      setMaterials]      = useState<Material[]>([]);
  const [libLoading,     setLibLoading]     = useState(true);
  const [uploading,      setUploading]      = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver,       setDragOver]       = useState(false);
  const [uploadError,    setUploadError]    = useState('');
  const [search,         setSearch]         = useState('');

  /* Analysis */
  const [analysisCache,       setAnalysisCache]       = useState<Record<number, Analysis>>({});
  const [analysisStatus,      setAnalysisStatus]      = useState<Record<number, AnalysisStatus>>({});
  const [selected,            setSelected]            = useState<Material | null>(null);
  const [aTab,                setATab]                = useState<AnalysisTab>('summary');
  const [fcIndex,             setFcIndex]             = useState(0);
  const [analyzeAllProgress,  setAnalyzeAllProgress]  = useState<{ done: number; total: number } | null>(null);

  /* Quiz config */
  const [showQuizPanel, setShowQuizPanel] = useState(false);
  const [quizSubject,   setQuizSubject]   = useState('');
  const [quizDiff,      setQuizDiff]      = useState<Difficulty>('medium');
  const [quizCount,     setQuizCount]     = useState(10);
  const [quizTypes,     setQuizTypes]     = useState<QType[]>(['MCQ']);
  const [generating,    setGenerating]    = useState(false);
  const [genError,      setGenError]      = useState('');

  /* Quiz player */
  const [pageView, setPageView] = useState<PageView>('library');
  const [quiz,     setQuiz]     = useState<GeneratedQuiz | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers,  setAnswers]  = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<Material[]>('/materials', { headers })
      .then(r => setMaterials(r.data))
      .finally(() => setLibLoading(false));
  }, []);

  const filtered = materials.filter(m =>
    m.original_name.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Upload ─────────────────────────────────────────────────────────────── */
  async function uploadFile(file: File) {
    setUploadError('');
    setUploading(true);
    setUploadProgress(0);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<Material>('/materials', form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setUploadProgress(Math.round((e.loaded * 100) / (e.total ?? e.loaded))),
      });
      setMaterials(prev => [data, ...prev]);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUploadError(detail ?? 'Upload failed.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  /* ── Analyze one ─────────────────────────────────────────────────────────── */
  async function analyzeOne(m: Material): Promise<void> {
    setAnalysisStatus(p => ({ ...p, [m.id]: 'analyzing' }));
    try {
      const { data } = await api.post<Analysis>(`/materials/${m.id}/analyze`, {}, { headers });
      if (data.error) {
        setAnalysisStatus(p => ({ ...p, [m.id]: 'error' }));
      } else {
        setAnalysisCache(p => ({ ...p, [m.id]: data }));
        setAnalysisStatus(p => ({ ...p, [m.id]: 'done' }));
        setSelected(m);
        setATab('summary');
        setFcIndex(0);
        setShowQuizPanel(false);
      }
    } catch {
      setAnalysisStatus(p => ({ ...p, [m.id]: 'error' }));
    }
  }

  /* ── Analyze all ─────────────────────────────────────────────────────────── */
  async function analyzeAll() {
    const pending = materials.filter(m => analysisStatus[m.id] !== 'done');
    if (!pending.length) return;
    setAnalyzeAllProgress({ done: 0, total: pending.length });
    for (let i = 0; i < pending.length; i++) {
      await analyzeOne(pending[i]);
      setAnalyzeAllProgress({ done: i + 1, total: pending.length });
    }
    setAnalyzeAllProgress(null);
  }

  /* ── View / Download ─────────────────────────────────────────────────────── */
  async function fetchAndOpen(id: number, name: string, mime: string, forceDownload = false) {
    try {
      const res  = await fetch(`${api.defaults.baseURL}/materials/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      if (!forceDownload && isPreviewable(mime)) {
        const w = window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
        if (!w) URL.revokeObjectURL(url);
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5_000);
      }
    } catch { /* silent */ }
  }

  /* ── Delete ──────────────────────────────────────────────────────────────── */
  async function deleteMaterial(id: number) {
    await api.delete(`/materials/${id}`, { headers });
    setMaterials(prev => prev.filter(m => m.id !== id));
    if (selected?.id === id) { setSelected(null); setShowQuizPanel(false); }
  }

  /* ── Toggle quiz question type ───────────────────────────────────────────── */
  function toggleType(t: QType) {
    setQuizTypes(prev =>
      prev.includes(t) ? (prev.length > 1 ? prev.filter(x => x !== t) : prev) : [...prev, t]
    );
  }

  /* ── Generate quiz ───────────────────────────────────────────────────────── */
  async function generateQuiz() {
    if (!selected) return;
    setGenerating(true);
    setGenError('');
    try {
      const { data } = await api.post<GeneratedQuiz>(
        `/materials/${selected.id}/generate-quiz`,
        { subject: quizSubject, difficulty: quizDiff, count: quizCount, question_types: quizTypes },
        { headers },
      );
      if (data.error) { setGenError(data.error); return; }
      setQuiz(data);
      setCurrentQ(0);
      setAnswers({});
      setPageView('quiz');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGenError(detail ?? 'Quiz generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  /* Derived quiz data */
  const questions = quiz?.questions ?? [];
  const objective = questions.filter(q => ['MCQ', 'true_false'].includes(q.type));
  const correct   = objective.filter(q => (answers[q.id] ?? '').toUpperCase() === q.correct_answer.toUpperCase()).length;
  const pct       = objective.length > 0 ? Math.round((correct / objective.length) * 100) : 0;

  const selAnalysis = selected ? analysisCache[selected.id] : null;
  const selStatus   = selected ? (analysisStatus[selected.id] ?? 'idle') : 'idle';
  const flashcards  = selAnalysis?.flashcards ?? [];
  const safeFc      = Math.max(0, Math.min(fcIndex, flashcards.length - 1));

  /* ═══════════════════════════════════════════════════════════════════════════
     QUIZ VIEW
  ═══════════════════════════════════════════════════════════════════════════ */
  if (pageView === 'quiz' && quiz) {
    const q       = questions[currentQ];
    const answered = Object.keys(answers).length;
    const pctDone  = Math.round((answered / questions.length) * 100);
    return (
      <div style={s.wrap}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' as const }}>
          <div>
            <p style={{ margin: '0 0 0.12rem', fontWeight: 800, fontSize: '0.9rem', color: 'rgba(226,232,240,0.9)' }}>
              {quiz.material_name}
            </p>
            <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(148,163,184,0.42)' }}>
              {questions.length} questions · {quiz.difficulty} · {quiz.question_types.join(', ')}
            </p>
          </div>
          <button onClick={() => setPageView('library')} style={s.outlineBtn}>← Back to Library</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctDone}%`, background: 'linear-gradient(90deg,#00D4FF,#7c3aed)', borderRadius: '99px', transition: 'width 0.3s' }} />
          </div>
          <span style={{ fontSize: '0.68rem', color: 'rgba(148,163,184,0.42)', fontWeight: 600, whiteSpace: 'nowrap' as const }}>
            {answered} / {questions.length}
          </span>
        </div>

        <QuizQuestionCard q={q} index={currentQ} total={questions.length}
          answer={answers[q.id]} onAnswer={a => setAnswers(p => ({ ...p, [q.id]: a }))} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setCurrentQ(c => Math.max(0, c - 1))} disabled={currentQ === 0}
            style={{ ...s.outlineBtn, opacity: currentQ === 0 ? 0.4 : 1 }}>← Prev</button>

          <div style={{ display: 'flex', gap: '0.22rem', flexWrap: 'wrap' as const, justifyContent: 'center' }}>
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrentQ(i)} style={{
                width: '26px', height: '26px', borderRadius: '50%', border: '1.5px solid',
                fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                background: i === currentQ ? 'rgba(0,212,255,0.18)' : answers[questions[i].id] !== undefined ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
                borderColor: i === currentQ ? 'rgba(0,212,255,0.5)' : answers[questions[i].id] !== undefined ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.09)',
                color: i === currentQ ? '#00D4FF' : answers[questions[i].id] !== undefined ? '#34d399' : 'rgba(148,163,184,0.45)',
              }}>{i + 1}</button>
            ))}
          </div>

          {currentQ < questions.length - 1
            ? <button onClick={() => setCurrentQ(c => c + 1)} style={s.primaryBtn}>Next →</button>
            : <button onClick={() => setPageView('results')} style={{ ...s.primaryBtn, background: 'linear-gradient(135deg,#10b981,#34d399)' }}>Submit ✓</button>
          }
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RESULTS VIEW
  ═══════════════════════════════════════════════════════════════════════════ */
  if (pageView === 'results' && quiz) {
    const sc = pct >= 75 ? '#34d399' : pct >= 50 ? '#fbbf24' : '#f87171';
    return (
      <div style={s.wrap}>
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
          <p style={{ margin: '0 0 0.4rem', fontSize: '2.8rem', fontWeight: 900, color: sc,
            textShadow: `0 0 28px ${sc}50` }}>{pct}%</p>
          <p style={{ margin: '0 0 0.25rem', fontWeight: 700, fontSize: '0.95rem', color: 'rgba(226,232,240,0.88)' }}>
            {pct >= 80 ? '🏆 Excellent!' : pct >= 65 ? '👍 Good Job!' : pct >= 50 ? '📖 Keep Practicing' : '💪 Need More Study'}
          </p>
          <p style={{ margin: '0 0 1.25rem', fontSize: '0.75rem', color: 'rgba(148,163,184,0.45)' }}>
            {correct} / {objective.length} correct
            {questions.length > objective.length && ` · ${questions.length - objective.length} subjective (self-review)`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', flexWrap: 'wrap' as const }}>
            <button onClick={() => { setCurrentQ(0); setAnswers({}); setPageView('quiz'); }} style={s.outlineBtn}>
              🔄 Retake Quiz
            </button>
            <button onClick={() => setPageView('library')} style={s.primaryBtn}>
              ← Back to Library
            </button>
          </div>
        </div>
        <p style={s.sectionHead}>📋 Review</p>
        {questions.map(q => <ReviewCard key={q.id} q={q} userAnswer={answers[q.id]} />)}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     LIBRARY VIEW
  ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div style={s.wrap}>

      {/* ── Upload Zone ── */}
      <div
        style={dragOver ? { ...s.dropZone, ...s.dropActive } : s.dropZone}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e: DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]); }}
        onClick={() => !uploading && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); }} />
        {uploading ? (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <p style={s.dropLabel}>Uploading… {uploadProgress}%</p>
            <div style={s.progTrack}><div style={{ ...s.progFill, width: `${uploadProgress}%` }} /></div>
          </div>
        ) : (
          <>
            <span style={{ fontSize: '1.5rem' }}>☁</span>
            <p style={s.dropLabel}>{dragOver ? 'Drop to upload' : 'Upload Study Material'}</p>
            <p style={s.dropHint}>PDF · DOCX · PPT · TXT · Images · max 20 MB · click or drag-and-drop</p>
          </>
        )}
      </div>
      {uploadError && <div style={s.errorMsg}>{uploadError}</div>}

      {/* ── Library header ── */}
      {!libLoading && (
        <div style={s.libHeader}>
          <input style={s.searchInput} placeholder="🔍  Search library…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <span style={s.libCount}>{filtered.length} file{filtered.length !== 1 ? 's' : ''}</span>
          {materials.length > 0 && (
            <button onClick={analyzeAll} disabled={!!analyzeAllProgress} style={{
              ...s.analyzeAllBtn, opacity: analyzeAllProgress ? 0.6 : 1,
              cursor: analyzeAllProgress ? 'wait' : 'pointer',
            }}>
              {analyzeAllProgress
                ? `⏳ ${analyzeAllProgress.done}/${analyzeAllProgress.total} analyzed…`
                : '🤖 Analyze All'}
            </button>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!libLoading && filtered.length === 0 && (
        <div style={s.emptyState}>
          <p style={{ fontSize: '2.2rem', margin: '0 0 0.6rem' }}>📂</p>
          <p style={s.emptyTitle}>{search ? 'No files match your search.' : 'Your study library is empty.'}</p>
          <p style={s.emptyHint}>
            {search
              ? 'Try a different search term.'
              : 'Upload and analyze study materials to unlock AI summaries, flashcards, revision notes, and automatic quiz generation.'}
          </p>
          {!search && (
            <button onClick={() => inputRef.current?.click()} style={{ ...s.primaryBtn, marginTop: '0.75rem' }}>
              + Upload Material
            </button>
          )}
        </div>
      )}

      {/* ── Material cards ── */}
      {filtered.length > 0 && (
        <div style={s.libGrid}>
          {filtered.map(m => {
            const st      = analysisStatus[m.id] ?? 'idle';
            const isActive = selected?.id === m.id;
            return (
              <div key={m.id} style={{
                ...s.matCard,
                borderColor: isActive ? 'rgba(0,212,255,0.42)' : 'rgba(255,255,255,0.07)',
                background:  isActive ? 'rgba(0,212,255,0.055)' : 'rgba(255,255,255,0.025)',
                boxShadow:   isActive ? '0 0 16px rgba(0,212,255,0.1)' : 'none',
              }}>
                {/* Info row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.35rem', flexShrink: 0 }}>{fileIcon(m.mime_type)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.matName}>{m.original_name}</p>
                    <p style={s.matMeta}>{fmtSize(m.file_size)} · {fmtDate(m.created_at)}</p>
                    {st === 'analyzing' && (
                      <div style={s.statusAnalyzing}>
                        <div style={s.miniSpinner} />
                        <span>Analyzing…</span>
                      </div>
                    )}
                    {st === 'done'  && <span style={s.statusDone}>✓ Analysis Complete</span>}
                    {st === 'error' && <span style={s.statusError}>✗ Failed — click Analyze to retry</span>}
                  </div>
                </div>

                {/* Action buttons */}
                <div style={s.matActions}>
                  <button
                    onClick={() => fetchAndOpen(m.id, m.original_name, m.mime_type, false)}
                    style={s.actionBtn} title="View file in browser">
                    👁 View
                  </button>

                  <button
                    onClick={() => {
                      if (st === 'done') {
                        setSelected(m); setATab('summary'); setFcIndex(0); setShowQuizPanel(false);
                      } else {
                        analyzeOne(m);
                      }
                    }}
                    disabled={st === 'analyzing'}
                    style={{
                      ...s.actionBtn,
                      background:  st === 'done' ? 'rgba(0,212,255,0.1)'   : 'rgba(99,102,241,0.09)',
                      borderColor: st === 'done' ? 'rgba(0,212,255,0.3)'   : 'rgba(99,102,241,0.28)',
                      color:       st === 'done' ? '#00D4FF'                : '#a78bfa',
                      opacity:     st === 'analyzing' ? 0.5 : 1,
                    }}
                    title={st === 'done' ? 'Open analysis panel' : 'Analyze with AI'}>
                    {st === 'done' ? '📋 Analysis' : st === 'analyzing' ? '⏳ …' : '🤖 Analyze'}
                  </button>

                  <button
                    onClick={() => fetchAndOpen(m.id, m.original_name, m.mime_type, true)}
                    style={s.actionBtn} title="Download file">
                    ↓ Download
                  </button>

                  <button onClick={() => deleteMaterial(m.id)}
                    style={{ ...s.actionBtn, color: 'rgba(239,68,68,0.55)', borderColor: 'rgba(239,68,68,0.18)', background: 'transparent' }}
                    title="Delete file">
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Analysis Panel ── */}
      {selected && (selStatus === 'analyzing' || selStatus === 'done' || selStatus === 'error') && (
        <div style={s.analysisPanel}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.analysisPanelTitle}>{fileIcon(selected.mime_type)} {selected.original_name}</p>
              <p style={s.analysisPanelMeta}>
                {selStatus === 'analyzing' && '⏳ Processing with AI…'}
                {selStatus === 'done'      && '✓ Analysis Complete — select a tab below'}
                {selStatus === 'error'     && '✗ Analysis failed'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
              {selStatus !== 'analyzing' && (
                <button onClick={() => analyzeOne(selected)} style={s.reAnalyzeBtn}>🔄 Re-analyze</button>
              )}
              <button onClick={() => { setSelected(null); setShowQuizPanel(false); }} style={s.closePanelBtn}>✕</button>
            </div>
          </div>

          {/* Spinner */}
          {selStatus === 'analyzing' && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: '10px' }}>
              <div style={s.spinner} />
              <div>
                <p style={{ margin: '0 0 0.15rem', fontSize: '0.8rem', fontWeight: 700, color: 'rgba(226,232,240,0.75)' }}>
                  AI is reading your document…
                </p>
                <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(148,163,184,0.4)' }}>
                  Generating summaries · flashcards · definitions · mind map · revision notes
                </p>
              </div>
            </div>
          )}

          {/* Analysis content */}
          {selStatus === 'done' && selAnalysis && !selAnalysis.error && (
            <>
              {/* Workflow indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' as const, padding: '0.45rem 0.7rem', background: 'rgba(255,255,255,0.025)', borderRadius: '9px' }}>
                {[
                  { icon: '☁',  label: 'Uploaded',     done: true  },
                  { icon: '🤖', label: 'Analyzed',      done: true  },
                  { icon: '📋', label: 'Review Content', done: false },
                  { icon: '🧠', label: 'Generate Quiz', done: false },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', fontSize: '0.58rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0, background: step.done ? '#10b981' : 'rgba(0,212,255,0.14)', color: step.done ? '#fff' : '#00D4FF', border: `1.5px solid ${step.done ? '#10b981' : 'rgba(0,212,255,0.35)'}` }}>
                      {step.done ? '✓' : step.icon}
                    </div>
                    <span style={{ fontSize: '0.6rem', fontWeight: 600, color: step.done ? '#34d399' : 'rgba(148,163,184,0.5)' }}>{step.label}</span>
                    {i < 3 && <span style={{ color: 'rgba(255,255,255,0.12)', fontSize: '0.6rem' }}>→</span>}
                  </div>
                ))}
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', gap: '0.22rem', flexWrap: 'wrap' as const, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.5rem' }}>
                {ANALYSIS_TABS.map(t => (
                  <button key={t.key} onClick={() => { setATab(t.key); setFcIndex(0); }} style={{
                    padding: '0.26rem 0.55rem', borderRadius: '7px', border: '1px solid',
                    fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    whiteSpace: 'nowrap' as const, transition: 'background 0.15s, color 0.15s',
                    background:  aTab === t.key ? 'rgba(0,212,255,0.12)' : 'transparent',
                    color:       aTab === t.key ? '#00D4FF' : 'rgba(148,163,184,0.5)',
                    borderColor: aTab === t.key ? 'rgba(0,212,255,0.35)' : 'transparent',
                  }}>{t.icon} {t.label}</button>
                ))}
              </div>

              {/* Tab panels */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

                {aTab === 'summary' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {selAnalysis.quick_summary && (
                      <div>
                        <p style={s.sectionHead}>⚡ Quick Summary</p>
                        <ul style={s.ul}>{selAnalysis.quick_summary.map((pt, i) => <li key={i} style={s.li}>{pt}</li>)}</ul>
                      </div>
                    )}
                    {selAnalysis.detailed_summary && (
                      <div>
                        <p style={s.sectionHead}>📄 Detailed Summary</p>
                        <p style={s.body}>{selAnalysis.detailed_summary}</p>
                      </div>
                    )}
                    {(selAnalysis.topics ?? []).length > 0 && (
                      <div>
                        <p style={s.sectionHead}>🏷 Main Topics</p>
                        <div style={s.chipRow}>{selAnalysis.topics!.map((t, i) => <span key={i} style={s.topicChip}>{t}</span>)}</div>
                      </div>
                    )}
                    {(selAnalysis.keywords ?? []).length > 0 && (
                      <div>
                        <p style={s.sectionHead}>🔑 Keywords</p>
                        <div style={s.chipRow}>{selAnalysis.keywords!.map((k, i) => <span key={i} style={s.kwChip}>{k}</span>)}</div>
                      </div>
                    )}
                    {(selAnalysis.important_concepts ?? []).length > 0 && (
                      <div>
                        <p style={s.sectionHead}>💡 Key Concepts</p>
                        <div style={s.chipRow}>{selAnalysis.important_concepts!.map((c, i) => <span key={i} style={s.conceptChip}>{c}</span>)}</div>
                      </div>
                    )}
                  </div>
                )}

                {aTab === 'chapters' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    {(selAnalysis.chapter_breakdown ?? []).length === 0
                      ? <p style={s.hint}>No chapter breakdown available.</p>
                      : selAnalysis.chapter_breakdown!.map((ch, i) => (
                          <div key={i} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}>
                            <p style={{ margin: '0 0 0.35rem', fontWeight: 800, fontSize: '0.82rem', color: 'rgba(226,232,240,0.88)' }}>{i + 1}. {ch.title}</p>
                            <p style={{ ...s.body, margin: '0 0 0.45rem' }}>{ch.summary}</p>
                            <ul style={s.ul}>{ch.key_points.map((pt, j) => <li key={j} style={s.li}>{pt}</li>)}</ul>
                          </div>
                        ))
                    }
                  </div>
                )}

                {aTab === 'flashcards' && (
                  flashcards.length === 0
                    ? <p style={s.hint}>No flashcards generated.</p>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        <Flashcard front={flashcards[safeFc].front} back={flashcards[safeFc].back} index={safeFc} total={flashcards.length} />
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
                          <button onClick={() => setFcIndex(i => Math.max(0, i - 1))} disabled={safeFc === 0} style={s.navBtn}>← Prev</button>
                          <button onClick={() => setFcIndex(i => Math.min(flashcards.length - 1, i + 1))} disabled={safeFc === flashcards.length - 1} style={s.navBtn}>Next →</button>
                        </div>
                      </div>
                )}

                {aTab === 'questions' && (
                  <div>
                    <p style={s.sectionHead}>❓ Important Questions</p>
                    {(selAnalysis.important_questions ?? []).length === 0
                      ? <p style={s.hint}>No questions generated.</p>
                      : <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                          {selAnalysis.important_questions!.map((q, i) => <li key={i} style={{ ...s.body, marginBottom: '0.5rem' }}>{q}</li>)}
                        </ol>
                    }
                  </div>
                )}

                {aTab === 'definitions' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.42rem' }}>
                    {(selAnalysis.key_definitions ?? []).length === 0
                      ? <p style={s.hint}>No definitions generated.</p>
                      : selAnalysis.key_definitions!.map((d, i) => (
                          <div key={i} style={{ padding: '0.55rem 0.8rem', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px' }}>
                            <p style={{ margin: '0 0 0.18rem', fontWeight: 800, fontSize: '0.8rem', color: '#fbbf24' }}>{d.term}</p>
                            <p style={{ margin: 0, fontSize: '0.76rem', color: 'rgba(226,232,240,0.68)', lineHeight: 1.5 }}>{d.definition}</p>
                          </div>
                        ))
                    }
                  </div>
                )}

                {aTab === 'exam' && (
                  <div>
                    <p style={s.sectionHead}>📝 Exam-Focused Notes</p>
                    <p style={s.body}>{selAnalysis.exam_notes ?? 'No exam notes generated.'}</p>
                  </div>
                )}

                {aTab === 'mindmap' && (
                  selAnalysis.mind_map ? <MindMap data={selAnalysis.mind_map} /> : <p style={s.hint}>No mind map generated.</p>
                )}

                {aTab === 'revision' && (
                  <div>
                    <p style={s.sectionHead}>🔄 Revision Notes</p>
                    <p style={s.body}>{selAnalysis.revision_notes ?? 'No revision notes generated.'}</p>
                  </div>
                )}
              </div>

              {/* ── Generate Quiz CTA ── */}
              {!showQuizPanel && (
                <button onClick={() => setShowQuizPanel(true)} style={s.generateQuizBtn}>
                  🧠 Generate Quiz from This Analysis
                </button>
              )}

              {/* ── Quiz Config Panel ── */}
              {showQuizPanel && (
                <div style={s.quizConfigPanel}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <div>
                      <p style={{ margin: '0 0 0.1rem', fontWeight: 800, fontSize: '0.88rem', color: 'rgba(226,232,240,0.9)' }}>🧠 Generate Quiz</p>
                      <p style={{ margin: 0, fontSize: '0.66rem', color: 'rgba(148,163,184,0.42)' }}>Quiz based on AI-analyzed content from this material</p>
                    </div>
                    <button onClick={() => setShowQuizPanel(false)} style={s.closePanelBtn}>✕</button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    <div>
                      <label style={s.configLabel}>Subject / Chapter (optional)</label>
                      <input type="text" placeholder="e.g. Chapter 3, Cardiac Physiology…"
                        value={quizSubject} onChange={e => setQuizSubject(e.target.value)}
                        style={s.configInput} />
                    </div>

                    <div>
                      <label style={s.configLabel}>Difficulty</label>
                      <div style={{ display: 'flex', gap: '0.32rem', flexWrap: 'wrap' as const }}>
                        {(['easy', 'medium', 'hard', 'mixed'] as Difficulty[]).map(d => (
                          <button key={d} onClick={() => setQuizDiff(d)} style={{
                            padding: '0.3rem 0.65rem', border: '1px solid', borderRadius: '8px',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 700,
                            borderColor: quizDiff === d ? DIFF_COLORS[d] : 'rgba(255,255,255,0.09)',
                            background:  quizDiff === d ? `${DIFF_COLORS[d]}18` : 'transparent',
                            color:       quizDiff === d ? DIFF_COLORS[d] : 'rgba(148,163,184,0.5)',
                            transition: 'all 0.15s',
                          }}>{d.charAt(0).toUpperCase() + d.slice(1)}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={s.configLabel}>Questions: <strong style={{ color: '#00D4FF' }}>{quizCount}</strong></label>
                      <input type="range" min={5} max={30} step={5} value={quizCount}
                        onChange={e => setQuizCount(Number(e.target.value))}
                        style={{ width: '100%', accentColor: '#00D4FF' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: 'rgba(148,163,184,0.3)', marginTop: '0.1rem' }}>
                        <span>5</span><span>15</span><span>30</span>
                      </div>
                    </div>

                    <div>
                      <label style={s.configLabel}>Question Types</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: '0.28rem' }}>
                        {Q_TYPE_OPTIONS.map(t => (
                          <button key={t.key} onClick={() => toggleType(t.key)} style={{
                            padding: '0.24rem 0.52rem', border: '1px solid', borderRadius: '7px',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.66rem', fontWeight: 700,
                            borderColor: quizTypes.includes(t.key) ? 'rgba(99,102,241,0.48)' : 'rgba(255,255,255,0.09)',
                            background:  quizTypes.includes(t.key) ? 'rgba(99,102,241,0.14)' : 'transparent',
                            color:       quizTypes.includes(t.key) ? '#a78bfa' : 'rgba(148,163,184,0.5)',
                            transition: 'all 0.15s',
                          }}>{t.label}</button>
                        ))}
                      </div>
                    </div>

                    {genError && <div style={s.errorMsg}>{genError}</div>}

                    <button onClick={generateQuiz} disabled={generating} style={{
                      ...s.primaryBtn, opacity: generating ? 0.6 : 1, cursor: generating ? 'wait' : 'pointer',
                    }}>
                      {generating ? '⏳ Generating…' : '✨ Generate Quiz'}
                    </button>

                    {generating && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={s.spinner} />
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(148,163,184,0.42)' }}>
                          Creating {quizCount} questions at {quizDiff} difficulty…
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  wrap:        { display: 'flex', flexDirection: 'column', gap: '0.88rem', padding: '1.1rem', maxWidth: '880px', margin: '0 auto' },
  dropZone: {
    border: '2px dashed rgba(0,212,255,0.22)', borderRadius: '14px',
    padding: '1.35rem 2rem', textAlign: 'center', cursor: 'pointer',
    background: 'rgba(0,212,255,0.025)', transition: 'border-color 0.2s, background 0.2s',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
  },
  dropActive:  { borderColor: 'rgba(0,212,255,0.65)', background: 'rgba(0,212,255,0.07)' },
  dropLabel:   { margin: 0, fontWeight: 700, color: 'rgba(226,232,240,0.8)', fontSize: '0.86rem' },
  dropHint:    { margin: 0, fontSize: '0.67rem', color: 'rgba(148,163,184,0.4)' },
  progTrack:   { width: '200px', height: '4px', background: 'rgba(255,255,255,0.09)', borderRadius: '99px', overflow: 'hidden', margin: '0.4rem auto' },
  progFill:    { height: '100%', background: '#00D4FF', borderRadius: '99px', transition: 'width 0.1s' },
  errorMsg:    { padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.28)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.78rem' },
  libHeader:   { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' as const },
  searchInput: { flex: 1, padding: '0.46rem 0.78rem', minWidth: '160px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', color: 'var(--text-h)', fontSize: '0.8rem', fontFamily: 'inherit', outline: 'none' },
  libCount:    { fontSize: '0.66rem', color: 'rgba(148,163,184,0.38)', whiteSpace: 'nowrap' as const },
  analyzeAllBtn: { padding: '0.4rem 0.88rem', background: 'rgba(99,102,241,0.11)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '9px', color: '#a78bfa', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const, transition: 'opacity 0.18s' },
  emptyState:  { textAlign: 'center', padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  emptyTitle:  { margin: '0 0 0.4rem', fontWeight: 700, fontSize: '0.9rem', color: 'rgba(226,232,240,0.65)' },
  emptyHint:   { margin: 0, fontSize: '0.76rem', color: 'rgba(148,163,184,0.4)', lineHeight: 1.55, maxWidth: '400px' },
  libGrid:     { display: 'flex', flexDirection: 'column', gap: '0.38rem' },
  matCard:     { display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.7rem 0.88rem', borderRadius: '12px', border: '1px solid', transition: 'border-color 0.18s, background 0.18s, box-shadow 0.18s' },
  matName:     { margin: '0 0 0.1rem', fontSize: '0.79rem', fontWeight: 700, color: 'rgba(226,232,240,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  matMeta:     { margin: 0, fontSize: '0.62rem', color: 'rgba(148,163,184,0.4)' },
  statusAnalyzing: { display: 'flex', alignItems: 'center', gap: '0.28rem', marginTop: '0.18rem', fontSize: '0.6rem', color: '#fbbf24', fontWeight: 700 },
  miniSpinner: { width: '9px', height: '9px', border: '1.5px solid rgba(251,191,36,0.3)', borderTopColor: '#fbbf24', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 },
  statusDone:  { display: 'inline-block', marginTop: '0.18rem', fontSize: '0.6rem', fontWeight: 700, color: '#34d399' },
  statusError: { display: 'inline-block', marginTop: '0.18rem', fontSize: '0.6rem', fontWeight: 700, color: '#f87171' },
  matActions:  { display: 'flex', gap: '0.28rem', flexWrap: 'wrap' as const },
  actionBtn:   { padding: '0.22rem 0.52rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '7px', color: 'rgba(148,163,184,0.65)', fontSize: '0.66rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  analysisPanel: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '16px', padding: '1.05rem', display: 'flex', flexDirection: 'column', gap: '0.82rem' },
  analysisPanelTitle: { margin: '0 0 0.12rem', fontWeight: 700, fontSize: '0.84rem', color: 'rgba(226,232,240,0.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  analysisPanelMeta:  { margin: 0, fontSize: '0.63rem', color: 'rgba(148,163,184,0.45)' },
  reAnalyzeBtn: { padding: '0.26rem 0.62rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '7px', color: 'rgba(148,163,184,0.6)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  closePanelBtn:{ padding: '0.24rem 0.48rem', background: 'transparent', border: 'none', color: 'rgba(148,163,184,0.38)', fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit', borderRadius: '6px' },
  spinner:     { width: '18px', height: '18px', border: '2.5px solid rgba(0,212,255,0.15)', borderTopColor: '#00D4FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0, marginTop: '2px' },
  sectionHead: { margin: '0 0 0.4rem', fontSize: '0.7rem', fontWeight: 800, color: '#00D4FF', letterSpacing: '0.05em', textTransform: 'uppercase' as const },
  body:        { margin: 0, fontSize: '0.81rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.6 },
  hint:        { margin: 0, fontSize: '0.75rem', color: 'rgba(148,163,184,0.4)', textAlign: 'center' as const },
  ul:          { margin: 0, paddingLeft: '1.1rem' },
  li:          { fontSize: '0.79rem', color: 'rgba(226,232,240,0.7)', lineHeight: 1.55, marginBottom: '0.26rem' },
  chipRow:     { display: 'flex', flexWrap: 'wrap' as const, gap: '0.28rem' },
  topicChip:   { padding: '0.16rem 0.48rem', borderRadius: '99px', fontSize: '0.63rem', fontWeight: 700, background: 'rgba(0,212,255,0.09)', border: '1px solid rgba(0,212,255,0.22)', color: '#00D4FF' },
  kwChip:      { padding: '0.16rem 0.48rem', borderRadius: '99px', fontSize: '0.63rem', fontWeight: 700, background: 'rgba(99,102,241,0.09)', border: '1px solid rgba(99,102,241,0.22)', color: '#a78bfa' },
  conceptChip: { padding: '0.16rem 0.48rem', borderRadius: '99px', fontSize: '0.63rem', fontWeight: 700, background: 'rgba(16,185,129,0.09)', border: '1px solid rgba(16,185,129,0.22)', color: '#34d399' },
  navBtn:      { padding: '0.36rem 0.85rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '8px', color: 'rgba(148,163,184,0.62)', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  generateQuizBtn: { padding: '0.62rem 1.2rem', border: '1px solid rgba(99,102,241,0.38)', borderRadius: '12px', background: 'rgba(99,102,241,0.1)', color: '#c4b5fd', fontWeight: 800, fontSize: '0.86rem', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const, boxShadow: '0 0 18px rgba(99,102,241,0.12)', transition: 'opacity 0.2s' },
  quizConfigPanel: { padding: '1rem', background: 'rgba(99,102,241,0.055)', border: '1px solid rgba(99,102,241,0.22)', borderRadius: '14px' },
  configLabel: { display: 'block', fontSize: '0.68rem', fontWeight: 700, color: 'rgba(148,163,184,0.52)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: '0.32rem' },
  configInput: { width: '100%', padding: '0.46rem 0.78rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '9px', color: 'var(--text-h)', fontSize: '0.81rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const },
  primaryBtn:  { padding: '0.58rem 1.25rem', border: 'none', borderRadius: '10px', background: 'linear-gradient(135deg,#00D4FF,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: '0.84rem', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(0,212,255,0.2)', transition: 'opacity 0.2s' },
  outlineBtn:  { padding: '0.48rem 0.95rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', color: 'rgba(148,163,184,0.7)', fontSize: '0.77rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
};
