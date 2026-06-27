import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import TwinMindLogo from '../components/TwinMindLogo';
import { Brain, Target, Shield, Award, Bot, FileText, Briefcase, Calendar, TrendingUp, Sparkles, Star } from 'lucide-react';
import './Home.css';

const FEATURES = [
  { icon: <TrendingUp className="w-6 h-6" />, title: 'Predictive Analytics', desc: 'ML models analyse your learning velocity and predict exam performance weeks in advance, so you can intervene early.' },
  { icon: <Brain className="w-6 h-6" />, title: 'Digital Twin AI', desc: 'Your personal AI model learns your study patterns, strengths, and knowledge gaps to adapt recommendations in real time.' },
  { icon: <Target className="w-6 h-6" />, title: 'Smart Focus Sessions', desc: 'Pomodoro timers, deep work modes, and real-time concentration analytics to maximise every study session.' },
  { icon: <Shield className="w-6 h-6" />, title: 'Burnout Guardian', desc: 'Proactive early-warning system detecting cognitive fatigue patterns before burnout sets in.' },
  { icon: <Award className="w-6 h-6" />, title: 'Gamified Learning', desc: 'XP system, achievement badges, skill trees, and competitive battles with peers to make studying engaging.' },
  { icon: <Bot className="w-6 h-6" />, title: 'AI Mentor & Coach', desc: 'Multi-agent AI with specialised tutors per subject, providing Socratic guidance and personalised explanations.' }
];

const TESTIMONIALS = [
  { text: "TwinMind helped me go from struggling with interview answers to landing my first tech role — in six months of consistent practice.", author: "Ananya Patel", role: "M.Sc. Computer Science" },
  { text: "The burnout guardian literally saved my semester. It knew I was crashing before I did and forced me to take a breather.", author: "James Chen", role: "Undergraduate Student" },
  { text: "Very organized platform. Love the ability to see my digital twin's health mirror my own study habits.", author: "Sarah Jenkins", role: "Self-Taught Developer" }
];

const TECH = [
  { name: 'React 19', icon: '⚛️' },
  { name: 'Next.js', icon: 'N' },
  { name: 'FastAPI', icon: '🚀' },
  { name: 'TypeScript', icon: 'TS' },
  { name: 'PostgreSQL', icon: '🐘' }
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function Home() {
  const { token } = useAuth();
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="saasable-root">
      {/* ── NAV ── */}
      <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4 pointer-events-none">
        <nav className={`pointer-events-auto flex items-center justify-between px-6 py-3 w-full max-w-6xl transition-all duration-300 ${navScrolled ? 'saasable-nav' : ''}`}>
          <Link to="/" className="flex items-center gap-2 text-slate-900 no-underline font-bold text-xl">
            <TwinMindLogo size={24} variant="compact" />
            <span>TwinMind</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link to="/about" className="hover:text-slate-900 transition-colors">About</Link>
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            {token && <Link to="/dashboard" className="hover:text-slate-900 transition-colors">Dashboard</Link>}
          </div>

          <div className="flex items-center gap-3">
            <a href="https://github.com/sabarna28m/Twin_Mind" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
            </a>
            {token ? (
              <Link to="/dashboard" className="saasable-btn-primary">Dashboard</Link>
            ) : (
              <Link to="/register" className="saasable-btn-primary">Start Free</Link>
            )}
          </div>
        </nav>
      </div>

      {/* ── HERO ── */}
      <section className="pt-36 pb-20 px-6 text-center max-w-4xl mx-auto">
        <motion.div initial="hidden" animate="visible" variants={staggerContainer} className="flex flex-col items-center">
          <motion.div variants={fadeUp} className="saasable-pill mb-8">
            <span className="text-slate-500">Your AI Study Companion</span>
            <span className="flex items-center gap-1 text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full text-xs">
              <Sparkles className="w-3 h-3" /> Possibilities
            </span>
          </motion.div>
          
          <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            Intelligent AI Platform for <br/> <span className="text-slate-700">Lifelong Learners</span>
          </motion.h1>

          <motion.div variants={fadeUp} className="flex justify-center mb-6">
            <svg width="120" height="20" viewBox="0 0 120 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-300/50">
              <path d="M0 10C10 10 10 0 20 0C30 0 30 10 40 10C50 10 50 20 60 20C70 20 70 10 80 10C90 10 90 0 100 0C110 0 110 10 120 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </motion.div>

          <motion.p variants={fadeUp} className="text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto mb-10">
            Design your optimal study routine and track your mental wellbeing with ease using our intelligent multi-agent ecosystem.
          </motion.p>

          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4 mb-16">
            <Link to="/register" className="saasable-btn-primary">
              <Sparkles className="w-4 h-4" /> Start Learning
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-3">
            {TECH.map(t => (
              <div key={t.name} className="saasable-pill bg-white">
                <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">{t.icon}</span>
                <span className="text-slate-700 font-medium">{t.name}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 px-6 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Comprehensive AI Toolkit Tailored to your Need
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} variants={fadeUp} className="saasable-card">
                <div className="saasable-icon-circle">
                  {f.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              See What Our Students Are Saying
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-slate-500 max-w-2xl mx-auto">
              Trusted by learners worldwide, hear how TwinMind helps bring their academic goals to life.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <motion.div key={i} variants={fadeUp} className="saasable-card flex flex-col h-full">
                <div className="flex items-center gap-1 text-blue-500 mb-4">
                  {[...Array(5)].map((_, idx) => <Star key={idx} className="w-4 h-4 fill-current" />)}
                </div>
                <h4 className="font-semibold text-slate-900 mb-2">Customer Support</h4>
                <p className="text-slate-500 leading-relaxed flex-grow mb-6">"{t.text}"</p>
                <div>
                  <p className="font-semibold text-slate-900">{t.author}</p>
                  <p className="text-sm text-slate-500">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="saasable-footer flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-medium">Copyright © 2026 TwinMind</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/about" className="text-sm text-slate-500 hover:text-slate-900 font-medium transition-colors">About Us</Link>
              <a href="#" className="text-sm text-slate-500 hover:text-slate-900 font-medium transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-slate-500 hover:text-slate-900 font-medium transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
