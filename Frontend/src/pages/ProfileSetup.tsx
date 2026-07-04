import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const LEARNING_PREFS = [
  'Visual (diagrams & charts)',
  'Reading / Writing',
  'Practice problems',
  'Video lectures',
  'Group study',
  'Self-paced',
];

const SEMESTER_GROUPS: { label: string; options: string[] }[] = [
  {
    label: 'School Students · Class 1 to 12',
    options: Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
  },
  {
    label: 'Undergraduate College · Semester 1–8 or Year 1–4',
    options: [
      'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
      'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8',
      'Year 1', 'Year 2', 'Year 3', 'Year 4',
    ],
  },
  {
    label: 'Postgraduate · PG Semester or PG Year',
    options: ['PG Semester 1', 'PG Semester 2', 'PG Semester 3', 'PG Semester 4', 'PG Year 1', 'PG Year 2'],
  },
  {
    label: 'Doctoral / PhD · PhD Year 1 to 5',
    options: Array.from({ length: 5 }, (_, i) => `PhD Year ${i + 1}`),
  },
  {
    label: 'Professional Courses · Module (NPTEL, CA) or Level (AWS, certs)',
    options: [
      'Module 1', 'Module 2', 'Module 3', 'Module 4', 'Module 5', 'Module 6',
      'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5',
    ],
  },
  {
    label: 'Online / Self Learning · Beginner to Advanced',
    options: ['Beginner Level', 'Intermediate Level', 'Advanced Level', 'Self-paced'],
  },
  {
    label: 'Other',
    options: ['Not Applicable'],
  },
];

const GUIDE_ITEMS = [
  { emoji: '', cat: 'School Students', hint: 'Select Class 1–12' },
  { emoji: '', cat: 'College Students', hint: 'Select Semester 1–8 or Year 1–4' },
  { emoji: '', cat: 'Postgraduate', hint: 'Select PG Semester or PG Year' },
  { emoji: '', cat: 'PhD / Doctoral', hint: 'Select PhD Year' },
  { emoji: '', cat: 'Professional Courses', hint: 'Module → NPTEL, Coursera, CA  ·  Level → AWS, language, certs' },
  { emoji: '', cat: 'Self Learning', hint: 'Select Beginner, Intermediate, or Advanced' },
  { emoji: '', cat: 'Not sure?', hint: 'Select Not Applicable' },
];

const COURSE_SUGGESTIONS = [
  // Engineering & Technology
  'B.Tech', 'M.Tech', 'B.E.', 'Diploma Engineering', 'Polytechnic',
  'BCA', 'MCA', 'B.Sc Computer Science', 'M.Sc Computer Science',
  'Data Science', 'Artificial Intelligence', 'Cyber Security',
  'Software Engineering', 'Information Technology',
  // Medical & Healthcare
  'MBBS', 'BDS', 'BAMS', 'BHMS', 'BPT', 'B.Sc Nursing', 'GNM Nursing',
  'M.Sc Nursing', 'MD', 'MS', 'DNB', 'B.Pharm', 'M.Pharm', 'Public Health',
  // Management & Business
  'BBA', 'MBA', 'Executive MBA', 'PGDM',
  'Finance', 'Marketing', 'Human Resources', 'Operations Management', 'Entrepreneurship',
  // Law
  'LLB', 'LLM', 'Integrated Law', 'Corporate Law', 'Criminal Law',
  'Constitutional Law', 'Intellectual Property Law',
  // Commerce & Finance
  'B.Com', 'M.Com', 'Chartered Accountancy (CA)', 'Company Secretary (CS)',
  'CMA', 'Banking & Finance', 'Financial Analysis',
  // Arts & Humanities
  'BA', 'MA', 'Literature', 'History', 'Political Science',
  'Sociology', 'Psychology', 'Philosophy', 'Languages',
  // Science
  'B.Sc', 'M.Sc', 'Physics', 'Chemistry', 'Mathematics', 'Statistics',
  'Biotechnology', 'Microbiology', 'Environmental Science',
  // Education
  'B.Ed', 'M.Ed', 'Teaching', 'Educational Leadership',
  // Architecture & Design
  'B.Arch', 'M.Arch', 'Interior Design', 'Graphic Design',
  'Product Design', 'UI/UX Design', 'Fashion Design',
  // Agriculture & Allied Sciences
  'B.Sc Agriculture', 'Agricultural Engineering', 'Horticulture', 'Forestry', 'Veterinary Science',
  // Media & Communication
  'Journalism', 'Mass Communication', 'Public Relations', 'Digital Media', 'Film Studies',
  // Hospitality & Tourism
  'Hotel Management', 'Tourism Management', 'Event Management',
  // Vocational & Skill-Based
  'ITI', 'Electrician', 'Mechanic', 'Welding', 'Carpentry',
  // Research & Academia
  'M.Phil', 'PhD', 'Research Scholar',
  // Others
  'School', 'Open Schooling', 'Distance Education',
  'Professional Certification', 'Bootcamp', 'Self Learning',
];

