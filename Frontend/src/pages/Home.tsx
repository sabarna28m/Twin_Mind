import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  Brain, Target, Shield, Award, Bot, TrendingUp,
  Sparkles, Plus, ArrowUpRight,
} from 'lucide-react';
import './Home.css';

/* ── Data ── */
const FEATURES = [
  { icon: <TrendingUp size={20} />, label: 'Analytics', title: 'Predictive Analytics', desc: 'ML models analyse your learning velocity and predict exam performance weeks in advance.' },
  { icon: <Brain size={20} />,      label: 'Core AI',   title: 'Digital Twin AI',       desc: 'Your personal AI model learns your study patterns, strengths, and knowledge gaps in real time.' },
  { icon: <Target size={20} />,     label: 'Focus',     title: 'Smart Focus Sessions',  desc: 'Pomodoro timers, deep work modes, and real-time concentration analytics to maximise every session.' },
  { icon: <Shield size={20} />,     label: 'Wellness',  title: 'Burnout Guardian',       desc: 'Proactive early-warning system detecting cognitive fatigue patterns before burnout sets in.' },
  { icon: <Award size={20} />,      label: 'Gamify',    title: 'Gamified Learning',      desc: 'XP system, achievement badges, skill trees, and competitive battles with peers.' },
  { icon: <Bot size={20} />,        label: 'Mentor',    title: 'AI Mentor & Coach',      desc: 'Multi-agent AI with specialised tutors per subject, providing Socratic guidance.' },
];

const STEPS = [
  { num: '01', title: 'Create your profile', desc: 'Sign up and tell us about your subjects, goals, and study schedule.' },
  { num: '02', title: 'Let the Twin learn', desc: 'Log daily check-ins. Your AI digital twin analyses patterns and builds a model of you.' },
  { num: '03', title: 'Study smarter', desc: 'Get personalised predictions, burnout warnings, and adaptive recommendations every day.' },
];

const TESTIMONIALS = [
  { text: "TwinMind helped me go from struggling with interview answers to landing my first tech role — in six months of consistent practice.", author: "Ananya Patel", role: "M.Sc. Computer Science" },
  { text: "The burnout guardian literally saved my semester. It knew I was crashing before I did and forced me to take a breather.", author: "James Chen", role: "Undergraduate Student" },
  { text: "Very organized platform. Love the ability to see my digital twin's health mirror my own study habits.", author: "Sarah Jenkins", role: "Self-Taught Developer" },
  { text: "The gamification kept me hooked. Earning XP for completing focus sessions made studying feel like a game instead of a chore.", author: "Priya Sharma", role: "Data Science Student" },
];

const FAQ = [
  { q: 'What is a Digital Twin?', a: 'Your digital twin is a personal AI model that mirrors your study behaviour, strengths, and knowledge gaps. It learns from your daily check-ins and provides predictions, recommendations, and early warnings tailored to you.' },
  { q: 'Is TwinMind free to use?', a: 'Yes. TwinMind is free for all core features including the digital twin, focus sessions, burnout detection, and gamification. Premium analytics may be offered in the future.' },
  { q: 'How does the Burnout Guardian work?', a: 'It analyses patterns in your study hours, stress levels, and consistency over time. When it detects early signs of cognitive fatigue, it prompts you to take a break before burnout sets in.' },
  { q: 'Can I use TwinMind for any subject?', a: 'Absolutely. TwinMind is subject-agnostic. You add your own courses and topics, and the AI adapts its recommendations to whatever you are studying.' },
  { q: 'What data do you collect?', a: 'Only what you log: study hours, attendance, assignment completion, and stress levels. We do not track browsing, keystrokes, or any data outside the app.' },
];

/* ── Animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.09 } },
};

/* ═══════════════════════════════════════
   HOME COMPONENT
   ═══════════════════════════════════════ */
