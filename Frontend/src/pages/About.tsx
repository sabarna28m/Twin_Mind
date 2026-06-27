import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import TwinMindLogo from '../components/TwinMindLogo';
import { Sparkles, UserCircle2, BrainCircuit, HeartPulse } from 'lucide-react';
import './Home.css';

const VALUES = [
  {
    title: 'Personalised, not generic',
    desc: 'Every recommendation, every prediction, every nudge is tuned to your unique learning DNA. No two TwinMind experiences are alike.',
    icon: <UserCircle2 className="w-6 h-6" />,
  },
  {
    title: 'Sustainable growth',
    desc: 'We monitor your wellbeing alongside performance. The best students are those who stay healthy, rested, and motivated.',
    icon: <HeartPulse className="w-6 h-6" />,
  },
  {
    title: 'Evidence over guesswork',
    desc: 'Every feature is backed by data. Your study insights, predictions, and progress are grounded in ML models you can trust.',
    icon: <BrainCircuit className="w-6 h-6" />,
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as any } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function About() {
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
            <Link to="/about" className="text-slate-900 font-semibold transition-colors">About</Link>
            <Link to="/#features" className="hover:text-slate-900 transition-colors">Features</Link>
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
            <span className="text-slate-500">Our Mission</span>
          </motion.div>
          
          <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.1] mb-6">
            Empowering the <span className="text-slate-700">Next Generation</span>
          </motion.h1>

          <motion.div variants={fadeUp} className="flex justify-center mb-6">
            <svg width="120" height="20" viewBox="0 0 120 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-blue-300/50">
              <path d="M0 10C10 10 10 0 20 0C30 0 30 10 40 10C50 10 50 20 60 20C70 20 70 10 80 10C90 10 90 0 100 0C110 0 110 10 120 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </motion.div>

          <motion.p variants={fadeUp} className="text-lg text-slate-500 leading-relaxed max-w-2xl mx-auto mb-10">
            TwinMind was founded on a simple premise: education should adapt to you, not the other way around. 
            We're building an ecosystem where AI acts as a dedicated mentor, analyst, and guardian for every student.
          </motion.p>
        </motion.div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-24 px-6 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer} className="text-center mb-16">
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Our Core Values
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VALUES.map((v, i) => (
              <motion.div key={v.title} variants={fadeUp} className="saasable-card flex flex-col items-center text-center">
                <div className="saasable-icon-circle">
                  {v.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{v.title}</h3>
                <p className="text-slate-500 leading-relaxed">{v.desc}</p>
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
