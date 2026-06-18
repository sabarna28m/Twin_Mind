import { Search, X } from 'lucide-react';

export type FilterType = 'all' | 'today' | 'week' | 'month' | 'completed' | 'active';
export type SortType   = 'newest' | 'oldest' | 'longest' | 'shortest';

interface Props {
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  sort: SortType;
  setSort: (s: SortType) => void;
  search: string;
  setSearch: (s: string) => void;
  subjects: string[];
  subjectFilter: string;
  setSubjectFilter: (s: string) => void;
}

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'today',     label: 'Today'     },
  { key: 'week',      label: 'This Week' },
  { key: 'month',     label: 'This Month'},
  { key: 'completed', label: 'Completed' },
  { key: 'active',    label: 'Active'    },
];

const SORTS: { key: SortType; label: string }[] = [
  { key: 'newest',   label: 'Newest'   },
  { key: 'oldest',   label: 'Oldest'   },
  { key: 'longest',  label: 'Longest'  },
  { key: 'shortest', label: 'Shortest' },
];

export default function SessionFilters({
  filter, setFilter, sort, setSort,
  search, setSearch, subjects, subjectFilter, setSubjectFilter,
}: Props) {
  return (
    <div style={s.wrap}>

      {/* Search */}
      <div style={s.searchRow}>
        <div style={s.searchWrap}>
          <Search size={15} style={{ color: 'var(--text)', flexShrink: 0, marginLeft: '0.6rem' }} />
          <input
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={s.searchInput}
          />
          {search && (
            <button onClick={() => setSearch('')} style={s.clearBtn} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        {subjects.length > 0 && (
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            style={s.subjectSelect}
          >
            <option value="">All Subjects</option>
            {subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
          </select>
        )}

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortType)}
          style={s.sortSelect}
        >
          {SORTS.map(opt => <option key={opt.key} value={opt.key}>{opt.label}</option>)}
        </select>
      </div>

      {/* Filter tabs */}
      <div style={s.tabs}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{ ...s.tab, ...(filter === f.key ? s.tabActive : {}) }}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '0.65rem' },

  searchRow: { display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' },
  searchWrap: {
    flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: '0.4rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', overflow: 'hidden',
  },
  searchInput: {
    flex: 1, border: 'none', background: 'transparent',
    padding: '0.55rem 0.5rem', color: 'var(--text-h)',
    fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none',
  },
  clearBtn: {
    background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer',
    padding: '0.3rem 0.55rem', display: 'flex', alignItems: 'center', flexShrink: 0,
    fontFamily: 'inherit',
  },
  subjectSelect: {
    flex: '0 0 auto', padding: '0.52rem 0.75rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: 'var(--text-h)', fontSize: '0.82rem', fontFamily: 'inherit',
    cursor: 'pointer', outline: 'none',
  },
  sortSelect: {
    flex: '0 0 auto', padding: '0.52rem 0.75rem',
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px', color: 'var(--text-h)', fontSize: '0.82rem', fontFamily: 'inherit',
    cursor: 'pointer', outline: 'none',
  },

  tabs: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  tab: {
    padding: '0.3rem 0.7rem', borderRadius: '99px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: 'var(--text)',
    fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.18s, border-color 0.18s, color 0.18s',
  },
  tabActive: {
    background: 'rgba(0,212,255,0.12)',
    border: '1px solid rgba(0,212,255,0.35)',
    color: '#00D4FF',
  },
};
