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

interface PaperAnalysis {
  material_id: number;
  material_name: string;
  exam_pattern?: string;
  total_marks?: number;
  total_time?: string;
  total_questions?: number;
  marks_distribution?: { section: string; total_marks: number; questions_count: number; marks_per_question: number }[];
  section_structure?: { section: string; title: string; question_type: string; instructions: string }[];
  question_types?: string[];
  difficulty_level?: string;
  difficulty_distribution?: { easy: number; medium: number; hard: number };
  topic_weightage?: { topic: string; percentage: number; questions_count: number }[];
  frequently_repeated_topics?: string[];
  question_format?: string;
  assessment_style?: string;
  error?: string;
}

interface GeneratedPaper {
  title: string;
  difficulty: string;
  total_marks: number;
  total_time: string;
  instructions: string;
  sections: {
    section: string;
    title: string;
    instructions: string;
    questions: {
      number: number;
      question: string;
      type: string;
      options?: string[];
      marks: number;
    }[];
  }[];
  material_id?: number;
  error?: string;
}

type Step = 'select' | 'analyze' | 'generate';
type Difficulty = 'same' | 'easier' | 'harder' | 'mixed';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function fileIcon(mime: string) {
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('text/')) return '📝';
  if (mime.includes('word')) return '📘';
  if (mime.includes('presentation')) return '📊';
  return '📎';
}
function fmtSize(b: number) {
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.docx,.doc';

const DIFF_OPTIONS: { value: Difficulty; label: string; desc: string; color: string }[] = [
  { value: 'same',   label: 'Same Difficulty', desc: 'Match the original',       color: '#00D4FF' },
  { value: 'easier', label: 'Easier',           desc: 'Simpler questions',         color: '#34d399' },
  { value: 'harder', label: 'Harder',           desc: 'More challenging',          color: '#f59e0b' },
  { value: 'mixed',  label: 'Mixed',            desc: '30% easy · 50% med · 20% hard', color: '#a78bfa' },
];

export default function PaperAnalyzer() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const inputRef = useRef<HTMLInputElement>(null);

  const [materials,   setMaterials]   = useState<Material[]>([]);
  const [libLoading,  setLibLoading]  = useState(true);
  const [selected,    setSelected]    = useState<Material | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const [upProgress,  setUpProgress]  = useState(0);
  const [dragOver,    setDragOver]    = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [analysis,    setAnalysis]    = useState<PaperAnalysis | null>(null);
  const [analyzing,   setAnalyzing]   = useState(false);

  const [difficulty,  setDifficulty]  = useState<Difficulty>('same');
  const [generated,   setGenerated]   = useState<GeneratedPaper | null>(null);
  const [generating,  setGenerating]  = useState(false);
  const [step,        setStep]        = useState<Step>('select');

  useEffect(() => {
    api.get<Material[]>('/materials', { headers })
      .then(r => setMaterials(r.data))
      .finally(() => setLibLoading(false));
  }, []);

  async function uploadFile(file: File) {
    setUploadError('');
    setUploading(true);
    setUpProgress(0);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<Material>('/materials', form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setUpProgress(Math.round((e.loaded * 100) / (e.total ?? e.loaded))),
      });
      setMaterials(prev => [data, ...prev]);
      setSelected(data);
      setStep('analyze');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUploadError(detail ?? 'Upload failed.');
    } finally {
      setUploading(false);
      setUpProgress(0);
    }
  }

  async function analyzeSelected() {
    if (!selected) return;
    setAnalyzing(true);
    setAnalysis(null);
    setGenerated(null);
    try {
      const { data } = await api.post<PaperAnalysis>(`/materials/${selected.id}/analyze-paper`, {}, { headers });
      setAnalysis(data);
      setStep('generate');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setAnalysis({ material_id: selected.id, material_name: selected.original_name, error: detail ?? 'Analysis failed.' });
    } finally {
      setAnalyzing(false);
    }
  }

  async function generatePaper() {
    if (!selected || !analysis) return;
    setGenerating(true);
    setGenerated(null);
    try {
      const { data } = await api.post<GeneratedPaper>(
        `/materials/${selected.id}/generate-paper`,
        { analysis, difficulty },
        { headers },
      );
      setGenerated(data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setGenerated({ title: 'Error', difficulty, total_marks: 0, total_time: '', instructions: '', sections: [], error: detail ?? 'Generation failed.' });
    } finally {
      setGenerating(false);
    }
  }

  function printPaper() {
    const win = window.open('', '_blank');
    if (!win || !generated) return;
    win.document.write(`<html><head><title>${generated.title}</title>
<style>body{font-family:Georgia,serif;max-width:750px;margin:0 auto;padding:2rem;color:#111}
h1{font-size:1.3rem;text-align:center;margin-bottom:0.25rem}
.meta{text-align:center;color:#555;font-size:0.85rem;margin-bottom:1.5rem}
.section-head{font-weight:bold;margin-top:1.5rem;border-bottom:1px solid #ccc;padding-bottom:0.25rem}
.q{margin:0.6rem 0;}.opt{margin-left:1.5rem;font-size:0.9rem;}.marks{float:right;color:#555;font-size:0.85rem}
@media print{@page{margin:1.5cm}}</style></head><body>
<h1>${generated.title}</h1>
<div class="meta">Time: ${generated.total_time} | Total Marks: ${generated.total_marks} | Difficulty: ${generated.difficulty}</div>
<p><strong>Instructions:</strong> ${generated.instructions}</p>
${(generated.sections ?? []).map(sec => `
<div class="section-head">Section ${sec.section}: ${sec.title}</div>
<p><em>${sec.instructions}</em></p>
${sec.questions.map(q => `
<div class="q"><strong>Q${q.number}.</strong> <span class="marks">[${q.marks} mark${q.marks > 1 ? 's' : ''}]</span> ${q.question}
${(q.options ?? []).map(o => `<div class="opt">${o}</div>`).join('')}
</div>`).join('')}`).join('')}
</body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div style={s.wrap}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <p style={s.pageTitle}>📄 Question Paper Analyzer</p>
          <p style={s.pageSub}>Upload an exam paper → AI analyzes the pattern → Generate a new paper</p>
        </div>
      </div>

      {/* ── Step indicator ── */}
      <div style={s.steps}>
        {(['select', 'analyze', 'generate'] as Step[]).map((st, i) => {
          const labels = ['1. Select Paper', '2. Analyze', '3. Generate'];
          const active = step === st;
          const done = (step === 'analyze' && i === 0) || (step === 'generate' && i <= 1);
          return (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800,
                background: done ? '#10b981' : active ? 'rgba(0,212,255,0.2)' : 'var(--border)',
                border: `1.5px solid ${done ? '#10b981' : active ? 'rgba(0,212,255,0.5)' : 'var(--border)'}`,
                color: done ? '#fff' : active ? '#00D4FF' : 'var(--text)',
              }}>{done ? '✓' : i + 1}</div>
              <span style={{ fontSize: '0.72rem', fontWeight: active ? 700 : 500,
                color: active ? '#00D4FF' : done ? '#34d399' : 'var(--text)' }}>
                {labels[i]}
              </span>
              {i < 2 && <span style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>→</span>}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Select / Upload ── */}
      {step === 'select' && (
        <div style={s.card}>
          <p style={s.cardTitle}>Upload or select a question paper</p>
          <div
            style={dragOver ? { ...s.dropZone, ...s.dropActive } : s.dropZone}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e: DragEvent) => { e.preventDefault(); setDragOver(false); uploadFile(e.dataTransfer.files[0]); }}
            onClick={() => !uploading && inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); }} />
            {uploading ? (
              <>
                <p style={s.dropLabel}>Uploading… {upProgress}%</p>
                <div style={s.progTrack}><div style={{ ...s.progFill, width: `${upProgress}%` }} /></div>
              </>
            ) : (
              <>
                <span style={{ fontSize: '1.6rem' }}>📤</span>
                <p style={s.dropLabel}>{dragOver ? 'Drop your paper here' : 'Upload Question Paper'}</p>
                <p style={s.dropHint}>PDF, DOCX, or image · max 20 MB</p>
              </>
            )}
          </div>
          {uploadError && <p style={s.error}>{uploadError}</p>}

          {/* Or pick from library */}
          {!libLoading && materials.length > 0 && (
            <>
              <p style={s.orDivider}>— or select from library —</p>
              <div style={s.libList}>
                {materials.map(m => (
                  <div key={m.id} style={s.libItem}
                    onClick={() => { setSelected(m); setStep('analyze'); }}>
                    <span style={{ fontSize: '1.2rem' }}>{fileIcon(m.mime_type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={s.libName}>{m.original_name}</p>
                      <p style={s.libMeta}>{fmtSize(m.file_size)}</p>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#00D4FF' }}>Select →</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Analyze ── */}
      {step === 'analyze' && selected && (
        <div style={s.card}>
          <div style={s.selectedRow}>
            <span style={{ fontSize: '1.3rem' }}>{fileIcon(selected.mime_type)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={s.matName}>{selected.original_name}</p>
              <p style={s.matMeta}>{fmtSize(selected.file_size)}</p>
            </div>
            <button onClick={() => { setSelected(null); setStep('select'); setAnalysis(null); }} style={s.changeBtn}>
              Change
            </button>
          </div>

          <button onClick={analyzeSelected} disabled={analyzing} style={{ ...s.primaryBtn, opacity: analyzing ? 0.6 : 1 }}>
            {analyzing ? '⏳ Analyzing paper pattern…' : '🤖 Analyze Paper Pattern'}
          </button>

          {analyzing && (
            <div style={s.loadingRow}>
              <div style={s.spinner} />
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>
                AI is reading the exam structure, marks distribution, and topic weightage…
              </p>
            </div>
          )}

          {analysis?.error && <p style={s.error}>{analysis.error}</p>}
        </div>
      )}

      {/* ── Step 3: Analysis results + Generate ── */}
      {step === 'generate' && analysis && !analysis.error && (
        <>
          {/* Analysis results */}
          <div style={s.card}>
            <p style={s.cardTitle}>📊 Paper Analysis: {analysis.material_name}</p>

            {/* Stats row */}
            <div style={s.statsRow}>
              {[
                { label: 'Total Marks', value: analysis.total_marks ?? '—' },
                { label: 'Time',         value: analysis.total_time ?? '—' },
                { label: 'Questions',    value: analysis.total_questions ?? '—' },
                { label: 'Difficulty',   value: analysis.difficulty_level ?? '—' },
              ].map(stat => (
                <div key={stat.label} style={s.statBox}>
                  <p style={s.statVal}>{stat.value}</p>
                  <p style={s.statLabel}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Exam pattern */}
            {analysis.exam_pattern && (
              <div style={s.infoBlock}>
                <p style={s.infoHead}>📋 Exam Pattern</p>
                <p style={s.infoBody}>{analysis.exam_pattern}</p>
              </div>
            )}

            {/* Section structure */}
            {(analysis.section_structure ?? []).length > 0 && (
              <div style={s.infoBlock}>
                <p style={s.infoHead}>📑 Section Structure</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {analysis.section_structure!.map((sec, i) => (
                    <div key={i} style={s.secRow}>
                      <span style={s.secBadge}>§ {sec.section}</span>
                      <div>
                        <p style={{ margin: '0 0 0.15rem', fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-h)' }}>
                          {sec.title} <span style={{ fontWeight: 500, color: '#a78bfa' }}>({sec.question_type})</span>
                        </p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text)' }}>{sec.instructions}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Marks distribution */}
            {(analysis.marks_distribution ?? []).length > 0 && (
              <div style={s.infoBlock}>
                <p style={s.infoHead}>📊 Marks Distribution</p>
                <table style={s.table}>
                  <thead>
                    <tr>{['Section', 'Questions', 'Marks/Q', 'Total'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {analysis.marks_distribution!.map((row, i) => (
                      <tr key={i}>
                        <td style={s.td}>{row.section}</td>
                        <td style={s.td}>{row.questions_count}</td>
                        <td style={s.td}>{row.marks_per_question}</td>
                        <td style={{ ...s.td, fontWeight: 700, color: '#fbbf24' }}>{row.total_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Topic weightage */}
            {(analysis.topic_weightage ?? []).length > 0 && (
              <div style={s.infoBlock}>
                <p style={s.infoHead}>⚖️ Topic Weightage</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {analysis.topic_weightage!.map((tw, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{tw.topic}</span>
                        <span style={{ fontSize: '0.7rem', color: '#00D4FF', fontWeight: 700 }}>{tw.percentage}%</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${tw.percentage}%`, background: 'linear-gradient(90deg, #00D4FF, #7c3aed)', borderRadius: '99px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Frequently repeated topics */}
            {(analysis.frequently_repeated_topics ?? []).length > 0 && (
              <div style={s.infoBlock}>
                <p style={s.infoHead}>🔁 Frequently Repeated Topics</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {analysis.frequently_repeated_topics!.map((t, i) => (
                    <span key={i} style={s.repeatChip}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Assessment style */}
            {analysis.assessment_style && (
              <div style={s.infoBlock}>
                <p style={s.infoHead}>🎯 Assessment Style</p>
                <p style={s.infoBody}>{analysis.assessment_style}</p>
              </div>
            )}
          </div>

          {/* Generate panel */}
          <div style={s.card}>
            <p style={s.cardTitle}>🤖 Generate Similar Paper</p>
            <p style={s.cardSub}>Choose difficulty and generate a brand-new question paper following the same structure.</p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {DIFF_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDifficulty(opt.value)}
                  style={{
                    ...s.diffBtn,
                    borderColor: difficulty === opt.value ? opt.color : 'var(--border)',
                    background:  difficulty === opt.value ? `${opt.color}18` : 'transparent',
                    color:       difficulty === opt.value ? opt.color : '#475569',
                  }}
                >
                  <span style={{ fontWeight: 800, display: 'block', fontSize: '0.78rem' }}>{opt.label}</span>
                  <span style={{ fontSize: '0.62rem', opacity: 0.7 }}>{opt.desc}</span>
                </button>
              ))}
            </div>

            <button onClick={generatePaper} disabled={generating}
              style={{ ...s.primaryBtn, opacity: generating ? 0.6 : 1 }}>
              {generating ? '⏳ Generating paper…' : '✨ Generate New Question Paper'}
            </button>

            {generating && (
              <div style={s.loadingRow}>
                <div style={s.spinner} />
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#475569' }}>
                  AI is creating brand-new questions following the same format…
                </p>
              </div>
            )}
          </div>

          {/* Generated paper */}
          {generated && !generated.error && (
            <div style={s.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <p style={s.cardTitle}>{generated.title}</p>
                  <p style={s.cardSub}>
                    Time: {generated.total_time} · Marks: {generated.total_marks} · Difficulty: {generated.difficulty}
                  </p>
                </div>
                <button onClick={printPaper} style={s.printBtn}>🖨 Print / Download</button>
              </div>

              {generated.instructions && (
                <div style={s.instrBox}>
                  <strong>Instructions:</strong> {generated.instructions}
                </div>
              )}

              {(generated.sections ?? []).map((sec, si) => (
                <div key={si} style={{ marginTop: '1.25rem' }}>
                  <p style={s.secHead}>Section {sec.section}: {sec.title}</p>
                  {sec.instructions && <p style={s.secInstr}>{sec.instructions}</p>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {sec.questions.map(q => (
                      <div key={q.number} style={s.qBox}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={s.qNum}>Q{q.number}</span>
                          <span style={s.qMarks}>[{q.marks} mark{q.marks > 1 ? 's' : ''}]</span>
                        </div>
                        <p style={s.qText}>{q.question}</p>
                        {(q.options ?? []).length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.35rem' }}>
                            {q.options!.map((opt, oi) => (
                              <p key={oi} style={s.qOpt}>{opt}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {generated?.error && <p style={s.error}>{generated.error}</p>}
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem', maxWidth: '860px', margin: '0 auto' },
  header: { paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' },
  pageTitle: { margin: '0 0 0.2rem', fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-h)' },
  pageSub:   { margin: 0, fontSize: '0.75rem', color: 'var(--text)' },
  steps: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' as const },
  card: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem',
  },
  cardTitle: { margin: 0, fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-h)' },
  cardSub:   { margin: 0, fontSize: '0.74rem', color: 'var(--text)' },
  dropZone: {
    border: '2px dashed rgba(0,212,255,0.22)', borderRadius: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
    padding: '1.5rem', textAlign: 'center', cursor: 'pointer',
    background: 'rgba(0,212,255,0.03)', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '0.4rem', transition: 'border-color 0.2s, background 0.2s',
  },
  dropActive: { borderColor: 'rgba(0,212,255,0.6)', background: 'rgba(0,212,255,0.08)' },
  dropLabel:  { margin: 0, fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' },
  dropHint:   { margin: 0, fontSize: '0.7rem', color: 'var(--text)' },
  progTrack:  { width: '200px', height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', margin: '0.3rem auto' },
  progFill:   { height: '100%', background: '#00D4FF', borderRadius: '99px', transition: 'width 0.1s' },
  error:      { padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.8rem', margin: 0 },
  orDivider:  { textAlign: 'center', fontSize: '0.72rem', color: 'var(--text)', margin: '0.25rem 0' },
  libList:    { display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '220px', overflowY: 'auto' },
  libItem: {
    display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.75rem',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s',
  },
  libName:    { margin: '0 0 0.1rem', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  libMeta:    { margin: 0, fontSize: '0.63rem', color: 'var(--text)' },
  selectedRow:{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '10px' },
  matName:    { margin: '0 0 0.1rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-h)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  matMeta:    { margin: 0, fontSize: '0.65rem', color: 'var(--text)' },
  changeBtn: {
    padding: '0.3rem 0.7rem', background: 'transparent', border: '1px solid var(--border)',
    borderRadius: '7px', color: '#475569', fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit',
  },
  primaryBtn: {
    padding: '0.65rem 1.4rem', border: 'none', borderRadius: '10px',
    background: 'linear-gradient(135deg, #00D4FF, #7c3aed)',
    color: '#fff', fontWeight: 800, fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 16px rgba(0,212,255,0.25)', transition: 'opacity 0.2s',
  },
  loadingRow: { display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.65rem', background: 'var(--bg-elevated)', borderRadius: '10px' },
  spinner: { width: '18px', height: '18px', border: '2px solid rgba(0,212,255,0.15)', borderTopColor: '#00D4FF', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 },
  statsRow:   { display: 'flex', flexWrap: 'wrap' as const, gap: '0.5rem' },
  statBox: {
    flex: '1 1 80px', padding: '0.6rem 0.75rem', textAlign: 'center',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px',
  },
  statVal:    { margin: '0 0 0.15rem', fontWeight: 900, fontSize: '1rem', color: '#00D4FF' },
  statLabel:  { margin: 0, fontSize: '0.62rem', color: 'var(--text)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600 },
  infoBlock:  { padding: '0.75rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px' },
  infoHead:   { margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 800, color: '#00D4FF', textTransform: 'uppercase' as const, letterSpacing: '0.06em' },
  infoBody:   { margin: 0, fontSize: '0.82rem', color: 'var(--text-m)', lineHeight: 1.6 },
  secRow:     { display: 'flex', alignItems: 'flex-start', gap: '0.6rem' },
  secBadge:   { padding: '0.15rem 0.45rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 800, color: '#a78bfa', flexShrink: 0 },
  table:      { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.77rem' },
  th:         { padding: '0.35rem 0.5rem', textAlign: 'left' as const, color: 'var(--text)', fontWeight: 700, borderBottom: '1px solid var(--border)', fontSize: '0.68rem', textTransform: 'uppercase' as const },
  td:         { padding: '0.35rem 0.5rem', color: 'var(--text)', borderBottom: '1px solid #f8fafc' },
  repeatChip: { padding: '0.18rem 0.5rem', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700, color: '#fbbf24' },
  diffBtn: {
    flex: '1 1 110px', padding: '0.55rem 0.7rem', border: '1.5px solid',
    borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center' as const,
    transition: 'border-color 0.2s, background 0.2s, color 0.2s',
  },
  printBtn: {
    padding: '0.45rem 1rem', background: 'var(--border)', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  instrBox: { padding: '0.65rem', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: '8px', fontSize: '0.78rem', color: 'var(--text-m)', lineHeight: 1.5 },
  secHead:  { margin: '0 0 0.25rem', fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-h)', paddingBottom: '0.3rem', borderBottom: '1px solid var(--border)' },
  secInstr: { margin: '0 0 0.6rem', fontSize: '0.72rem', color: 'var(--text)', fontStyle: 'italic' },
  qBox: { padding: '0.65rem 0.85rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '10px' },
  qNum:   { fontSize: '0.72rem', fontWeight: 800, color: '#7c3aed', background: 'rgba(124,58,237,0.12)', padding: '0.1rem 0.4rem', borderRadius: '6px' },
  qMarks: { fontSize: '0.68rem', color: 'var(--text)', fontWeight: 600 },
  qText:  { margin: '0.1rem 0 0', fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.5 },
  qOpt:   { margin: '0 0 0 0.75rem', fontSize: '0.77rem', color: 'var(--text-m)' },
};
