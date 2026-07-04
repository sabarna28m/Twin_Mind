import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/* ═══════════════════════════════════════════════════════════════
   Kolkata 404 — Premium Vintage Postcard Error Page
   A warm, nostalgic "Greetings from Kolkata" postcard component.
   ═══════════════════════════════════════════════════════════════ */

interface Kolkata404Props {
  postcardImage?: string;
  postcardAlt?: string;
  curvedTextTop?: string;
  curvedTextBottom?: string;
  heading?: string;
  subtext?: string;
  backButtonLabel?: string;
  backButtonHref?: string;
}

export default function Kolkata404({
  postcardImage = '/howrah-bridge-watercolor.png',
  postcardAlt = 'Vintage Kolkata Postcard',
  curvedTextTop = 'The City of Joy',
  curvedTextBottom = 'Kolkata \u2022 India',
  heading = '(404) Looks like this page got lost somewhere between Howrah Bridge and College Street.',
  subtext = "Don\u2019t worry. Even if this page missed the last tram, we\u2019ll help you get back home.",
  backButtonLabel = 'Back Home',
  backButtonHref = '/',
}: Kolkata404Props) {
  return (
    <div
      className="kolkata-404-root"
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4rem 1rem',
        background: '#F8F3E8',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Subtle paper grain overlay ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Decorative corner ornaments (Bengali pattern inspired) ── */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: 120, height: 120, opacity: 0.08, pointerEvents: 'none' }}
        viewBox="0 0 120 120"
      >
        <path d="M0 0 Q60 10 120 0 Q110 60 120 120" stroke="#7A1F1F" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="20" r="8" fill="none" stroke="#C89B3C" strokeWidth="0.8" />
        <circle cx="20" cy="20" r="3" fill="#C89B3C" opacity="0.3" />
      </svg>
      <svg
        style={{ position: 'absolute', bottom: 0, right: 0, width: 120, height: 120, opacity: 0.08, pointerEvents: 'none', transform: 'rotate(180deg)' }}
        viewBox="0 0 120 120"
      >
        <path d="M0 0 Q60 10 120 0 Q110 60 120 120" stroke="#7A1F1F" strokeWidth="1.5" fill="none" />
        <circle cx="20" cy="20" r="8" fill="none" stroke="#C89B3C" strokeWidth="0.8" />
        <circle cx="20" cy="20" r="3" fill="#C89B3C" opacity="0.3" />
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>

        {/* ═══════════ POSTCARD SECTION ═══════════ */}
        <div style={{ position: 'relative', marginBottom: '4rem' }}>

          {/* ── Rotating circular text ── */}
          <svg
            className="kolkata-spin-slow"
            viewBox="0 0 160 160"
            style={{
              position: 'absolute',
              top: '-4.5rem',
              left: '-3.5rem',
              width: 160,
              height: 160,
              pointerEvents: 'none',
              zIndex: 20,
            }}
          >
            <defs>
              <path id="kolkata-circle" d="M 80,80 m -58,0 a 58,58 0 1,1 116,0 a 58,58 0 1,1 -116,0" fill="transparent" />
            </defs>
            <text
              style={{
                fontSize: '10.5px',
                fill: '#4A3526',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontWeight: 400,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              <textPath href="#kolkata-circle" startOffset="0%">
                {curvedTextTop} \u2022 {curvedTextBottom} \u2022
              </textPath>
            </text>
          </svg>

          {/* ── Main postcard ── */}
          <div style={{ position: 'relative', zIndex: 10 }}>
            <div
              className="kolkata-postcard"
              style={{
                position: 'relative',
                padding: 12,
                background: '#F4E8D0',
                borderRadius: 2,
                transform: 'rotate(4deg)',
                transition: 'transform 0.3s ease',
                boxShadow: '0 20px 60px rgba(74,53,38,0.25), 0 8px 24px rgba(74,53,38,0.15), 4px 4px 0 rgba(122,31,31,0.08)',
              }}
            >
              {/* Postcard inner border */}
              <div
                style={{
                  position: 'absolute',
                  inset: 6,
                  border: '1px solid rgba(122,31,31,0.12)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              />

              {/* Image */}
              <div style={{ position: 'relative', overflow: 'hidden', background: '#F4E8D0' }}>
                <img
                  src={postcardImage}
                  alt={postcardAlt}
                  style={{
                    width: 360,
                    height: 220,
                    objectFit: 'cover',
                    display: 'block',
                    filter: 'sepia(15%) saturate(85%) contrast(95%)',
                  }}
                />
                {/* Vintage fade overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, rgba(244,232,208,0.15) 0%, transparent 40%, rgba(244,232,208,0.1) 100%)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* "Greetings from Kolkata" text on postcard */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 20,
                  left: 18,
                  zIndex: 3,
                  padding: '4px 12px',
                  background: 'rgba(244,232,208,0.88)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: 2,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#7A1F1F',
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                  }}
                >
                  Greetings from Kolkata
                </span>
              </div>
            </div>

            {/* ── Kolkata GPO postal stamp ── */}
            <svg
              style={{
                position: 'absolute',
                top: -18,
                right: -30,
                width: 82,
                height: 82,
                zIndex: 15,
                opacity: 0.55,
                transform: 'rotate(-12deg)',
              }}
              viewBox="0 0 100 100"
            >
              {/* Outer scalloped circle */}
              <circle cx="50" cy="50" r="44" fill="none" stroke="#7A1F1F" strokeWidth="2" strokeDasharray="3,2" />
              <circle cx="50" cy="50" r="38" fill="none" stroke="#7A1F1F" strokeWidth="0.8" />
              <circle cx="50" cy="50" r="32" fill="none" stroke="#7A1F1F" strokeWidth="0.8" />
              {/* GPO text */}
              <text x="50" y="38" textAnchor="middle" style={{ fontSize: '7px', fill: '#7A1F1F', fontFamily: "'Georgia', serif", fontWeight: 700, letterSpacing: '0.2em' }}>
                KOLKATA
              </text>
              <text x="50" y="50" textAnchor="middle" style={{ fontSize: '10px', fill: '#7A1F1F', fontFamily: "'Georgia', serif", fontWeight: 700, letterSpacing: '0.15em' }}>
                G.P.O.
              </text>
              <line x1="28" y1="54" x2="72" y2="54" stroke="#7A1F1F" strokeWidth="0.6" />
              <text x="50" y="64" textAnchor="middle" style={{ fontSize: '5.5px', fill: '#7A1F1F', fontFamily: "'Georgia', serif", letterSpacing: '0.1em' }}>
                EST. 1774
              </text>
              {/* Cancellation wavy lines */}
              <path d="M 15 72 Q 25 68 35 72 Q 45 76 55 72 Q 65 68 75 72 Q 85 76 95 72" stroke="#7A1F1F" strokeWidth="0.6" fill="none" opacity="0.5" />
              <path d="M 15 77 Q 25 73 35 77 Q 45 81 55 77 Q 65 73 75 77 Q 85 81 95 77" stroke="#7A1F1F" strokeWidth="0.6" fill="none" opacity="0.5" />
            </svg>

            {/* ── Indian postal cancellation marks (wavy lines) ── */}
            <svg
              style={{
                position: 'absolute',
                right: -70,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 100,
                height: 70,
              }}
              viewBox="0 0 100 60"
            >
              <path d="M 5 12 Q 15 7 25 12 Q 35 17 45 12 Q 55 7 65 12 Q 75 17 85 12" stroke="#7A1F1F" strokeWidth="1.2" fill="none" opacity="0.35" />
              <path d="M 5 22 Q 15 17 25 22 Q 35 27 45 22 Q 55 17 65 22 Q 75 27 85 22" stroke="#7A1F1F" strokeWidth="1.2" fill="none" opacity="0.35" />
              <path d="M 5 32 Q 15 27 25 32 Q 35 37 45 32 Q 55 27 65 32 Q 75 37 85 32" stroke="#7A1F1F" strokeWidth="1.2" fill="none" opacity="0.35" />
              <path d="M 5 42 Q 15 37 25 42 Q 35 47 45 42 Q 55 37 65 42 Q 75 47 85 42" stroke="#7A1F1F" strokeWidth="1.2" fill="none" opacity="0.35" />
            </svg>

            {/* ── Vintage Indian postage stamp ── */}
            <div
              style={{
                position: 'absolute',
                top: -14,
                right: 55,
                width: 42,
                height: 52,
                zIndex: 16,
                transform: 'rotate(6deg)',
              }}
            >
              <svg viewBox="0 0 42 52" style={{ width: '100%', height: '100%' }}>
                {/* Perforated stamp border */}
                <rect x="2" y="2" width="38" height="48" rx="1" fill="#F4E8D0" stroke="#7A1F1F" strokeWidth="0.8" />
                {/* Perforation dots */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <circle key={`t${i}`} cx={4 + i * 3.2} cy="1" r="0.8" fill="#F8F3E8" />
                ))}
                {Array.from({ length: 12 }).map((_, i) => (
                  <circle key={`b${i}`} cx={4 + i * 3.2} cy="51" r="0.8" fill="#F8F3E8" />
                ))}
                {Array.from({ length: 14 }).map((_, i) => (
                  <circle key={`l${i}`} cx="1" cy={4 + i * 3.4} r="0.8" fill="#F8F3E8" />
                ))}
                {Array.from({ length: 14 }).map((_, i) => (
                  <circle key={`r${i}`} cx="41" cy={4 + i * 3.4} r="0.8" fill="#F8F3E8" />
                ))}
                {/* Stamp content — Victoria Memorial silhouette */}
                <rect x="5" y="5" width="32" height="28" rx="0.5" fill="#7A1F1F" opacity="0.12" />
                {/* Victoria Memorial dome */}
                <path d="M 15 30 Q 17 22 21 19 Q 25 22 27 30" fill="none" stroke="#7A1F1F" strokeWidth="0.7" opacity="0.5" />
                <circle cx="21" cy="17" r="2" fill="none" stroke="#7A1F1F" strokeWidth="0.5" opacity="0.5" />
                <line x1="21" y1="15" x2="21" y2="13" stroke="#7A1F1F" strokeWidth="0.4" opacity="0.5" />
                {/* Denomination */}
                <text x="21" y="41" textAnchor="middle" style={{ fontSize: '5px', fill: '#7A1F1F', fontFamily: "'Georgia', serif", fontWeight: 700 }}>
                  INDIA
                </text>
                <text x="21" y="47" textAnchor="middle" style={{ fontSize: '4px', fill: '#7A1F1F', fontFamily: "'Georgia', serif" }}>
                  \u20B92.00
                </text>
              </svg>
            </div>
          </div>

          {/* ── Kolkata-themed decorative elements ── */}

          {/* Yellow Ambassador taxi silhouette */}
          <svg
            style={{
              position: 'absolute',
              bottom: -25,
              left: 20,
              width: 55,
              height: 28,
              opacity: 0.12,
              pointerEvents: 'none',
            }}
            viewBox="0 0 60 30"
          >
            <path d="M 5 22 L 8 14 Q 10 10 15 10 L 35 10 Q 42 10 44 14 L 48 22 L 55 22 L 55 26 L 5 26 L 5 22 Z" fill="#C89B3C" />
            <circle cx="15" cy="26" r="3.5" fill="#4A3526" />
            <circle cx="45" cy="26" r="3.5" fill="#4A3526" />
            <rect x="14" y="12" width="8" height="6" rx="0.5" fill="rgba(255,255,255,0.3)" />
            <rect x="28" y="12" width="10" height="6" rx="0.5" fill="rgba(255,255,255,0.3)" />
          </svg>

          {/* Tram silhouette */}
          <svg
            style={{
              position: 'absolute',
              bottom: -30,
              right: -40,
              width: 65,
              height: 35,
              opacity: 0.1,
              pointerEvents: 'none',
            }}
            viewBox="0 0 70 35"
          >
            {/* Tram body */}
            <rect x="8" y="8" width="50" height="18" rx="3" fill="#7A1F1F" />
            {/* Windows */}
            <rect x="12" y="11" width="7" height="8" rx="1" fill="rgba(255,255,255,0.4)" />
            <rect x="22" y="11" width="7" height="8" rx="1" fill="rgba(255,255,255,0.4)" />
            <rect x="32" y="11" width="7" height="8" rx="1" fill="rgba(255,255,255,0.4)" />
            <rect x="42" y="11" width="7" height="8" rx="1" fill="rgba(255,255,255,0.4)" />
            {/* Roof */}
            <rect x="10" y="5" width="46" height="4" rx="2" fill="#7A1F1F" opacity="0.7" />
            {/* Wheels */}
            <circle cx="18" cy="28" r="3" fill="#4A3526" />
            <circle cx="48" cy="28" r="3" fill="#4A3526" />
            {/* Pantograph */}
            <line x1="33" y1="5" x2="33" y2="0" stroke="#4A3526" strokeWidth="1" />
            <line x1="28" y1="0" x2="38" y2="0" stroke="#4A3526" strokeWidth="1.2" />
            {/* Rail */}
            <line x1="0" y1="31" x2="70" y2="31" stroke="#4A3526" strokeWidth="1" />
          </svg>
        </div>

        {/* ═══════════ TEXT SECTION ═══════════ */}
        <div style={{ textAlign: 'center', maxWidth: '42rem' }}>
          <h1
            style={{
              fontFamily: "'Doto', 'Georgia', 'Times New Roman', serif",
              fontSize: 'clamp(1.8rem, 5vw, 3rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              color: '#4A3526',
              marginBottom: '1.5rem',
              textWrap: 'balance',
              letterSpacing: '-0.01em',
            }}
          >
            {heading}
          </h1>

          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 'clamp(0.95rem, 2vw, 1.125rem)',
              lineHeight: 1.65,
              color: '#6B5744',
              marginBottom: '2.5rem',
              maxWidth: '36rem',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {subtext}
          </p>

          <Link
            to={backButtonHref}
            className="kolkata-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.75rem',
              background: '#7A1F1F',
              color: '#F4E8D0',
              borderRadius: 8,
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '0.9rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 14px rgba(122,31,31,0.3)',
              border: 'none',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            {backButtonLabel}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* ═══════════ SCOPED STYLES ═══════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Doto:wght@100..900&display=swap');

        @keyframes kolkata-spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .kolkata-spin-slow {
          animation: kolkata-spin-slow 20s linear infinite;
        }

        .kolkata-postcard:hover {
          transform: rotate(0deg) !important;
          box-shadow: 0 28px 70px rgba(74,53,38,0.3), 0 12px 32px rgba(74,53,38,0.18), 0 0 0 1px rgba(122,31,31,0.06) !important;
        }

        .kolkata-btn:hover {
          background: #5C1616 !important;
          box-shadow: 0 6px 20px rgba(122,31,31,0.4) !important;
          transform: translateY(-1px);
        }
        .kolkata-btn:active {
          transform: translateY(0);
        }

        /* Responsive postcard sizing */
        @media (max-width: 480px) {
          .kolkata-postcard img {
            width: 280px !important;
            height: 172px !important;
          }
          .kolkata-spin-slow {
            width: 120px !important;
            height: 120px !important;
            top: -3.5rem !important;
            left: -2.5rem !important;
          }
        }
      `}</style>
    </div>
  );
}
