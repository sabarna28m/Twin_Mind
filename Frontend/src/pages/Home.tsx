import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import {
  Brain, Target, Shield, Award, Bot, TrendingUp,
  Plus, Minus, ArrowRight
} from 'lucide-react';
import './Home.css';

/* ── Data ── */
const FEATURES = [
  { icon: <TrendingUp size={24} strokeWidth={1.5} />, label: 'Analytics', title: 'Predictive Analytics', desc: 'ML models analyze your learning velocity and predict exam performance weeks in advance.' },
  { icon: <Brain size={24} strokeWidth={1.5} />,      label: 'Core AI',   title: 'Digital Twin AI',       desc: 'Your personal AI model learns your study patterns, strengths, and knowledge gaps in real time.' },
  { icon: <Target size={24} strokeWidth={1.5} />,     label: 'Focus',     title: 'Smart Focus Sessions',  desc: 'Pomodoro timers, deep work modes, and real-time concentration analytics to maximize every session.' },
  { icon: <Shield size={24} strokeWidth={1.5} />,     label: 'Wellness',  title: 'Burnout Guardian',       desc: 'Proactive early-warning system detecting cognitive fatigue patterns before burnout sets in.' },
  { icon: <Award size={24} strokeWidth={1.5} />,      label: 'Gamify',    title: 'Gamified Learning',      desc: 'XP system, achievement badges, skill trees, and competitive battles with peers.' },
  { icon: <Bot size={24} strokeWidth={1.5} />,        label: 'Mentor',    title: 'AI Mentor & Coach',      desc: 'Multi-agent AI with specialized tutors per subject, providing Socratic guidance.' },
];

const STEPS = [
  { num: '01', title: 'Create your profile', desc: 'Sign up and tell us about your subjects, goals, and study schedule.' },
  { num: '02', title: 'Let the Twin learn', desc: 'Log daily check-ins. Your AI digital twin analyzes patterns and builds a model of you.' },
  { num: '03', title: 'Study smarter', desc: 'Get personalized predictions, burnout warnings, and adaptive recommendations every day.' },
];

const TESTIMONIALS = [
  { text: "TwinMind helped me go from struggling with interview answers to landing my first tech role — in six months of consistent practice.", author: "Ananya Patel", role: "M.Sc. Computer Science" },
  { text: "The burnout guardian literally saved my semester. It knew I was crashing before I did and forced me to take a breather.", author: "James Chen", role: "Undergraduate Student" },
  { text: "Very organized platform. Love the ability to see my digital twin's health mirror my own study habits.", author: "Sarah Jenkins", role: "Self-Taught Developer" },
  { text: "The gamification kept me hooked. Earning XP for completing focus sessions made studying feel like a game instead of a chore.", author: "Priya Sharma", role: "Data Science Student" },
];

const FAQ = [
  { q: 'What is a Digital Twin?', a: 'Your digital twin is a personal AI model that mirrors your study behavior, strengths, and knowledge gaps. It learns from your daily check-ins and provides predictions, recommendations, and early warnings tailored to you.' },
  { q: 'Is TwinMind free to use?', a: 'Yes. TwinMind is free for all core features including the digital twin, focus sessions, burnout detection, and gamification. Premium analytics may be offered in the future.' },
  { q: 'How does the Burnout Guardian work?', a: 'It analyzes patterns in your study hours, stress levels, and consistency over time. When it detects early signs of cognitive fatigue, it prompts you to take a break before burnout sets in.' },
  { q: 'Can I use TwinMind for any subject?', a: 'Absolutely. TwinMind is subject-agnostic. You add your own courses and topics, and the AI adapts its recommendations to whatever you are studying.' },
  { q: 'What data do you collect?', a: 'Only what you log: study hours, attendance, assignment completion, and stress levels. We do not track browsing, keystrokes, or any data outside the app.' },
];

/* ── Animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

/* ═══════════════════════════════════════
   HOME COMPONENT
   ═══════════════════════════════════════ */
