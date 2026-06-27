import { Link } from 'react-router-dom';

export default function BackButton() {
  return (
    <Link to="/dashboard" className="back-btn-link" style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '0.78rem',
      fontWeight: 500,
      color: 'var(--text)',
      textDecoration: 'none',
      padding: '0.28rem 0.65rem',
      border: '1px solid var(--border)',
      borderRadius: '7px',
      background: 'transparent',
      flexShrink: 0,
      whiteSpace: 'nowrap' as const,
      letterSpacing: '0.01em',
      minHeight: '36px',
    }}>
      ← Dashboard
    </Link>
  );
}