export default function ProfileSetup() {
  const { token, studentProfile, refreshStudentProfile } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };

  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [semester, setSemester] = useState('');
  const [academicGoals, setAcademicGoals] = useState('');
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const guideRef = useRef<HTMLDivElement>(null);

  const isEditing = !!studentProfile;

  useEffect(() => {
    if (!showGuide) return;
    function handleClickOutside(e: MouseEvent) {
      if (guideRef.current && !guideRef.current.contains(e.target as Node)) {
        setShowGuide(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGuide]);

  // Pre-fill if editing existing profile
  useEffect(() => {
    if (studentProfile) {
      setInstitution(studentProfile.institution);
      setCourse(studentProfile.course);
      setSemester(studentProfile.semester);
      setAcademicGoals(studentProfile.academic_goals);
      setSelectedPrefs(
        studentProfile.learning_preferences
          ? studentProfile.learning_preferences.split(',').map(s => s.trim()).filter(Boolean)
          : []
      );
      setSubjects(studentProfile.subjects ?? []);
    }
  }, [studentProfile]);

  function togglePref(pref: string) {
    setSelectedPrefs(prev =>
      prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
    );
  }

  function addSubject() {
    const val = subjectInput.trim();
    if (val && !subjects.includes(val)) {
      setSubjects(prev => [...prev, val]);
    }
    setSubjectInput('');
  }

  function removeSubject(sub: string) {
    setSubjects(prev => prev.filter(s => s !== sub));
  }

  function handleSubjectKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSubject();
    } else if (e.key === 'Backspace' && subjectInput === '' && subjects.length > 0) {
      setSubjects(prev => prev.slice(0, -1));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const payload = {
      institution: institution.trim(),
      course: course.trim(),
      semester,
      academic_goals: academicGoals.trim(),
      learning_preferences: selectedPrefs.join(','),
      subjects,
    };
    try {
      if (isEditing) {
        await api.put('/student-profile', payload, { headers });
      } else {
        await api.post('/student-profile', payload, { headers });
      }
      await refreshStudentProfile();
      navigate('/dashboard');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <h1 style={s.logo}>TwinMind</h1>
          <h2 style={s.title}>{isEditing ? 'Update your profile' : 'Set up your learner profile'}</h2>
          {!isEditing && (
            <p style={s.subtitle}>Tell us about your background so TwinMind can personalise your learning journey.</p>
          )}
        </div>

        {error && <p style={s.errorMsg}>{error}</p>}

        <form onSubmit={handleSubmit} style={s.form}>
          {/* Institution */}
          <label style={s.label}>
            Institution
            <input
              type="text"
              value={institution}
              onChange={e => setInstitution(e.target.value)}
              style={s.input}
              placeholder="e.g. National University of Singapore"
              required
              autoFocus
            />
          </label>

          {/* Course */}
          <label style={s.label}>
            Course / Programme
            <input
              type="text"
              value={course}
              onChange={e => setCourse(e.target.value)}
              style={s.input}
              placeholder="e.g. MBBS, B.Tech, LLB, MBA, CA, B.Sc, ITI, Self Learning…"
              list="course-suggestions"
              required
            />
            <datalist id="course-suggestions">
              {COURSE_SUGGESTIONS.map(c => <option key={c} value={c} />)}
            </datalist>
          </label>

          {/* Semester */}
          <div ref={guideRef}>
            <div style={s.semesterLabelRow}>
              <span style={s.semesterLabelText}>Current Semester / Year</span>
              <button
                type="button"
                onClick={() => setShowGuide(v => !v)}
                style={showGuide ? { ...s.guideBtn, ...s.guideBtnActive } : s.guideBtn}
                aria-label="Show semester guide"
                aria-expanded={showGuide}
              >?</button>
            </div>

            {showGuide && (
              <div style={s.guideCard}>
                <p style={s.guideTitle}>Which option should I pick?</p>
                {GUIDE_ITEMS.map(item => (
                  <div key={item.cat} style={s.guideRow}>
                    <span style={s.guideEmoji}>{item.emoji}</span>
                    <div>
                      <span style={s.guideCat}>{item.cat}</span>
                      <span style={s.guideArrow}> → </span>
                      <span style={s.guideHint}>{item.hint}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <select
              value={semester}
              onChange={e => setSemester(e.target.value)}
              style={{ ...s.select, marginTop: '0.375rem' }}
              className="form-select"
              required
              aria-label="Current Semester / Year"
            >
              <option value="" disabled>Select…</option>
              {SEMESTER_GROUPS.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Academic Goals */}
          <label style={s.label}>
            Goals & Aspirations
            <textarea
              value={academicGoals}
              onChange={e => setAcademicGoals(e.target.value)}
              style={s.textarea}
              placeholder="e.g. Pass MBBS finals, crack CA exams, get a software internship, build a startup, clear UPSC…"
              rows={3}
            />
          </label>

          {/* Subjects */}
          <div>
            <p style={s.prefLabel}>Subjects / Topics / Skills</p>
            <p style={s.prefHint}>Type a subject, topic, or skill and press Enter to add</p>
            <div style={s.tagBox} onClick={() => (document.getElementById('subject-input') as HTMLInputElement)?.focus()}>
              {subjects.map(sub => (
                <span key={sub} style={s.tag}>
                  {sub}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeSubject(sub); }}
                    style={s.tagX}
                    aria-label={`Remove ${sub}`}
                  >×</button>
                </span>
              ))}
              <input
                id="subject-input"
                type="text"
                value={subjectInput}
                onChange={e => setSubjectInput(e.target.value)}
                onKeyDown={handleSubjectKeyDown}
                onBlur={addSubject}
                placeholder={subjects.length === 0 ? 'e.g. Anatomy, Contract Law, Financial Modelling, Python…' : 'Add another…'}
                style={s.tagInput}
              />
            </div>
          </div>

          {/* Learning Preferences */}
          <div>
            <p style={s.prefLabel}>Learning Preferences</p>
            <p style={s.prefHint}>Select all that apply</p>
            <div style={s.prefGrid}>
              {LEARNING_PREFS.map(pref => {
                const active = selectedPrefs.includes(pref);
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => togglePref(pref)}
                    style={active ? { ...s.prefChip, ...s.prefChipActive } : s.prefChip}
                  >
                    {active ? ' ' : ''}{pref}
                  </button>
                );
              })}
            </div>
          </div>

          <button type="submit" disabled={saving} style={s.submitBtn}>
            {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Complete setup →'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100svh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem 1rem',
    background: 'var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: '540px',
    padding: '2.5rem 2rem',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow)',
    background: 'var(--bg)',
  },
  header: {
    marginBottom: '2rem',
    textAlign: 'center',
  },
  logo: {
    margin: '0 0 1rem',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '-0.5px',
  },
  title: {
    margin: '0 0 0.5rem',
    fontSize: '1.25rem',
    color: 'var(--text-h)',
    fontWeight: 600,
  },
  subtitle: {
    margin: 0,
    fontSize: '0.875rem',
    color: 'var(--text)',
  },
  errorMsg: {
    margin: '0 0 1rem',
    padding: '0.6rem 0.75rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.875rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
    textAlign: 'left',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  input: {
    padding: '0.6rem 0.75rem',
    border: '1px solid #4B5563',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: '#FFFFFF',
    background: '#1F2937',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  select: {
    padding: '0.6rem 0.75rem',
    border: '1px solid #4B5563',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: '#FFFFFF',
    background: '#1F2937',
    outline: 'none',
    cursor: 'pointer',
    width: '100%',
  },
  textarea: {
    padding: '0.6rem 0.75rem',
    border: '1px solid #4B5563',
    borderRadius: '8px',
    fontSize: '0.875rem',
    color: '#FFFFFF',
    background: '#1F2937',
    outline: 'none',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    lineHeight: '1.5',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  prefLabel: {
    margin: '0 0 0.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  prefHint: {
    margin: '0 0 0.75rem',
    fontSize: '0.775rem',
    color: 'var(--text)',
  },
  prefGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  tagBox: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.35rem',
    padding: '0.45rem 0.6rem',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--bg)',
    cursor: 'text',
    minHeight: '42px',
    alignItems: 'center',
  },
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.2rem 0.5rem 0.2rem 0.6rem',
    background: 'var(--accent-bg)',
    border: '1px solid var(--accent-border)',
    borderRadius: '99px',
    fontSize: '0.8rem',
    color: 'var(--accent)',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  },
  tagX: {
    background: 'transparent',
    border: 'none',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: '1rem',
    lineHeight: 1,
    padding: '0',
    display: 'flex',
    alignItems: 'center',
  },
  tagInput: {
    flex: '1 1 120px',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    fontSize: '0.875rem',
    color: 'var(--text-h)',
    fontFamily: 'inherit',
    padding: '0.15rem 0.25rem',
    minWidth: '80px',
  },
  prefChip: {
    padding: '0.4rem 0.85rem',
    border: '1px solid var(--border)',
    borderRadius: '99px',
    fontSize: '0.825rem',
    color: 'var(--text)',
    background: 'var(--bg)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  prefChipActive: {
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  submitBtn: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  semesterLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  semesterLabelText: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text)',
  },
  guideBtn: {
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text)',
    fontSize: '0.7rem',
    fontWeight: 700,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    flexShrink: 0,
    transition: 'border-color 0.15s, color 0.15s, background 0.15s',
  },
  guideBtnActive: {
    border: '1px solid var(--accent)',
    background: 'var(--accent-bg)',
    color: 'var(--accent)',
  },
  guideCard: {
    marginTop: '0.5rem',
    padding: '0.85rem 1rem',
    background: 'rgba(15, 23, 42, 0.92)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.55rem',
  },
  guideTitle: {
    margin: '0 0 0.35rem',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: 'var(--accent)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  guideRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
  },
  guideEmoji: {
    fontSize: '0.95rem',
    flexShrink: 0,
    marginTop: '1px',
  },
  guideCat: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  guideArrow: {
    fontSize: '0.8rem',
    color: 'var(--accent)',
    fontWeight: 700,
  },
  guideHint: {
    fontSize: '0.775rem',
    color: '#94a3b8',
  },
};