export default function Home() {
  const { token } = useAuth();
  const [navScrolled, setNavScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="synth-root">
      {/* ═══ NAV ═══ */}
      <header className={`synth-nav ${navScrolled ? 'scrolled' : ''}`}>
        <div className="synth-container synth-nav-inner">
          <Link to="/" className="synth-logo">
            <img src="/assets/twinmind-logo.png" alt="" />
            <span>TwinMind</span>
          </Link>

          <nav className="synth-nav-links">
            <a href="#features">FEATURES</a>
            <a href="#how">HOW IT WORKS</a>
            <a href="#testimonials">TESTIMONIALS</a>

          </nav>

          <div className="synth-nav-actions">
            {token ? (
              <Link to="/dashboard" className="synth-btn-primary">
                DASHBOARD
              </Link>
            ) : (
              <Link to="/register" className="synth-btn-primary">
                GET STARTED
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ═══ HERO ═══ */}
        <section className="synth-section synth-hero">
          <div className="synth-container">
            <motion.div 
              className="synth-hero-grid"
              initial="hidden" animate="visible" variants={stagger}
            >
              <div className="synth-hero-content">
                <motion.div variants={fadeUp} className="synth-pill">
                  <span>TwinMind AI Platform</span>
                </motion.div>
                
                <motion.h1 variants={fadeUp} className="synth-display">
                  Your Intelligent<br />
                  Companion for<br />
                  Modern Learning
                </motion.h1>

                <motion.p variants={fadeUp} className="synth-lead">
                  Streamline your study routine, predict your performance, and prevent
                  burnout with a powerful AI digital twin designed for lifelong learners.
                </motion.p>

                <motion.div variants={fadeUp} className="synth-hero-ctas">
                  <Link to="/register" className="synth-btn-primary synth-btn-lg">
                    START NOW
                  </Link>
                  <a href="#features" className="synth-btn-outline synth-btn-lg">
                    VIEW DEMO
                  </a>
                </motion.div>
              </div>

              <motion.div 
                className="synth-hero-visual"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="synth-mockup">
                  <div className="synth-mockup-header">
                    <span className="synth-dot"></span>
                    <span className="synth-dot"></span>
                    <span className="synth-dot"></span>
                  </div>
                  <div className="synth-mockup-body">
                    {/* Placeholder for dashboard visual */}
                    <div className="synth-mockup-line"></div>
                    <div className="synth-mockup-line short"></div>
                    <div className="synth-mockup-grid">
                      <div className="synth-mockup-box"></div>
                      <div className="synth-mockup-box"></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>


        {/* ═══ VALUE PROP & STATS ═══ */}
        <section className="synth-section synth-bg-alt">
          <div className="synth-container">
            <div className="synth-split-layout">
              <motion.div 
                className="synth-split-content"
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
              >
                <motion.h2 variants={fadeUp} className="synth-h2">
                  Built to simplify how modern learners operate
                </motion.h2>
                <motion.p variants={fadeUp} className="synth-p">
                  TwinMind integrates advanced machine learning models with cognitive science to create a personalized digital twin. We don't just track hours; we analyze velocity, focus depth, and fatigue patterns.
                </motion.p>
                <motion.div variants={fadeUp}>
                  <Link to="/register" className="synth-btn-primary">
                    START NOW <ArrowRight size={16} style={{ marginLeft: 8 }} />
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div 
                className="synth-split-stats"
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
              >
                <motion.div variants={fadeUp} className="synth-stat-block">
                  <div className="synth-stat-num">500 K+</div>
                  <div className="synth-stat-desc">Focus sessions completed by learners globally.</div>
                </motion.div>
                <motion.div variants={fadeUp} className="synth-stat-block">
                  <div className="synth-stat-num">4.9</div>
                  <div className="synth-stat-desc">Average user rating for burnout prediction accuracy.</div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══ FEATURES GRID ═══ */}
        <section id="features" className="synth-section">
          <div className="synth-container">
            <motion.div 
              className="synth-section-header center"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            >
              <motion.span variants={fadeUp} className="synth-mono-tag">PLATFORM CAPABILITIES</motion.span>
              <motion.h2 variants={fadeUp} className="synth-h2">
                Everything you need to study smarter
              </motion.h2>
            </motion.div>

            <motion.div 
              className="synth-grid-3"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            >
              {FEATURES.map((f, i) => (
                <motion.div key={i} variants={fadeUp} className="synth-card">
                  <div className="synth-card-icon">{f.icon}</div>
                  <h3 className="synth-h3">{f.title}</h3>
                  <p className="synth-p">{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <section id="how" className="synth-section synth-bg-alt">
          <div className="synth-container">
            <div className="synth-split-layout">
              <motion.div 
                className="synth-split-content"
                initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
              >
                <motion.h2 variants={fadeUp} className="synth-h2">
                  Get started in three simple steps
                </motion.h2>
                <motion.p variants={fadeUp} className="synth-p">
                  No complex setup. Sign up, log your first check-in, and let the AI build a digital model of your learning habits.
                </motion.p>
                <motion.div variants={fadeUp}>
                  <Link to="/register" className="synth-btn-primary">
                    TRY IT NOW
                  </Link>
                </motion.div>
              </motion.div>

              <div className="synth-steps-list">
                {STEPS.map((step, i) => (
                  <motion.div 
                    key={i}
                    className="synth-step-item"
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <div className="synth-step-number">{step.num}</div>
                    <div className="synth-step-content">
                      <h3 className="synth-h3">{step.title}</h3>
                      <p className="synth-p">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ═══ TESTIMONIALS ═══ */}
        <section id="testimonials" className="synth-section">
          <div className="synth-container">
            <motion.div 
              className="synth-section-header center"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            >
              <motion.span variants={fadeUp} className="synth-mono-tag">TESTIMONIALS</motion.span>
              <motion.h2 variants={fadeUp} className="synth-h2">
                Loved by modern learners
              </motion.h2>
            </motion.div>

            <motion.div 
              className="synth-grid-2"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            >
              {TESTIMONIALS.map((t, i) => (
                <motion.div key={i} variants={fadeUp} className="synth-testimonial">
                  <p className="synth-testimonial-text">"{t.text}"</p>
                  <div className="synth-testimonial-author">
                    <div className="synth-avatar">
                      {t.author.split(' ').map(w => w[0]).join('')}
                    </div>
                    <div className="synth-author-info">
                      <div className="synth-author-name">{t.author}</div>
                      <div className="synth-author-role">{t.role}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section id="faq" className="synth-section synth-bg-alt">
          <div className="synth-container">
            <motion.div 
              className="synth-section-header center"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            >
              <motion.h2 variants={fadeUp} className="synth-h2">
                Frequently Asked Questions
              </motion.h2>
            </motion.div>

            <div className="synth-faq-container">
              {FAQ.map((item, i) => {
                const isOpen = openFaq === i;
                return (
                  <div key={i} className={`synth-faq-item ${isOpen ? 'open' : ''}`}>
                    <button 
                      className="synth-faq-trigger"
                      onClick={() => setOpenFaq(isOpen ? null : i)}
                      aria-expanded={isOpen}
                    >
                      <span>{item.q}</span>
                      <div className="synth-faq-icon">
                        {isOpen ? <Minus size={18} /> : <Plus size={18} />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {isOpen && (
                        <motion.div 
                          className="synth-faq-content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                          <div className="synth-faq-inner">
                            <p>{item.a}</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section className="synth-cta-section">
          <div className="synth-container">
            <motion.div 
              className="synth-cta-box"
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            >
              <motion.span variants={fadeUp} className="synth-mono-tag white">NEXT-GENERATION AI PLATFORM</motion.span>
              <motion.h2 variants={fadeUp} className="synth-h2 white">
                Start Using Your AI Business Assistant Today
              </motion.h2>
              <motion.div variants={fadeUp} className="synth-cta-buttons">
                <Link to="/register" className="synth-btn-primary white">
                  GET STARTED
                </Link>

              </motion.div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ═══ FOOTER ═══ */}
      <footer className="synth-footer">
        <div className="synth-container">
          <div className="synth-footer-grid">
            <div className="synth-footer-brand">
              <Link to="/" className="synth-logo footer-logo">
                <img src="/assets/twinmind-logo.png" alt="" />
                <span>TwinMind</span>
              </Link>
              <p className="synth-footer-desc">
                AI-powered learning companion. Study smarter, predict performance,
                and prevent burnout.
              </p>
              <div className="synth-socials">
                <a href="https://github.com/sabarna28m/Twin_Mind" target="_blank" rel="noreferrer" aria-label="GitHub">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.2c3-.3 6-1.5 6-6.5a5.5 5.5 0 0 0-1.5-3.8 5.5 5.5 0 0 0-.1-3.8s-1.2-.4-3.9 1.4a13.3 13.3 0 0 0-7 0c-2.7-1.8-3.9-1.4-3.9-1.4a5.5 5.5 0 0 0-.1 3.8 5.5 5.5 0 0 0-1.5 3.8c0 5 3 6.2 6 6.5a4.8 4.8 0 0 0-1 3.2v4"/><path d="M9 22v-4a4.8 4.8 0 0 0-1-3.2"/></svg>
                </a>
              </div>
            </div>

            <div className="synth-footer-col">
              <h4>MAIN PAGES</h4>
              <nav>
                <Link to="/">Home</Link>
                <a href="#features">Features</a>
                <a href="#how">How it Works</a>
                <a href="#testimonials">Testimonials</a>
              </nav>
            </div>

            <div className="synth-footer-col">
              <h4>INNER PAGES</h4>
              <nav>

                <Link to="/register">Sign Up</Link>
                <Link to="/login">Log In</Link>
                <Link to="/dashboard">Dashboard</Link>
              </nav>
            </div>

            <div className="synth-footer-col">
              <h4>LEGAL PAGES</h4>
              <nav>
                <Link to="#">Privacy Policy</Link>
                <Link to="#">Terms of Service</Link>
                <Link to="#">Cookie Policy</Link>
              </nav>
            </div>
          </div>

          <div className="synth-footer-bottom">
            <p>© {new Date().getFullYear()} TwinMind. All rights reserved.</p>
            <p>Designed with love.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
