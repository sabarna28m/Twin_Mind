function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : part
      )}
    </>
  );
}

export default function PlanContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        if (line.startsWith('# '))
          return <div key={i} style={pc.h1}>{renderInline(line.slice(2))}</div>;
        if (line.startsWith('## '))
          return <div key={i} style={pc.h2}>{renderInline(line.slice(3))}</div>;
        if (line.startsWith('### '))
          return <div key={i} style={pc.h3}>{renderInline(line.slice(4))}</div>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return <div key={i} style={pc.bullet}>• {renderInline(line.slice(2))}</div>;
        if (/^\d+\. /.test(line)) {
          const m = line.match(/^(\d+)\. (.*)/);
          return m
            ? <div key={i} style={pc.numbered}>{m[1]}. {renderInline(m[2])}</div>
            : <div key={i} style={pc.body}>{renderInline(line)}</div>;
        }
        if (line.trim() === '') return <div key={i} style={{ height: '0.45rem' }} />;
        return <div key={i} style={pc.body}>{renderInline(line)}</div>;
      })}
    </div>
  );
}

const pc: Record<string, React.CSSProperties> = {
  h1: { fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent)', margin: '1rem 0 0.3rem' },
  h2: {
    fontSize: '0.95rem', fontWeight: 700, color: 'var(--accent)',
    margin: '0.85rem 0 0.25rem', paddingBottom: '0.2rem',
    borderBottom: '1px solid var(--border)',
  },
  h3:      { fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-h)', margin: '0.6rem 0 0.15rem' },
  bullet:  { fontSize: '0.875rem', lineHeight: '1.55', color: 'var(--text-h)', paddingLeft: '1rem', marginBottom: '0.1rem' },
  numbered:{ fontSize: '0.875rem', lineHeight: '1.55', color: 'var(--text-h)', paddingLeft: '0.5rem', marginBottom: '0.1rem' },
  body:    { fontSize: '0.875rem', lineHeight: '1.55', color: 'var(--text-h)' },
};