export default function Home() {
  const { token } = useAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="synth-root">

      {/* ═══ NAV ═══ */}
      <div className="synth-nav-wrap">
        <nav className={`synth-nav ${navScrolled ? 'scrolled' : ''}`}>
          <Link to="/" className="synth-nav-logo">
            <img src="/assets/twinmind-logo.png" alt="" />
            <span>TwinMind</span>
          </Link>

          <div className="synth-nav-links">
            <a href="#features">Features</a>
            <a href="#how">How It Works</a>
            <a href="#testimonials">Testimonials</a>
            <Link to="/about">About</Link>
            {token && <Link to="/dashboard">Dashboard</Link>}
          </div>

          <div className="synth-nav-actions">
            <a
              href="https://github.com/sabarna28m/Twin_Mind"
              target="_blank"
              rel="noreferrer"
              className="synth-github-btn"
              aria-label="GitHub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.1-3.8s-1.2-.4-3.9 1.4a13.3 13.3 0 0 0-7 0c-2.7-1.8-3.9-1.4-3.9-1.4a5.5 5.5 0 0 0-.1 3.8 5.5 5.5 0 0 0-1.5 3.8c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"/><path d="M9 22v-4a4.8 4.8 0 0 0-1-3.2"/></svg>
            </a>
            {token ? (
              <Link to="/dashboard" className="synth-btn-primary">
                Dashboard <ArrowUpRight size={14} />
              </Link>
            ) : (
              <Link to="/register" className="synth-btn-primary">
                Get Started <ArrowUpRight size={14} />
              </Link>
            )}
          </div>
        </nav>
      </div>

      {/* ═══ HERO ═══ */}
      <section className="synth-hero">
        <motion.div
          className="synth-hero-content"
          initial="hidden" animate="visible" variants={stagger}
        >
          <motion.div variants={fadeUp} className="synth-hero-eyebrow">
            <Sparkles /> AI Learning Platform
          </motion.div>

          <motion.h1 variants={fadeUp}>
            Your Intelligent
            <br />
            Companion for
            <br />
            Modern Learning
          </motion.h1>

          <motion.p variants={fadeUp} className="synth-hero-sub">
            Streamline your study routine, predict your performance, and prevent
            burnout with a powerful AI digital twin designed for lifelong learners.
          </motion.p>

          <motion.div variants={fadeUp} className="synth-hero-ctas">
            <Link to="/register" className="synth-btn-primary">
              Start Now <ArrowUpRight size={14} />
            </Link>
            <a href="#features" className="synth-btn-secondary">
              View Features
            </a>
          </motion.div>
        </motion.div>

        {/* Glassmorphic 3D visual */}
        <motion.div
          className="synth-hero-visual"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="synth-glass-orb" />
          <div className="synth-glass-orb" />
          <div className="synth-glass-orb" />
        </motion.div>
      </section>

      {/* ═══ STATS STRIP ═══ */}
      <motion.div
        className="synth-stats"
        initial="hidden" whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
        variants={stagger}
      >
        {[
          { number: '10K+', label: 'Active Learners' },
          { number: '500K+', label: 'Focus Sessions' },
          { number: '95%', label: 'Satisfaction Rate' },
          { number: '24/7', label: 'AI Availability' },
        ].map(s => (
          <motion.div key={s.label} variants={fadeUp} className="synth-stat">
            <div className="synth-stat-number">{s.number}</div>
            <div className="synth-stat-label">{s.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="synth-section">
        <motion.div
          initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="synth-section-eyebrow">Platform Capabilities</motion.div>
          <motion.h2 variants={fadeUp} className="synth-section-title">
            Everything you need to study smarter, not harder
          </motion.h2>
          <motion.p variants={fadeUp} className="synth-section-desc">
            Six AI-powered tools that work together to optimise your learning journey from day one.
          </motion.p>
        </motion.div>

        <motion.div
          className="synth-features-grid"
          initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
        >
          {FEATURES.map(f => (
            <motion.div key={f.title} variants={fadeUp} className="synth-feature-card">
              <div className="synth-feature-icon">{f.icon}</div>
              <div className="synth-feature-label">{f.label}</div>
              <h3 className="synth-feature-title">{f.title}</h3>
              <p className="synth-feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how" className="synth-section" style={{ borderTop: '1px solid var(--synth-gray-200)' }}>
        <motion.div
          className="synth-how-grid"
          initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <div>
            <motion.div variants={fadeUp} className="synth-section-eyebrow">How It Works</motion.div>
            <motion.h2 variants={fadeUp} className="synth-section-title">
              Get started in three simple steps
            </motion.h2>
            <motion.p variants={fadeUp} className="synth-section-desc" style={{ marginBottom: 32 }}>
              No complex setup. Sign up, log your first check-in, and let the AI do the rest.
            </motion.p>
            <motion.div variants={fadeUp}>
              <Link to="/register" className="synth-btn-primary">
                Start Now <ArrowUpRight size={14} />
              </Link>
            </motion.div>
          </div>

          <div className="synth-steps">
            {STEPS.map((s, i) => (
              <motion.div key={s.num} variants={fadeUp} className="synth-step">
                <div className="synth-step-header">
                  <span className="synth-step-num">{s.num}</span>
                  <span className="synth-step-title">{s.title}</span>
                </div>
                <p className="synth-step-desc">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section id="testimonials" className="synth-section" style={{ background: 'var(--synth-gray-50)' }}>
        <motion.div
          initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="synth-section-eyebrow">Testimonials</motion.div>
          <motion.h2 variants={fadeUp} className="synth-section-title">
            Trusted by learners worldwide
          </motion.h2>
        </motion.div>

        <motion.div
          className="synth-testimonials-grid"
          initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
        >
          {TESTIMONIALS.map((t, i) => (
            <motion.div key={i} variants={fadeUp} className="synth-testimonial-card">
              <p className="synth-testimonial-text">"{t.text}"</p>
              <div className="synth-testimonial-author">
                <div className="synth-testimonial-avatar">
                  {t.author.split(' ').map(w => w[0]).join('')}
                </div>
                <div>
                  <div className="synth-testimonial-name">{t.author}</div>
                  <div className="synth-testimonial-role">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="synth-section">
        <motion.div
          initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="synth-section-eyebrow">FAQ</motion.div>
          <motion.h2 variants={fadeUp} className="synth-section-title">
            Frequently asked questions
          </motion.h2>
        </motion.div>

        <div className="synth-faq-list">
          {FAQ.map((item, i) => (
            <div key={i} className="synth-faq-item">
              <button
                className="synth-faq-q"
                aria-expanded={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <Plus size={18} />
              </button>
              <div className={`synth-faq-a ${openFaq === i ? 'open' : ''}`}>
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA BANNER ═══ */}
      <section style={{ borderTop: '1px solid var(--synth-gray-200)' }}>
        <motion.div
          className="synth-cta-banner"
          initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
        >
          <motion.div variants={fadeUp} className="synth-section-eyebrow" style={{ textAlign: 'center' }}>
            Ready to Start?
          </motion.div>
          <motion.h2 variants={fadeUp}>
            Transform how you learn — today
          </motion.h2>
          <motion.div variants={fadeUp} className="synth-cta-buttons">
            <Link to="/register" className="synth-btn-primary">
              Start Free <ArrowUpRight size={14} />
            </Link>
            <Link to="/about" className="synth-btn-secondary">
              Learn More
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="synth-footer">
        <div className="synth-footer-inner">
          <div className="synth-footer-brand">
            <Link to="/" className="synth-nav-logo" style={{ color: '#e5e5e5' }}>
              <img
                src="/assets/twinmind-logo.png"
                alt=""
                style={{ filter: 'brightness(0) invert(1)' }}
              />
              <span>TwinMind</span>
            </Link>
            <p>
              AI-powered learning companion. Study smarter, predict performance,
              and prevent burnout with your personal digital twin.
            </p>
            <div className="synth-footer-socials">
              <a href="https://github.com/sabarna28m/Twin_Mind" target="_blank" rel="noreferrer" aria-label="GitHub">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.1-3.8s-1.2-.4-3.9 1.4a13.3 13.3 0 0 0-7 0c-2.7-1.8-3.9-1.4-3.9-1.4a5.5 5.5 0 0 0-.1 3.8 5.5 5.5 0 0 0-1.5 3.8c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"/><path d="M9 22v-4a4.8 4.8 0 0 0-1-3.2"/></svg>
              </a>
              <a href="#" aria-label="Twitter"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg></a>
              <a href="#" aria-label="LinkedIn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg></a>
            </div>
          </div>

          <div className="synth-footer-col">
            <h4>Product</h4>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#how">How It Works</a></li>
              <li><a href="#testimonials">Testimonials</a></li>
              <li><a href="#faq">FAQ</a></li>
            </ul>
          </div>

          <div className="synth-footer-col">
            <h4>Platform</h4>
            <ul>
              <li><Link to="/register">Sign Up</Link></li>
              <li><Link to="/login">Log In</Link></li>
              <li><Link to="/about">About Us</Link></li>
            </ul>
          </div>

          <div className="synth-footer-col">
            <h4>Legal</h4>
            <ul>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Cookie Policy</a></li>
            </ul>
          </div>
        </div>

        <div className="synth-footer-bottom">
          <span>© {new Date().getFullYear()} TwinMind. All rights reserved.</span>
          <a href="https://github.com/sabarna28m/Twin_Mind" target="_blank" rel="noreferrer">
            Open Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
