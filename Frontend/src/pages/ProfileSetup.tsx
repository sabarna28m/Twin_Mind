import { useEffect, useState } from 'react';
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
    label: 'School Students',
    options: Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`),
  },
  {
    label: 'Undergraduate College',
    options: [
      'Semester 1', 'Semester 2', 'Semester 3', 'Semester 4',
      'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8',
      'Year 1', 'Year 2', 'Year 3', 'Year 4',
    ],
  },
  {
    label: 'Postgraduate',
    options: ['PG Semester 1', 'PG Semester 2', 'PG Semester 3', 'PG Semester 4', 'PG Year 1', 'PG Year 2'],
  },
  {
    label: 'Doctoral / PhD',
    options: Array.from({ length: 5 }, (_, i) => `PhD Year ${i + 1}`),
  },
  {
    label: 'Professional Courses',
    options: [
      'Module 1', 'Module 2', 'Module 3', 'Module 4', 'Module 5', 'Module 6',
      'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5',
    ],
  },
  {
    label: 'Online / Self Learning',
    options: ['Beginner Level', 'Intermediate Level', 'Advanced Level', 'Self-paced'],
  },
  {
    label: 'Other',
    options: ['Not Applicable'],
  },
];

const COURSE_SUGGESTIONS = [
  'School', 'B.Tech', 'B.E.', 'B.Sc', 'B.Com', 'B.A.', 'BCA', 'BBA',
  'MBA', 'MCA', 'M.Tech', 'M.Sc', 'M.Com', 'M.A.',
  'PhD', 'Diploma', 'NPTEL', 'Certification Course', 'Self Learning',
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

  const isEditing = !!studentProfile;

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
      navigate('/');
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
          <h2 style={s.title}>{isEditing ? 'Update your profile' : 'Set up your student profile'}</h2>
          {!isEditing && (
            <p style={s.subtitle}>Tell us about yourself so TwinMind can personalise your experience.</p>
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
              placeholder="e.g. B.Tech, MBA, PhD, Self Learning…"
              list="course-suggestions"
              required
            />
            <datalist id="course-suggestions">
              {COURSE_SUGGESTIONS.map(c => <option key={c} value={c} />)}
            </datalist>
          </label>

          {/* Semester */}
          <label style={s.label}>
            Current Semester / Year
            <select
              value={semester}
              onChange={e => setSemester(e.target.value)}
              style={s.select}
              required
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
          </label>

          {/* Academic Goals */}
          <label style={s.label}>
            Academic Goals
            <textarea
              value={academicGoals}
              onChange={e => setAcademicGoals(e.target.value)}
              style={s.textarea}
              placeholder="e.g. Improve my GPA, prepare for internship applications, master data structures…"
              rows={3}
            />
          </label>

          {/* Subjects */}
          <div>
            <p style={s.prefLabel}>Subjects / Modules</p>
            <p style={s.prefHint}>Type a subject name and press Enter to add it</p>
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
                placeholder={subjects.length === 0 ? 'e.g. Mathematics, Physics…' : 'Add another…'}
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
                    {active ? '✓ ' : ''}{pref}
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
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: 'var(--text-h)',
    background: 'var(--bg)',
    outline: 'none',
  },
  select: {
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '0.95rem',
    color: 'var(--text-h)',
    background: 'var(--bg)',
    outline: 'none',
    cursor: 'pointer',
  },
  textarea: {
    padding: '0.6rem 0.75rem',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    fontSize: '0.875rem',
    color: 'var(--text-h)',
    background: 'var(--bg)',
    outline: 'none',
    resize: 'vertical' as const,
    fontFamily: 'inherit',
    lineHeight: '1.5',
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
};
