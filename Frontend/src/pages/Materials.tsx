import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LiveBadge from '../components/LiveBadge';
import BackButton from '../components/BackButton';

interface Material {
  id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string | null;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.docx,.pptx,.xlsx,.doc';

function fileIcon(mime: string) {
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('image/')) return '🖼';
  if (mime.startsWith('text/')) return '📝';
  if (mime.includes('word')) return '📘';
  if (mime.includes('presentation')) return '📊';
  if (mime.includes('sheet')) return '📗';
  return '📎';
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Materials() {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const headers = { Authorization: `Bearer ${token}` };
  const wsConnected = useWebSocket(user?.id, token, () => {});

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Material[]>('/materials', { headers })
      .then(r => setMaterials(r.data))
      .finally(() => setLoading(false));
  }, []);

  async function uploadFile(file: File) {
    setError('');
    setUploading(true);
    setProgress(0);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<Material>('/materials', form, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: e => setProgress(Math.round((e.loaded * 100) / (e.total ?? e.loaded))),
      });
      setMaterials(prev => [data, ...prev]);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Upload failed.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  async function deleteMaterial(id: number) {
    await api.delete(`/materials/${id}`, { headers });
    setMaterials(prev => prev.filter(m => m.id !== id));
  }

  function downloadMaterial(id: number, name: string) {
    const url = `${api.defaults.baseURL}/materials/${id}/download`;
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.setAttribute('data-auth', `Bearer ${token}`);
    // Use fetch + blob for auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        a.click();
        URL.revokeObjectURL(objUrl);
      });
  }

  return (
    <div style={s.shell}>
      <header style={s.nav}>
        <div style={s.navLeft}>
          <BackButton />
          <Link to="/" style={s.navLogo}>TwinMind</Link>
          {wsConnected && <LiveBadge />}
        </div>
      </header>

      <main style={s.main}>
        <h1 style={s.pageTitle}>{t('materials_title')}</h1>

        {/* Drop zone */}
        <div
          style={dragOver ? { ...s.dropZone, ...s.dropZoneActive } : s.dropZone}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div style={s.progressWrap}>
              <p style={s.dropLabel}>{t('materials_uploading')}</p>
              <div style={s.progressTrack}>
                <div style={{ ...s.progressBar, width: `${progress}%` }} />
              </div>
              <p style={s.dropHint}>{progress}%</p>
            </div>
          ) : (
            <>
              <p style={s.dropIcon}>☁</p>
              <p style={s.dropLabel}>{dragOver ? t('materials_drop') : t('materials_upload')}</p>
              <p style={s.dropHint}>{t('materials_browse')} · {t('materials_supported')}</p>
            </>
          )}
        </div>

        {error && <p style={s.errorMsg}>{error}</p>}

        {/* File list */}
        {loading ? (
          <p style={s.emptyText}>{t('loading')}</p>
        ) : materials.length === 0 ? (
          <div style={s.empty}>
            <p style={s.emptyIcon}>📂</p>
            <p style={s.emptyTitle}>{t('materials_empty')}</p>
            <p style={s.emptyHint}>Upload your first file above.</p>
          </div>
        ) : (
          <div style={s.list}>
            {materials.map(m => (
              <div key={m.id} style={s.card}>
                <span style={s.fileIcon}>{fileIcon(m.mime_type)}</span>
                <div style={s.fileInfo}>
                  <p style={s.fileName}>{m.original_name}</p>
                  <p style={s.fileMeta}>{formatSize(m.file_size)} · {formatDate(m.created_at)}</p>
                </div>
                <div style={s.actions}>
                  <button onClick={() => downloadMaterial(m.id, m.original_name)} style={s.actionBtn} title="Download">↓</button>
                  <button onClick={() => deleteMaterial(m.id)} style={s.deleteBtn} title="Delete">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    minHeight: '100svh',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg)',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 2rem',
    height: '60px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  navLogo: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '-0.5px',
    textDecoration: 'none',
  },
  backLink: {
    fontSize: '0.875rem',
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  main: {
    flex: 1,
    padding: '2rem',
    maxWidth: '720px',
    width: '100%',
    margin: '0 auto',
    boxSizing: 'border-box',
    textAlign: 'left',
  },
  pageTitle: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    fontWeight: 600,
    color: 'var(--text-h)',
  },

  // Drop zone
  dropZone: {
    border: '2px dashed var(--border)',
    borderRadius: '12px',
    padding: '2.5rem 2rem',
    textAlign: 'center',
    cursor: 'pointer',
    marginBottom: '1.5rem',
    transition: 'border-color 0.15s, background 0.15s',
  },
  dropZoneActive: {
    borderColor: 'var(--accent)',
    background: 'var(--accent-bg)',
  },
  dropIcon: {
    margin: '0 0 0.5rem',
    fontSize: '2rem',
    color: 'var(--text)',
  },
  dropLabel: {
    margin: '0 0 0.25rem',
    fontWeight: 600,
    color: 'var(--text-h)',
    fontSize: '0.95rem',
  },
  dropHint: {
    margin: 0,
    color: 'var(--text)',
    fontSize: '0.8rem',
  },

  // Upload progress
  progressWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  progressTrack: {
    width: '100%',
    maxWidth: '300px',
    height: '6px',
    background: 'var(--border)',
    borderRadius: '99px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'var(--accent)',
    borderRadius: '99px',
    transition: 'width 0.1s',
  },

  // Error
  errorMsg: {
    margin: '0 0 1rem',
    padding: '0.5rem 0.75rem',
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.875rem',
  },

  // Empty
  empty: {
    textAlign: 'center',
    padding: '3rem 1rem',
  },
  emptyIcon: { margin: '0 0 0.75rem', fontSize: '2.5rem' },
  emptyTitle: { margin: '0 0 0.375rem', fontWeight: 600, color: 'var(--text-h)', fontSize: '1rem' },
  emptyHint: { margin: 0, color: 'var(--text)', fontSize: '0.875rem' },
  emptyText: { color: 'var(--text)', fontSize: '0.9rem', margin: 0 },

  // File list
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.875rem 1.25rem',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    background: 'var(--bg)',
  },
  fileIcon: {
    fontSize: '1.5rem',
    flexShrink: 0,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
  },
  fileName: {
    margin: '0 0 0.2rem',
    fontWeight: 600,
    fontSize: '0.9rem',
    color: 'var(--text-h)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  fileMeta: {
    margin: 0,
    fontSize: '0.775rem',
    color: 'var(--text)',
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexShrink: 0,
  },
  actionBtn: {
    background: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--accent)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 700,
    padding: '0.25rem 0.6rem',
  },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0.25rem 0.5rem',
    borderRadius: '6px',
  },
};
