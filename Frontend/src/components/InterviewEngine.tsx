/**
 * InterviewEngine — Digital Twin Interview Intelligence System.
 *
 * Fully domain-aware: Medical → clinical questions, Law → legal rounds,
 * Engineering → technical rounds, etc. Zero hardcoded engineering bias.
 * All interview content is driven by the selected career and Digital Twin profile.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import api from '../services/api';

// ── Palette ───────────────────────────────────────────────────────────────

const BG     = '#060b18';
const CARD   = 'rgba(255,255,255,0.04)';
const CARD2  = 'rgba(255,255,255,0.07)';
const BORDER = '1px solid rgba(255,255,255,0.09)';
const CYAN   = '#00D4FF';
const INDIGO = '#6366f1';
const GREEN  = '#10b981';
const AMBER  = '#f59e0b';
const RED    = '#ef4444';
const PURPLE = '#8b5cf6';
const TEXT   = '#f1f5f9';
const MUTED  = '#94a3b8';
const DIM    = '#475569';

// ── Types ─────────────────────────────────────────────────────────────────

interface Msg       { role: string; content: string }
interface ScoreMap  { [dim: string]: number }

interface SessionRecord {
  id: string; date: string; career: string; domain: string;
  category: string; scores: ScoreMap; feedback: string;
  duration: number; iq: number;
}

interface VocabItem { word: string; meaning: string; example: string; tip: string }

// ── Domain configs (mirror of backend, used for UI rendering) ─────────────

const DOMAIN_CONFIGS: Record<string, {
  label: string; icon: string;
  tabs: { id: string; label: string; icon: string }[];
  scenarios: { id: string; label: string; icon: string; desc: string }[];
  modes: { id: string; label: string; icon: string; desc: string }[];
  metrics: string[];
}> = {
  medical: {
    label: 'Medical & Healthcare', icon: '🏥',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Clinical Cases', label: 'Clinical Cases', icon: '🩺' },
      { id: 'Medical Theory', label: 'Medical Theory', icon: '📚' },
      { id: 'Emergency Response', label: 'Emergency Response', icon: '🚨' },
      { id: 'Patient Communication', label: 'Patient Comms', icon: '💬' },
    ],
    scenarios: [
      { id: 'Emergency Room', label: 'Emergency Room', icon: '🚨', desc: 'Handle a critical multi-system patient under time pressure' },
      { id: 'Patient Consultation', label: 'Patient Consultation', icon: '🩺', desc: 'Take a comprehensive history and propose a management plan' },
      { id: 'Ward Round Presentation', label: 'Ward Round', icon: '📋', desc: 'Present a complex case to senior consultants' },
    ],
    modes: [
      { id: 'friendly', label: 'Junior Consultant', icon: '😊', desc: 'Supportive, case-based discussion' },
      { id: 'technical', label: 'Senior Specialist', icon: '🎓', desc: 'Deep clinical knowledge, evidence-based' },
      { id: 'panel', label: 'Hospital Panel', icon: '🏥', desc: 'Multi-assessor formal interview' },
      { id: 'stress', label: 'Stress Panel', icon: '⚡', desc: 'Time-pressured emergency scenarios' },
    ],
    metrics: ['Clinical Knowledge', 'Communication', 'Confidence', 'Decision Making', 'Patient Empathy'],
  },
  nursing: {
    label: 'Nursing & Patient Care', icon: '💉',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Clinical Practice', label: 'Clinical Practice', icon: '💊' },
      { id: 'Patient Care', label: 'Patient Care', icon: '❤️' },
      { id: 'Emergency Protocols', label: 'Emergency Protocols', icon: '🚨' },
      { id: 'Professional Standards', label: 'Professional Standards', icon: '📜' },
    ],
    scenarios: [
      { id: 'Code Blue Response', label: 'Code Blue', icon: '🚨', desc: 'Respond to a cardiac arrest as the first nurse on scene' },
      { id: 'Patient Handover', label: 'Patient Handover', icon: '📋', desc: 'Conduct a structured SBAR handover to the incoming shift' },
      { id: 'Difficult Patient', label: 'Difficult Patient', icon: '🩹', desc: 'Manage an agitated, non-compliant patient with empathy' },
    ],
    modes: [
      { id: 'friendly', label: 'Nursing Supervisor', icon: '😊', desc: 'Supportive new-graduate interview' },
      { id: 'technical', label: 'Clinical Director', icon: '🎓', desc: 'Detailed clinical competency testing' },
      { id: 'panel', label: 'Hospital Panel', icon: '🏥', desc: 'Multi-assessor formal evaluation' },
      { id: 'stress', label: 'Emergency Panel', icon: '⚡', desc: 'High-pressure scenario under time constraint' },
    ],
    metrics: ['Clinical Skills', 'Patient Care', 'Communication', 'Confidence', 'Professional Ethics'],
  },
  pharmacy: {
    label: 'Pharmacy & Drug Sciences', icon: '💊',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Drug Knowledge', label: 'Drug Knowledge', icon: '💊' },
      { id: 'Clinical Pharmacy', label: 'Clinical Pharmacy', icon: '🔬' },
      { id: 'Regulatory Affairs', label: 'Regulatory', icon: '📜' },
      { id: 'Patient Counseling', label: 'Patient Counseling', icon: '💬' },
    ],
    scenarios: [
      { id: 'Drug Interaction Alert', label: 'Drug Interaction', icon: '⚠️', desc: 'Identify and resolve a critical drug interaction for a patient' },
      { id: 'Pharmacovigilance Report', label: 'Adverse Event', icon: '📋', desc: 'Handle a serious adverse drug reaction report' },
      { id: 'Patient Counseling Session', label: 'Counseling Session', icon: '💬', desc: 'Counsel a patient on a new chronic medication regimen' },
    ],
    modes: [
      { id: 'friendly', label: 'Senior Pharmacist', icon: '😊', desc: 'Mentorship-oriented practical discussion' },
      { id: 'technical', label: 'Clinical Pharmacologist', icon: '🎓', desc: 'Deep pharmacology and drug therapy focus' },
      { id: 'panel', label: 'Hospital Committee', icon: '🏥', desc: 'Formal multi-panel assessment' },
      { id: 'stress', label: 'Regulatory Audit', icon: '⚡', desc: 'Compliance under pressure' },
    ],
    metrics: ['Drug Knowledge', 'Clinical Reasoning', 'Communication', 'Confidence', 'Regulatory Awareness'],
  },
  law: {
    label: 'Law & Legal Practice', icon: '⚖️',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Legal Reasoning', label: 'Legal Reasoning', icon: '⚖️' },
      { id: 'Case Studies', label: 'Case Studies', icon: '📂' },
      { id: 'Constitutional Law', label: 'Constitutional Law', icon: '📜' },
      { id: 'Courtroom Skills', label: 'Courtroom Skills', icon: '🏛️' },
    ],
    scenarios: [
      { id: 'Moot Court', label: 'Moot Court', icon: '🏛️', desc: 'Argue a constitutional matter before a bench of judges' },
      { id: 'Client Consultation', label: 'Client Consultation', icon: '💼', desc: 'Advise a new client on their legal options and risks' },
      { id: 'Cross-Examination', label: 'Cross-Examination', icon: '🎤', desc: 'Cross-examine a hostile witness in a criminal trial' },
    ],
    modes: [
      { id: 'friendly', label: 'Junior Advocate', icon: '😊', desc: 'Collegial experience-sharing discussion' },
      { id: 'technical', label: 'Senior Counsel', icon: '🎓', desc: 'Rigorous legal knowledge and case examination' },
      { id: 'panel', label: 'Law Firm Panel', icon: '🏛️', desc: 'Formal multi-assessor evaluation' },
      { id: 'stress', label: 'Courtroom Cross-Examination', icon: '⚡', desc: 'Adversarial, high-pressure challenge' },
    ],
    metrics: ['Legal Knowledge', 'Analytical Thinking', 'Communication', 'Confidence', 'Professional Ethics'],
  },
  finance: {
    label: 'Finance & Commerce', icon: '📊',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Financial Analysis', label: 'Financial Analysis', icon: '📊' },
      { id: 'Accounting & Taxation', label: 'Accounting & Tax', icon: '🧮' },
      { id: 'Investment & Markets', label: 'Investment & Markets', icon: '📈' },
      { id: 'Case Studies', label: 'Case Studies', icon: '💼' },
    ],
    scenarios: [
      { id: 'Financial Modelling Challenge', label: 'Financial Model', icon: '📊', desc: 'Build a quick DCF model and defend your assumptions' },
      { id: 'Investment Pitch', label: 'Investment Pitch', icon: '📈', desc: 'Pitch a stock or investment idea to a fund manager' },
      { id: 'M&A Case Study', label: 'M&A Case', icon: '🤝', desc: 'Analyse a merger scenario for strategic and financial fit' },
    ],
    modes: [
      { id: 'friendly', label: 'Finance Manager', icon: '😊', desc: 'Supportive career-guiding conversation' },
      { id: 'technical', label: 'CFO / Director', icon: '🎓', desc: 'Deep financial modelling and analysis focus' },
      { id: 'panel', label: 'Investment Bank Panel', icon: '🏦', desc: 'Formal multi-round assessment' },
      { id: 'stress', label: 'Stress Test', icon: '⚡', desc: 'Time-pressured case analysis' },
    ],
    metrics: ['Financial Knowledge', 'Analytical Skills', 'Communication', 'Confidence', 'Problem Solving'],
  },
  management: {
    label: 'Management & Business', icon: '💼',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Business Strategy', label: 'Business Strategy', icon: '🎯' },
      { id: 'Leadership & OB', label: 'Leadership & OB', icon: '👥' },
      { id: 'Marketing & Sales', label: 'Marketing & Sales', icon: '📣' },
      { id: 'Case Studies', label: 'Case Studies', icon: '📋' },
    ],
    scenarios: [
      { id: 'Business Crisis Simulation', label: 'Business Crisis', icon: '🔥', desc: 'Manage a company through a sudden PR crisis or market downturn' },
      { id: 'Leadership Challenge', label: 'Leadership Challenge', icon: '👥', desc: 'Lead a difficult team through organisational change' },
      { id: 'Investor Pitch', label: 'Investor Pitch', icon: '🚀', desc: 'Pitch your business plan to a panel of angel investors' },
    ],
    modes: [
      { id: 'friendly', label: 'HR Manager', icon: '😊', desc: 'Culture-fit and motivation assessment' },
      { id: 'technical', label: 'Business Director', icon: '🎓', desc: 'Strategic case and framework testing' },
      { id: 'panel', label: 'Consulting Panel', icon: '🏢', desc: 'Formal case + fit interview' },
      { id: 'stress', label: 'Board Presentation', icon: '⚡', desc: 'High-stakes business defence' },
    ],
    metrics: ['Business Acumen', 'Leadership', 'Communication', 'Confidence', 'Strategic Thinking'],
  },
  engineering: {
    label: 'Engineering & Technology', icon: '⚙️',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Technical Concepts', label: 'Technical Concepts', icon: '💻' },
      { id: 'System Design', label: 'System Design', icon: '🏗️' },
      { id: 'Coding / Problem Solving', label: 'Coding & Problems', icon: '🧩' },
      { id: 'Behavioral', label: 'Behavioral', icon: '🧠' },
    ],
    scenarios: [
      { id: 'System Design Challenge', label: 'System Design', icon: '🏗️', desc: 'Design a scalable distributed system under constraints' },
      { id: 'Debugging Challenge', label: 'Debugging', icon: '🐛', desc: 'Identify and fix bugs in a complex codebase under time pressure' },
      { id: 'Architecture Review', label: 'Architecture Review', icon: '📐', desc: 'Review and critique a system architecture proposal' },
    ],
    modes: [
      { id: 'friendly', label: 'Engineering Manager', icon: '😊', desc: 'Team culture and technical breadth' },
      { id: 'technical', label: 'Senior Engineer', icon: '🎓', desc: 'Deep technical probing, whiteboard coding' },
      { id: 'panel', label: 'Tech Loop', icon: '💻', desc: 'Multi-stage technical + behavioral' },
      { id: 'stress', label: 'Timed Algorithm', icon: '⚡', desc: 'Competitive programming under pressure' },
    ],
    metrics: ['Technical Knowledge', 'Problem Solving', 'Communication', 'Confidence', 'System Thinking'],
  },
  education: {
    label: 'Education & Teaching', icon: '🎓',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Classroom Management', label: 'Classroom Mgmt', icon: '🏫' },
      { id: 'Subject Knowledge', label: 'Subject Knowledge', icon: '📚' },
      { id: 'Student Psychology', label: 'Student Psychology', icon: '🧠' },
      { id: 'Teaching Demonstration', label: 'Teaching Demo', icon: '🎯' },
    ],
    scenarios: [
      { id: 'Classroom Management Simulation', label: 'Classroom Situation', icon: '🏫', desc: 'Handle a disruptive classroom incident professionally' },
      { id: 'Parent-Teacher Meeting', label: 'Parent Meeting', icon: '👨‍👩‍👧', desc: 'Discuss a struggling student with concerned parents' },
      { id: 'Lesson Delivery', label: 'Live Lesson', icon: '🎯', desc: 'Deliver a 5-minute lesson on a topic of your choice' },
    ],
    modes: [
      { id: 'friendly', label: 'School Principal', icon: '😊', desc: 'Values-centered collaborative assessment' },
      { id: 'technical', label: 'Academic Director', icon: '🎓', desc: 'Curriculum expertise and pedagogy focus' },
      { id: 'panel', label: 'School Board Panel', icon: '🏫', desc: 'Formal multi-assessor interview' },
      { id: 'stress', label: 'Observed Teaching', icon: '⚡', desc: 'Live classroom simulation with feedback' },
    ],
    metrics: ['Subject Mastery', 'Pedagogical Skills', 'Communication', 'Confidence', 'Student Empathy'],
  },
  general: {
    label: 'Professional Career', icon: '💼',
    tabs: [
      { id: 'HR', label: 'HR Round', icon: '👔' },
      { id: 'Domain Knowledge', label: 'Domain Knowledge', icon: '📚' },
      { id: 'Problem Solving', label: 'Problem Solving', icon: '🧩' },
      { id: 'Communication', label: 'Communication', icon: '💬' },
      { id: 'Behavioral', label: 'Behavioral', icon: '🧠' },
    ],
    scenarios: [
      { id: 'Stakeholder Conflict', label: 'Stakeholder Conflict', icon: '🤝', desc: 'Navigate a conflict between two key stakeholders in a project' },
      { id: 'Crisis Management', label: 'Crisis Management', icon: '🔥', desc: 'Lead the response to an unexpected business crisis' },
      { id: 'Presentation Challenge', label: 'Presentation', icon: '🎤', desc: 'Deliver a persuasive 3-minute pitch on a professional topic' },
    ],
    modes: [
      { id: 'friendly', label: 'HR Generalist', icon: '😊', desc: 'Culture-fit and motivation assessment' },
      { id: 'technical', label: 'Department Head', icon: '🎓', desc: 'Domain expertise and problem-solving focus' },
      { id: 'panel', label: 'Panel Interview', icon: '🏢', desc: 'Multi-perspective comprehensive evaluation' },
      { id: 'stress', label: 'Pressure Interview', icon: '⚡', desc: 'Challenging follow-ups, rapid-fire questions' },
    ],
    metrics: ['Domain Knowledge', 'Problem Solving', 'Communication', 'Confidence', 'Leadership'],
  },
};

// Domain-to-config lookup with fallback
function getDomainConfig(domain: string) {
  return DOMAIN_CONFIGS[domain] ?? DOMAIN_CONFIGS.general;
}

// ── Vocabulary data (per domain) ──────────────────────────────────────────

const VOCAB_DATA: Record<string, VocabItem[]> = {
  medical: [
    { word: 'Differential Diagnosis', meaning: 'Systematic process of distinguishing a condition from others with similar presentation', example: 'The differential diagnosis for chest pain includes MI, PE, and aortic dissection.', tip: 'Use when explaining clinical reasoning — shows structured thinking.' },
    { word: 'Pathophysiology', meaning: 'Functional changes in the body associated with a disease', example: 'The pathophysiology of type 2 diabetes involves insulin resistance and beta-cell dysfunction.', tip: "Explain the 'why' behind symptoms to impress clinical interviewers." },
    { word: 'Triage', meaning: 'Process of sorting patients by urgency of care needed', example: 'In triage, we follow the ABCDE approach: Airway, Breathing, Circulation, Disability, Exposure.', tip: 'Show systematic emergency thinking — essential for clinical rounds.' },
    { word: 'Contraindication', meaning: 'A condition making a particular treatment inadvisable', example: 'Metformin is contraindicated in severe renal impairment due to risk of lactic acidosis.', tip: 'Mentioning contraindications shows comprehensive clinical safety awareness.' },
    { word: 'Comorbidity', meaning: 'Coexistence of additional chronic conditions alongside a primary diagnosis', example: 'The patient has comorbid hypertension and diabetic nephropathy requiring holistic management.', tip: 'Acknowledging comorbidities shows complex patient management thinking.' },
    { word: 'Prognosis', meaning: 'Predicted course and likely outcome of a disease', example: 'With early surgical intervention, the prognosis for recovery is excellent.', tip: "Express with appropriate uncertainty: 'guarded,' 'favorable,' or 'poor.'" },
    { word: 'Informed Consent', meaning: "Patient's voluntary agreement after understanding risks, benefits, and alternatives", example: 'Informed consent was obtained explaining the procedure and all potential complications.', tip: 'Critical for patient communication rounds — emphasise autonomy and transparency.' },
    { word: 'Evidence-Based Medicine', meaning: 'Integration of best research evidence with clinical expertise and patient values', example: 'Our management follows current NICE guidelines, consistent with evidence-based medicine.', tip: 'Shows you value research over tradition — key for modern medical interviews.' },
  ],
  law: [
    { word: 'Locus Standi', meaning: 'Legal standing — the right to bring a case before a court', example: 'The petitioner must establish locus standi before challenging this government policy.', tip: 'Always address standing before engaging on merits in litigation scenarios.' },
    { word: 'Mens Rea', meaning: 'Criminal intent — the mental element required for a criminal offence', example: 'The prosecution must prove both actus reus and mens rea to establish liability.', tip: 'Essential for criminal law rounds — always pair with actus reus.' },
    { word: 'Res Judicata', meaning: 'Doctrine preventing re-litigation of a matter already finally decided', example: 'The principle of res judicata bars the petitioner from re-agitating this settled claim.', tip: 'Shows procedural mastery — key for civil litigation discussions.' },
    { word: 'Injunction', meaning: 'Court order requiring a party to do or refrain from doing a specific act', example: 'An interim injunction was granted restraining the defendant from publishing the material.', tip: 'Know the three-part test: prima facie case, balance of convenience, irreparable harm.' },
    { word: 'Estoppel', meaning: 'Principle preventing a party from contradicting a previous statement they made', example: 'Promissory estoppel prevents the company from retracting its contractual promise.', tip: 'Shows nuanced understanding of equity principles in contract and tort law.' },
    { word: 'Jurisdiction', meaning: 'Authority of a court to hear and decide a case', example: 'The High Court has jurisdiction under Article 226 to issue writs of mandamus.', tip: 'Always establish jurisdiction before proceeding with any legal argument.' },
    { word: 'Tortious Liability', meaning: 'Legal responsibility arising from a civil wrong independent of contract', example: 'The manufacturer bears tortious liability under strict liability for the defective product.', tip: 'Distinguish from contractual liability — tort requires no prior agreement.' },
    { word: 'Arbitration', meaning: 'Alternative dispute resolution where a neutral arbitrator makes a binding decision', example: 'The parties agreed to resolve the dispute through arbitration under the Arbitration Act.', tip: 'Demonstrate ADR advantages: speed, confidentiality, finality, expertise.' },
  ],
  finance: [
    { word: 'EBITDA', meaning: 'Earnings Before Interest, Taxes, Depreciation and Amortisation — operating performance measure', example: 'The EBITDA margin improved from 18% to 23%, indicating strong operational efficiency.', tip: 'Use for valuation and cross-company comparisons — always contextualise with sector benchmarks.' },
    { word: 'DCF (Discounted Cash Flow)', meaning: 'Valuation estimating investment value by discounting future cash flows to present value', example: 'The DCF analysis yielded an intrinsic value of ₹450 per share versus the current ₹380.', tip: 'Always state assumptions: WACC, terminal growth rate, projection period.' },
    { word: 'Working Capital', meaning: 'Difference between current assets and current liabilities — short-term financial health', example: 'A negative working capital cycle means the company is effectively funded by its suppliers.', tip: 'Show liquidity management understanding beyond just the balance sheet number.' },
    { word: 'Beta', meaning: "Measure of a stock's volatility relative to the overall market", example: 'A beta of 1.5 indicates the stock is 50% more volatile than the benchmark index.', tip: 'Connect to CAPM: required return = risk-free rate + beta × market risk premium.' },
    { word: 'Covenant', meaning: 'Restrictions or obligations placed on borrowers by lenders in loan agreements', example: 'The loan covenant requires the borrower to maintain a Debt/EBITDA ratio below 3x.', tip: 'Shows credit analysis depth — important for banking and private equity interviews.' },
    { word: 'NPV (Net Present Value)', meaning: 'Present value of all future cash flows net of initial investment', example: 'The project has a positive NPV of ₹12 crore, making it value-accretive to the firm.', tip: 'Always state the discount rate used — demonstrates cost of capital awareness.' },
    { word: 'Leverage', meaning: 'Use of borrowed capital to amplify returns — also amplifies risk', example: 'High leverage (Debt/EBITDA > 4x) signals elevated financial distress risk.', tip: 'Discuss both operating and financial leverage to show depth of understanding.' },
    { word: 'Amortisation', meaning: 'Gradual reduction of debt over time or spreading intangible asset costs over useful life', example: 'Goodwill from the acquisition is being amortised over 10 years under local GAAP.', tip: 'Distinguish from depreciation: amortisation = intangibles; depreciation = tangible assets.' },
  ],
  management: [
    { word: 'Value Proposition', meaning: 'Clear statement of why customers should choose your product over competitors', example: 'Our value proposition is 40% faster delivery at parity pricing through AI-optimised logistics.', tip: 'Answer: What do we offer? Who for? What problem does it solve?' },
    { word: "Porter's Five Forces", meaning: 'Framework analysing industry competitiveness across five dimensions', example: "Porter's analysis reveals high buyer power in B2C e-commerce undermining margins.", tip: 'Walk through all five forces systematically — never skip any.' },
    { word: 'KPI', meaning: 'Key Performance Indicator — measurable value demonstrating achievement of objectives', example: 'Our primary KPIs are customer acquisition cost and LTV:CAC ratio.', tip: 'Connect KPIs to strategic objectives — shows business alignment thinking.' },
    { word: 'SWOT Analysis', meaning: 'Framework evaluating Strengths, Weaknesses, Opportunities, and Threats', example: 'The SWOT revealed strong brand equity but dangerous single-supplier dependency.', tip: 'Go beyond listing — synthesise into strategic implications and recommendations.' },
    { word: 'OKR', meaning: 'Objectives and Key Results — goal-setting framework linking ambition to measurable outcomes', example: 'Q3 OKR — Objective: Lead North India; KR: Achieve 30% market share in Delhi-NCR.', tip: 'Demonstrates familiarity with modern performance management frameworks.' },
    { word: 'Go-to-Market (GTM)', meaning: 'Plan specifying how a company reaches target customers and achieves advantage', example: 'Our GTM targets Tier 2 cities through hyperlocal delivery and vernacular-first UX.', tip: 'Always address channel, pricing, positioning, and launch sequence.' },
    { word: 'Burn Rate', meaning: 'Rate at which a company spends its cash reserves, typically measured monthly', example: 'With a monthly burn rate of ₹50L and 18 months of runway, profitability is critical.', tip: 'Critical startup metric — shows financial discipline and planning capability.' },
    { word: 'Synergy', meaning: 'The combined value of merged entities exceeding the sum of their individual parts', example: 'The merger generates ₹200 crore in cost synergies through supply chain consolidation.', tip: 'Always quantify synergies in M&A cases — stress-test assumptions.' },
  ],
  engineering: [
    { word: 'CAP Theorem', meaning: 'Distributed systems can guarantee only two of: Consistency, Availability, Partition Tolerance', example: 'We chose AP over CP, making our service eventually consistent but always available.', tip: 'Know real-world examples: Cassandra (AP), HBase (CP), ZooKeeper (CP).' },
    { word: 'Idempotency', meaning: 'Property where repeated operations produce the same result as a single operation', example: "Our payment API is idempotent — retrying with the same key never double-charges.", tip: 'Essential for API design — shows failure-handling maturity.' },
    { word: 'Horizontal Scaling', meaning: 'Adding more machines to handle increased load (scale out vs scale up)', example: 'We horizontally scaled from 3 to 12 service instances to handle Black Friday traffic.', tip: 'Explain why horizontal is preferred for modern distributed systems.' },
    { word: 'Latency vs Throughput', meaning: 'Latency = time per request; Throughput = requests handled per unit time', example: 'Adding a Redis cache cut P99 latency from 800ms to 120ms at the same throughput.', tip: 'In system design, specify which you optimise for and the inherent trade-offs.' },
    { word: 'Eventual Consistency', meaning: 'Distributed model where nodes converge to consistent state over time, not instantly', example: 'Shopping cart updates use eventual consistency — inventory may lag by 500ms.', tip: 'Contrast with strong consistency — know when each is appropriate.' },
    { word: 'Microservices', meaning: 'Architecture decomposing applications into small, independently deployable services', example: 'We decomposed our monolith into 8 microservices, reducing deployment risk.', tip: 'Always discuss trade-offs: operational complexity, distributed tracing, latency.' },
    { word: 'Big-O Notation', meaning: 'Measure of how algorithm runtime or space grows relative to input size', example: 'Switching from O(n²) bubble sort to O(n log n) merge sort reduced time by 94%.', tip: 'Always provide both time AND space complexity with trade-off explanation.' },
    { word: 'Load Balancing', meaning: 'Distributing network traffic across multiple servers to ensure reliability and performance', example: 'Our L7 load balancer routes traffic using round-robin with session affinity.', tip: 'Know Layer 4 vs Layer 7 differences and when to use each.' },
  ],
  education: [
    { word: "Bloom's Taxonomy", meaning: 'Hierarchical framework for educational learning objectives from recall to creation', example: 'My lesson progresses from recall questions to synthesis tasks, following Bloom.', tip: 'Reference Bloom\'s when explaining how you differentiate assessment difficulty.' },
    { word: 'Differentiated Instruction', meaning: 'Teaching approach adjusting content, process, and product for individual student needs', example: 'I use tiered assignments and flexible grouping for differentiated instruction.', tip: 'Demonstrates awareness of diverse learning needs — essential for modern classrooms.' },
    { word: 'Zone of Proximal Development', meaning: "Vygotsky's concept: the gap between what students can do alone vs with guided support", example: 'I scaffold tasks within the ZPD to challenge students just beyond independent capability.', tip: 'Connects naturally to peer learning, scaffolding, and collaborative activities.' },
    { word: 'Formative Assessment', meaning: 'Ongoing low-stakes evaluation used to monitor learning and provide real-time feedback', example: 'Exit tickets and think-pair-share are formative assessments I use every lesson.', tip: 'Distinguish from summative — formative informs teaching, summative grades performance.' },
    { word: 'Scaffolding', meaning: "Temporary support to help students accomplish tasks beyond their current independent ability", example: 'I use sentence starters and graphic organisers as scaffolds for English language learners.', tip: 'Always explain how you plan to gradually remove scaffolds as competence grows.' },
    { word: 'Growth Mindset', meaning: "Carol Dweck's theory that abilities can be developed through dedication and effort", example: "I use 'not yet' instead of 'wrong' to cultivate a growth mindset culture.", tip: "Reference Dweck's research — shows engagement with contemporary educational psychology." },
    { word: 'UDL (Universal Design for Learning)', meaning: 'Framework providing multiple means of engagement, representation, and expression', example: 'I applied UDL by offering audio, visual, and kinesthetic learning options for all students.', tip: 'Essential for inclusive education — shows proactive accessibility planning.' },
    { word: 'Pedagogical Content Knowledge', meaning: 'Integration of subject matter expertise with effective teaching methods', example: 'My PCK lets me anticipate common algebra misconceptions and address them proactively.', tip: 'Coined by Shulman — demonstrates you understand both WHAT and HOW to teach.' },
  ],
  general: [
    { word: 'Stakeholder Management', meaning: 'Process of identifying, analysing, and communicating with those affected by a project', example: 'Effective stakeholder management secured executive buy-in for our digital transformation.', tip: 'Show structure: identify, assess influence/interest, tailor communication.' },
    { word: 'SMART Goals', meaning: 'Goals that are Specific, Measurable, Achievable, Relevant, and Time-bound', example: 'My SMART goal: increase team productivity 20% by Q3 through agile implementation.', tip: 'Use this framework when discussing personal or team goal-setting.' },
    { word: 'ROI', meaning: 'Return on Investment — performance measure evaluating the efficiency of an investment', example: 'The training programme delivered 3x ROI through reduced turnover and higher productivity.', tip: 'Always quantify ROI with numbers — concrete metrics make answers compelling.' },
    { word: 'Emotional Intelligence (EI)', meaning: 'Ability to perceive, understand, manage, and use emotions effectively', example: 'High EI helped me de-escalate team conflicts and maintain productivity during change.', tip: "Use Goleman's framework: self-awareness, self-regulation, empathy, social skills." },
    { word: 'Critical Path', meaning: 'Longest sequence of dependent tasks determining the minimum project duration', example: 'Identifying the critical path let us allocate resources to bottlenecks and deliver on time.', tip: 'Connects to resource allocation and risk management — shows project management maturity.' },
    { word: 'Agile Methodology', meaning: 'Iterative approach to project management emphasising flexibility and continuous improvement', example: 'Using agile sprints, we reduced time-to-market by 40% while maintaining quality.', tip: 'Know Agile vs Scrum vs Kanban differences and appropriate contexts for each.' },
    { word: 'Cross-functional Collaboration', meaning: 'Working across different departments or disciplines to achieve shared objectives', example: 'I led cross-functional collaboration between engineering, design, and marketing.', tip: 'Emphasise facilitation skills — show you can bridge different professional languages.' },
    { word: 'Value Chain Analysis', meaning: "Framework identifying activities within an organisation that create value for the customer", example: 'The value chain analysis revealed procurement as our key cost driver.', tip: "Use Porter's Value Chain to show systematic thinking about competitive advantage." },
  ],
};

function getVocab(domain: string): VocabItem[] {
  return VOCAB_DATA[domain] ?? VOCAB_DATA.general;
}

// ── Helpers ───────────────────────────────────────────────────────────────

const FILLER_WORDS = ['um', 'uh', 'umm', 'uhh', 'like', 'you know', 'basically', 'actually', 'literally', 'kind of', 'sort of', 'right', 'well', 'i mean'];

function countFillers(text: string): number {
  const lower = text.toLowerCase();
  return FILLER_WORDS.reduce((n, fw) => {
    const m = lower.match(new RegExp(`\\b${fw}\\b`, 'g'));
    return n + (m?.length ?? 0);
  }, 0);
}

function iqLabel(score: number): string {
  if (score >= 90) return 'Elite Candidate';
  if (score >= 75) return 'Industry Ready';
  if (score >= 60) return 'Professional';
  if (score >= 40) return 'Developing';
  return 'Beginner';
}

function iqColor(score: number): string {
  if (score >= 90) return '#FFD700';
  if (score >= 75) return GREEN;
  if (score >= 60) return CYAN;
  if (score >= 40) return AMBER;
  return MUTED;
}

function calcSessionIQ(sessions: SessionRecord[]): number {
  if (!sessions.length) return 0;
  const recent = sessions.slice(-5);
  const avg = recent.reduce((s, r) => {
    const vals = Object.values(r.scores);
    return s + (vals.reduce((a, b) => a + b, 0) / (vals.length || 1));
  }, 0) / recent.length;
  const consistencyBonus = sessions.length >= 3 ? 5 : 0;
  return Math.min(99, Math.round(avg + consistencyBonus));
}

const LS_KEY = 'twinmind_interview_sessions';
function loadSessions(): SessionRecord[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}
function saveSession(s: SessionRecord) {
  const all = loadSessions();
  all.push(s);
  localStorage.setItem(LS_KEY, JSON.stringify(all.slice(-50)));
}

// ── Primitive components ──────────────────────────────────────────────────

function Bar2({ value, color, h = 6 }: { value: number; color: string; h?: number }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 99, height: h, overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.9s ease' }} />
    </div>
  );
}

function ScoreRing({ score, color, size = 100 }: { score: number; color: string; size?: number }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, d = (score / 100) * c;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${d} ${c - d}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease', filter: `drop-shadow(0 0 6px ${color}88)` }} />
    </svg>
  );
}

function IQBadge({ score }: { score: number }) {
  const color = iqColor(score);
  const label = iqLabel(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <ScoreRing score={score} color={color} size={90} />
        <div style={{ position: 'absolute', textAlign: 'center' }}>
          <div style={{ fontSize: '1.3rem', fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: '0.5rem', color: MUTED }}>IQ</div>
        </div>
      </div>
      <div>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color }}>{label}</div>
        <div style={{ fontSize: '0.7rem', color: MUTED }}>Interview Intelligence Score</div>
      </div>
    </div>
  );
}

// ── View: Hub ─────────────────────────────────────────────────────────────

function HubView({ career, domain, sessions, onStartMock, onChangeView }: {
  career: string; domain: string; sessions: SessionRecord[];
  onStartMock: () => void; onChangeView: (v: string) => void;
}) {
  const cfg = getDomainConfig(domain);
  const iq  = calcSessionIQ(sessions);
  const lastSession = sessions[sessions.length - 1];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Hero banner */}
      <div style={{ background: `linear-gradient(135deg,${INDIGO}18,${PURPLE}12)`, border: `1px solid ${INDIGO}35`, borderRadius: 20, padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '2.5rem' }}>{cfg.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: TEXT, fontWeight: 800, fontSize: '1.2rem' }}>{cfg.label} Interview System</div>
            <div style={{ color: MUTED, fontSize: '0.82rem', marginTop: 2 }}>Role: <span style={{ color: CYAN, fontWeight: 700 }}>{career}</span></div>
            <div style={{ color: MUTED, fontSize: '0.78rem', marginTop: 4 }}>
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} completed · {cfg.tabs.length} interview rounds available
            </div>
          </div>
          <IQBadge score={iq} />
        </div>
      </div>

      {/* Quick action cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.85rem' }}>
        {[
          { icon: '🎤', label: 'Mock Interview', desc: `Domain-specific ${cfg.tabs.length}-round system`, action: onStartMock, color: INDIGO },
          { icon: '📖', label: 'Vocabulary Bank', desc: `${getVocab(domain).length} domain-critical terms`, action: () => onChangeView('vocab'), color: CYAN },
          { icon: '🎭', label: 'Scenario Lab', desc: `${cfg.scenarios.length} realistic simulations`, action: () => onChangeView('scenarios'), color: PURPLE },
          { icon: '📊', label: 'Analytics', desc: 'Score trends & growth', action: () => onChangeView('analytics'), color: GREEN },
          { icon: '🗓️', label: 'Session History', desc: `${sessions.length} past interviews`, action: () => onChangeView('history'), color: AMBER },
          { icon: '🔍', label: 'Weakness Tracker', desc: 'Identify recurring gaps', action: () => onChangeView('analytics'), color: RED },
        ].map((c, i) => (
          <button key={i} onClick={c.action} style={{
            background: CARD, border: BORDER, borderRadius: 16, padding: '1.1rem',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = c.color + '60'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '0.35rem' }}>{c.icon}</div>
            <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.88rem' }}>{c.label}</div>
            <div style={{ color: MUTED, fontSize: '0.72rem', marginTop: 2 }}>{c.desc}</div>
          </button>
        ))}
      </div>

      {/* Interview rounds preview */}
      <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
        <div style={{ color: TEXT, fontWeight: 700, marginBottom: '0.75rem' }}>Interview Rounds for {cfg.label}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {cfg.tabs.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', background: 'rgba(255,255,255,0.05)', borderRadius: 99, border: BORDER }}>
              <span style={{ fontSize: '0.85rem' }}>{t.icon}</span>
              <span style={{ color: TEXT, fontSize: '0.78rem', fontWeight: 600 }}>{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Last session quick stats */}
      {lastSession && (
        <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
          <div style={{ color: MUTED, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.7rem' }}>Last Session</div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ color: TEXT, fontSize: '0.85rem', fontWeight: 600 }}>{lastSession.category}</div>
            <div style={{ color: MUTED, fontSize: '0.8rem' }}>{new Date(lastSession.date).toLocaleDateString()}</div>
            <div style={{ color: iqColor(lastSession.iq), fontWeight: 700, fontSize: '0.85rem' }}>IQ {lastSession.iq} — {iqLabel(lastSession.iq)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── View: Mock Interview ──────────────────────────────────────────────────

function MockInterviewView({ career, domain, onComplete }: {
  career: string; domain: string;
  onComplete: (session: SessionRecord) => void;
}) {
  const cfg = getDomainConfig(domain);
  const [category, setCategory]     = useState(cfg.tabs[0]?.id ?? 'HR');
  const [iMode, setIMode]           = useState('friendly');
  const [inputMode, setInputMode]   = useState<'text' | 'voice'>('text');
  const [started, setStarted]       = useState(false);
  const [history, setHistory]       = useState<Msg[]>([]);
  const [input, setInput]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [complete, setComplete]     = useState(false);
  const [scores, setScores]         = useState<ScoreMap>({});
  const [feedback, setFeedback]     = useState('');
  const [strengths, setStrengths]   = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);
  const [weakAreas, setWeakAreas]   = useState<string[]>([]);
  const [plan, setPlan]             = useState<string[]>([]);
  const [sessionIQ, setSessionIQ]   = useState(0);
  const [startTime, setStartTime]   = useState<number>(0);

  // Voice state
  const [liveText, setLiveText]    = useState('');
  const [listening, setListening]  = useState(false);
  const [wpm, setWpm]              = useState(0);
  const [fillers, setFillers]      = useState(0);
  const recogRef  = useRef<SpeechRecognition | null>(null);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRef   = useRef('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, loading]);

  // Profile context for personalisation
  const [profileCtx, setProfileCtx] = useState('');
  useEffect(() => {
    api.get('/career/interview/config', { params: { career } })
      .then(r => setProfileCtx(`${r.data.domain_label} candidate targeting ${career}`))
      .catch(() => setProfileCtx(`${cfg.label} candidate targeting ${career}`));
  }, [career, cfg.label]);

  async function startInterview() {
    setStarted(true); setHistory([]); setComplete(false);
    setScores({}); setFeedback(''); setStartTime(Date.now());
    setLoading(true);
    try {
      const r = await api.post('/career/interview/chat', {
        role: career, history: [], mode: 'question',
        category, interviewer_mode: iMode, domain, profile_context: profileCtx,
      });
      setHistory([{ role: 'assistant', content: r.data.message }]);
    } catch { setHistory([{ role: 'assistant', content: 'Ready to begin your interview. Please introduce yourself.' }]); }
    finally { setLoading(false); }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    const newHistory: Msg[] = [...history, { role: 'user', content: text }];
    setHistory(newHistory); setInput(''); setLoading(true);
    try {
      const userCount = newHistory.filter(m => m.role === 'user').length;
      const totalQ = cfg.tabs.length * 0;  // not used
      const mode = userCount >= 8 ? 'evaluate' : 'question';
      const r = await api.post('/career/interview/chat', {
        role: career, history: newHistory, mode,
        category, interviewer_mode: iMode, domain, profile_context: profileCtx,
      });
      const d = r.data;
      const withAI: Msg[] = [...newHistory, { role: 'assistant', content: d.message }];
      setHistory(withAI);
      if (d.is_complete) {
        setComplete(true);
        setScores(d.scores || {});
        setFeedback(d.feedback || '');
        setStrengths(d.strengths || []);
        setImprovements(d.improvements || []);
        setWeakAreas(d.weak_areas || []);
        setPlan(d.improvement_plan || []);
        const iq = d.interview_iq || Math.round(Object.values(d.scores || {}).reduce((a: number, b) => a + (b as number), 0) / Math.max(1, Object.keys(d.scores || {}).length));
        setSessionIQ(iq);
        const duration = Math.round((Date.now() - startTime) / 60000);
        const session: SessionRecord = {
          id: Date.now().toString(), date: new Date().toISOString(),
          career, domain, category, scores: d.scores || {},
          feedback: d.feedback || '', duration, iq,
        };
        saveSession(session);
        onComplete(session);
      }
    } catch { setHistory(h => [...h, { role: 'assistant', content: 'Connection error. Please try again.' }]); }
    finally { setLoading(false); }
  }

  // Voice recognition
  function startListening() {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
            || (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) { alert('Voice recognition not supported in this browser. Use Chrome.'); return; }
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-IN';
    liveRef.current = '';
    r.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) liveRef.current += t;
        else interim = t;
      }
      setLiveText(liveRef.current + interim);
      const words = (liveRef.current + interim).split(/\s+/).filter(Boolean);
      setWpm(Math.round(words.length * 2));
      setFillers(countFillers(liveRef.current + interim));
      if (silenceRef.current) clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => { stopListening(); sendMessage(liveRef.current); }, 3000);
    };
    r.onerror = () => stopListening();
    r.start();
    recogRef.current = r;
    setListening(true);
  }

  function stopListening() {
    recogRef.current?.stop(); recogRef.current = null;
    setListening(false);
    if (silenceRef.current) clearTimeout(silenceRef.current);
  }

  // Pre-start screen
  if (!started) return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ background: CARD, border: BORDER, borderRadius: 20, padding: '1.75rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{cfg.icon}</div>
        <div style={{ color: TEXT, fontWeight: 800, fontSize: '1.15rem' }}>Mock Interview</div>
        <div style={{ color: MUTED, fontSize: '0.82rem', marginTop: 4 }}>
          {cfg.label} · Powered by Digital Twin AI
        </div>
      </div>

      {/* Round selector */}
      <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
        <div style={{ color: MUTED, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.65rem' }}>Select Interview Round</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {cfg.tabs.map(t => (
            <button key={t.id} onClick={() => setCategory(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              padding: '0.45rem 0.9rem', borderRadius: 10, cursor: 'pointer',
              background: category === t.id ? `${INDIGO}30` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${category === t.id ? INDIGO : 'rgba(255,255,255,0.08)'}`,
              color: category === t.id ? TEXT : MUTED, fontSize: '0.78rem', fontWeight: category === t.id ? 700 : 400,
              transition: 'all 0.15s',
            }}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interviewer mode */}
      <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem' }}>
        <div style={{ color: MUTED, fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: '0.65rem' }}>Interviewer Mode</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          {cfg.modes.map(m => (
            <button key={m.id} onClick={() => setIMode(m.id)} style={{
              padding: '0.7rem', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              background: iMode === m.id ? `${PURPLE}22` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${iMode === m.id ? PURPLE + '55' : 'rgba(255,255,255,0.07)'}`,
              transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: '1rem', marginBottom: 3 }}>{m.icon}</div>
              <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.78rem' }}>{m.label}</div>
              <div style={{ color: MUTED, fontSize: '0.68rem', marginTop: 1 }}>{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Input mode */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['text', 'voice'] as const).map(m => (
          <button key={m} onClick={() => setInputMode(m)} style={{
            flex: 1, padding: '0.75rem', borderRadius: 12, cursor: 'pointer',
            background: inputMode === m ? `${CYAN}18` : CARD,
            border: `1px solid ${inputMode === m ? CYAN + '50' : 'rgba(255,255,255,0.08)'}`,
            color: inputMode === m ? CYAN : MUTED, fontWeight: inputMode === m ? 700 : 400, fontSize: '0.85rem',
            transition: 'all 0.15s',
          }}>
            {m === 'text' ? '⌨️ Text Mode' : '🎤 Voice Mode'}
          </button>
        ))}
      </div>

      <button onClick={startInterview} style={{
        padding: '0.95rem', background: `linear-gradient(135deg,${INDIGO},${PURPLE})`,
        border: 'none', borderRadius: 14, color: '#fff', fontWeight: 800, fontSize: '1rem',
        cursor: 'pointer', boxShadow: `0 8px 24px ${INDIGO}40`,
      }}>
        Start {category} Interview ›
      </button>
    </div>
  );

  // Results screen
  if (complete) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* IQ + overall */}
      <div style={{ background: `linear-gradient(135deg,${INDIGO}18,${PURPLE}12)`, border: `1px solid ${INDIGO}35`, borderRadius: 20, padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <IQBadge score={sessionIQ} />
          <div style={{ flex: 1 }}>
            <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.92rem', marginBottom: 6 }}>{feedback}</div>
            <div style={{ color: MUTED, fontSize: '0.78rem' }}>{career} · {category} Round</div>
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
        {Object.entries(scores).map(([dim, val]) => {
          const c = val >= 75 ? GREEN : val >= 55 ? AMBER : RED;
          return (
            <div key={dim} style={{ background: CARD2, border: `1px solid ${c}25`, borderRadius: 14, padding: '1rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: MUTED, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{dim}</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 900, color: c, lineHeight: 1 }}>{val}</div>
              <Bar2 value={val} color={c} h={3} />
            </div>
          );
        })}
      </div>

      {/* Strengths / Improvements */}
      {(strengths.length > 0 || improvements.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          <div style={{ background: CARD, border: `1px solid ${GREEN}30`, borderRadius: 14, padding: '1rem' }}>
            <div style={{ color: GREEN, fontWeight: 700, fontSize: '0.8rem', marginBottom: 8 }}>✓ Strengths</div>
            {strengths.map((s, i) => <div key={i} style={{ color: MUTED, fontSize: '0.8rem', marginBottom: 4 }}>• {s}</div>)}
          </div>
          <div style={{ background: CARD, border: `1px solid ${AMBER}30`, borderRadius: 14, padding: '1rem' }}>
            <div style={{ color: AMBER, fontWeight: 700, fontSize: '0.8rem', marginBottom: 8 }}>⚠ Improve</div>
            {improvements.map((s, i) => <div key={i} style={{ color: MUTED, fontSize: '0.8rem', marginBottom: 4 }}>• {s}</div>)}
          </div>
        </div>
      )}

      {/* Weak areas + improvement plan */}
      {(weakAreas.length > 0 || plan.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
          {weakAreas.length > 0 && (
            <div style={{ background: CARD, border: `1px solid ${RED}25`, borderRadius: 14, padding: '1rem' }}>
              <div style={{ color: RED, fontWeight: 700, fontSize: '0.8rem', marginBottom: 8 }}>🔍 Weak Areas</div>
              {weakAreas.map((s, i) => <div key={i} style={{ color: MUTED, fontSize: '0.8rem', marginBottom: 4 }}>• {s}</div>)}
            </div>
          )}
          {plan.length > 0 && (
            <div style={{ background: CARD, border: `1px solid ${CYAN}25`, borderRadius: 14, padding: '1rem' }}>
              <div style={{ color: CYAN, fontWeight: 700, fontSize: '0.8rem', marginBottom: 8 }}>📋 Improvement Plan</div>
              {plan.map((s, i) => <div key={i} style={{ color: MUTED, fontSize: '0.8rem', marginBottom: 4 }}>{i + 1}. {s}</div>)}
            </div>
          )}
        </div>
      )}

      <button onClick={() => { setStarted(false); setComplete(false); setHistory([]); }} style={{
        padding: '0.75rem', background: CARD, border: BORDER, borderRadius: 12,
        color: MUTED, cursor: 'pointer', fontSize: '0.88rem',
      }}>
        ← Start Another Round
      </button>
    </div>
  );

  // Active interview
  const userCount = history.filter(m => m.role === 'user').length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '72vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: MUTED, fontSize: '0.78rem' }}>
            {cfg.icon} {cfg.label} · <span style={{ color: CYAN }}>{category}</span>
          </span>
          <span style={{ color: DIM, fontSize: '0.72rem' }}>Q{userCount + 1}</span>
        </div>
        <button onClick={() => { setStarted(false); setHistory([]); }}
          style={{ padding: '0.3rem 0.8rem', background: CARD, border: BORDER, borderRadius: 8, color: MUTED, cursor: 'pointer', fontSize: '0.72rem' }}>
          Restart
        </button>
      </div>

      {/* Voice metrics bar */}
      {inputMode === 'voice' && (listening || liveText) && (
        <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 1rem', background: CARD2, borderRadius: 10, border: BORDER, flexShrink: 0 }}>
          <span style={{ color: MUTED, fontSize: '0.72rem' }}>WPM <strong style={{ color: CYAN }}>{wpm}</strong></span>
          <span style={{ color: MUTED, fontSize: '0.72rem' }}>Fillers <strong style={{ color: fillers > 3 ? RED : GREEN }}>{fillers}</strong></span>
          <span style={{ color: listening ? GREEN : MUTED, fontSize: '0.72rem' }}>{listening ? '🔴 Listening…' : '⏸ Paused'}</span>
        </div>
      )}

      {/* Chat messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
        {history.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%', padding: '0.75rem 1rem',
              borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
              background: m.role === 'user' ? `linear-gradient(135deg,${INDIGO},${PURPLE})` : CARD2,
              border: m.role === 'user' ? 'none' : BORDER,
              color: TEXT, fontSize: '0.87rem', lineHeight: 1.65,
            }}>
              {m.role === 'assistant' && (
                <div style={{ color: CYAN, fontSize: '0.65rem', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {cfg.icon} {category} Interviewer
                </div>
              )}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: MUTED, fontSize: '0.8rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: INDIGO, animation: 'pulse 1s infinite' }} />
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Live voice text preview */}
      {inputMode === 'voice' && liveText && !listening && (
        <div style={{ padding: '0.6rem 0.9rem', background: CARD, border: BORDER, borderRadius: 10, color: MUTED, fontSize: '0.82rem', flexShrink: 0 }}>
          {liveText}
        </div>
      )}

      {/* Input area */}
      {inputMode === 'text' ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Type your answer…" disabled={loading}
            style={{ flex: 1, background: CARD2, border: BORDER, borderRadius: 10, padding: '0.65rem 1rem', color: TEXT, fontSize: '0.88rem', outline: 'none' }} />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
            style={{ padding: '0.65rem 1.25rem', background: loading || !input.trim() ? DIM : INDIGO, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Send
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={listening ? stopListening : startListening}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
              background: listening ? `linear-gradient(135deg,${RED},${AMBER})` : `linear-gradient(135deg,${GREEN},${CYAN})`,
              color: '#fff', transition: 'all 0.2s',
              boxShadow: listening ? `0 0 20px ${RED}50` : `0 0 20px ${GREEN}40`,
            }}>
            {listening ? '⏹ Stop & Submit' : '🎤 Start Speaking'}
          </button>
          {liveText && !listening && (
            <button onClick={() => { setLiveText(''); liveRef.current = ''; }}
              style={{ padding: '0.75rem', background: CARD, border: BORDER, borderRadius: 10, color: MUTED, cursor: 'pointer', fontSize: '0.8rem' }}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── View: Vocabulary Bank ─────────────────────────────────────────────────

function VocabularyView({ domain }: { domain: string }) {
  const words = getVocab(domain);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filtered = words.filter(w =>
    w.word.toLowerCase().includes(search.toLowerCase()) ||
    w.meaning.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vocabulary…"
          style={{ flex: 1, background: CARD2, border: BORDER, borderRadius: 10, padding: '0.55rem 1rem', color: TEXT, fontSize: '0.85rem', outline: 'none' }} />
        <div style={{ color: MUTED, fontSize: '0.75rem', flexShrink: 0 }}>{filtered.length} terms</div>
      </div>

      {filtered.map(v => {
        const open = expanded === v.word;
        return (
          <div key={v.word} style={{ background: CARD, border: open ? `1px solid ${CYAN}40` : BORDER, borderRadius: 14, overflow: 'hidden', transition: 'border-color 0.2s' }}>
            <button onClick={() => setExpanded(open ? null : v.word)}
              style={{ width: '100%', padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: CYAN, fontWeight: 700, fontSize: '0.92rem' }}>{v.word}</div>
                {!open && <div style={{ color: MUTED, fontSize: '0.76rem', marginTop: 2 }}>{v.meaning.substring(0, 60)}…</div>}
              </div>
              <span style={{ color: MUTED, fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
            </button>
            {open && (
              <div style={{ padding: '0 1.25rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ color: TEXT, fontSize: '0.85rem', lineHeight: 1.6 }}>{v.meaning}</div>
                <div style={{ background: CARD2, borderRadius: 10, padding: '0.75rem', border: `1px solid ${INDIGO}30` }}>
                  <div style={{ color: INDIGO, fontSize: '0.68rem', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Example</div>
                  <div style={{ color: TEXT, fontSize: '0.82rem', fontStyle: 'italic' }}>"{v.example}"</div>
                </div>
                <div style={{ background: `${AMBER}10`, border: `1px solid ${AMBER}30`, borderRadius: 10, padding: '0.75rem' }}>
                  <div style={{ color: AMBER, fontSize: '0.68rem', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>💡 Interview Tip</div>
                  <div style={{ color: TEXT, fontSize: '0.8rem' }}>{v.tip}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── View: Scenario Lab ────────────────────────────────────────────────────

function ScenariosView({ career, domain }: { career: string; domain: string }) {
  const cfg = getDomainConfig(domain);
  const [active, setActive]     = useState<string | null>(null);
  const [simHist, setSimHist]   = useState<Msg[]>([]);
  const [simInput, setSimInput] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simDone, setSimDone]   = useState(false);
  const [simScore, setSimScore] = useState(0);
  const [simTips, setSimTips]   = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [simHist]);

  async function startScenario(scenarioId: string) {
    setActive(scenarioId); setSimHist([]); setSimDone(false); setSimLoading(true);
    try {
      const r = await api.post('/career/interview/scenario', {
        career, domain, scenario_type: scenarioId, history: [], mode: 'start',
      });
      setSimHist([{ role: 'assistant', content: r.data.message }]);
    } catch { setSimHist([{ role: 'assistant', content: 'Scenario failed to load. Please try again.' }]); }
    finally { setSimLoading(false); }
  }

  async function sendSimMessage() {
    if (!simInput.trim() || simLoading || !active) return;
    const newH: Msg[] = [...simHist, { role: 'user', content: simInput }];
    setSimHist(newH); setSimInput(''); setSimLoading(true);
    const userCount = newH.filter(m => m.role === 'user').length;
    const mode = userCount >= 4 ? 'evaluate' : 'continue';
    try {
      const r = await api.post('/career/interview/scenario', {
        career, domain, scenario_type: active, history: newH, mode,
      });
      setSimHist([...newH, { role: 'assistant', content: r.data.message }]);
      if (r.data.is_complete) {
        setSimDone(true); setSimScore(r.data.score || 70); setSimTips(r.data.tips || []);
      }
    } catch { setSimHist(h => [...h, { role: 'assistant', content: 'Error — please try again.' }]); }
    finally { setSimLoading(false); }
  }

  if (!active) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ color: TEXT, fontWeight: 700, marginBottom: '0.25rem' }}>
        {cfg.icon} {cfg.label} — Scenario Simulations
      </div>
      <div style={{ color: MUTED, fontSize: '0.82rem', marginBottom: '0.5rem' }}>
        Practice realistic, high-stakes scenarios specific to your career domain.
      </div>
      {cfg.scenarios.map(s => (
        <button key={s.id} onClick={() => startScenario(s.id)}
          style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.25rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.18s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = `${PURPLE}50`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.09)'; }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>{s.icon}</span>
            <div>
              <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.92rem' }}>{s.label}</div>
              <div style={{ color: MUTED, fontSize: '0.78rem', marginTop: 2 }}>{s.desc}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: MUTED, fontSize: '0.8rem' }}>Start ›</span>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', height: '65vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: CYAN, fontWeight: 700, fontSize: '0.88rem' }}>{active}</span>
        <button onClick={() => setActive(null)} style={{ padding: '0.3rem 0.8rem', background: CARD, border: BORDER, borderRadius: 8, color: MUTED, cursor: 'pointer', fontSize: '0.72rem' }}>
          ← Scenarios
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
        {simHist.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '85%', padding: '0.75rem 1rem', borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: m.role === 'user' ? `linear-gradient(135deg,${PURPLE},${INDIGO})` : CARD2, border: m.role === 'user' ? 'none' : BORDER, color: TEXT, fontSize: '0.86rem', lineHeight: 1.65 }}>
              {m.role === 'assistant' && <div style={{ color: PURPLE, fontSize: '0.65rem', fontWeight: 700, marginBottom: 5, textTransform: 'uppercase' }}>🎭 Scenario</div>}
              {m.content}
            </div>
          </div>
        ))}
        {simLoading && <div style={{ color: MUTED, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: PURPLE, animation: 'pulse 1s infinite' }} /> Responding…</div>}
        <div ref={bottomRef} />
      </div>

      {simDone ? (
        <div style={{ background: CARD2, border: `1px solid ${GREEN}30`, borderRadius: 14, padding: '1rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.65rem' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: simScore >= 70 ? GREEN : AMBER }}>{simScore}</div>
            <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.88rem' }}>Scenario Complete</div>
          </div>
          {simTips.map((t, i) => <div key={i} style={{ color: MUTED, fontSize: '0.78rem', marginBottom: 3 }}>💡 {t}</div>)}
          <button onClick={() => setActive(null)} style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: CARD, border: BORDER, borderRadius: 8, color: MUTED, cursor: 'pointer', fontSize: '0.78rem' }}>
            Try Another Scenario
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <input value={simInput} onChange={e => setSimInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendSimMessage()}
            placeholder="Respond to the scenario…"
            style={{ flex: 1, background: CARD2, border: BORDER, borderRadius: 10, padding: '0.65rem 1rem', color: TEXT, fontSize: '0.86rem', outline: 'none' }} />
          <button onClick={sendSimMessage} disabled={simLoading || !simInput.trim()} style={{ padding: '0.65rem 1.25rem', background: simLoading || !simInput.trim() ? DIM : PURPLE, border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Send</button>
        </div>
      )}
    </div>
  );
}

// ── View: Session History ─────────────────────────────────────────────────

function HistoryView({ sessions }: { sessions: SessionRecord[] }) {
  if (!sessions.length) return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: MUTED }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
      <div style={{ fontWeight: 700, color: TEXT, marginBottom: 4 }}>No sessions yet</div>
      <div style={{ fontSize: '0.82rem' }}>Complete a mock interview to see your history here.</div>
    </div>
  );

  const sorted = [...sessions].reverse();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {sorted.map(s => {
        const avgScore = Math.round(Object.values(s.scores).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(s.scores).length));
        const c = avgScore >= 75 ? GREEN : avgScore >= 55 ? AMBER : RED;
        return (
          <div key={s.id} style={{ background: CARD, border: BORDER, borderRadius: 14, padding: '1.1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <div>
                <div style={{ color: TEXT, fontWeight: 700, fontSize: '0.88rem' }}>{s.career}</div>
                <div style={{ color: MUTED, fontSize: '0.72rem' }}>{s.category} · {new Date(s.date).toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: c, fontWeight: 900, fontSize: '1.4rem' }}>{avgScore}</div>
                <div style={{ color: iqColor(s.iq), fontSize: '0.68rem', fontWeight: 700 }}>IQ {s.iq}</div>
              </div>
            </div>
            <Bar2 value={avgScore} color={c} h={4} />
            {s.feedback && <div style={{ color: MUTED, fontSize: '0.75rem', marginTop: '0.5rem', lineHeight: 1.5 }}>{s.feedback.substring(0, 120)}…</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── View: Analytics ───────────────────────────────────────────────────────

function AnalyticsView({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length < 2) return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: MUTED }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📈</div>
      <div style={{ fontWeight: 700, color: TEXT, marginBottom: 4 }}>Need more sessions</div>
      <div style={{ fontSize: '0.82rem' }}>Complete at least 2 interviews to see your growth analytics.</div>
    </div>
  );

  const chartData = sessions.slice(-10).map((s, i) => ({
    name: `#${i + 1}`,
    score: Math.round(Object.values(s.scores).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(s.scores).length)),
    iq: s.iq,
  }));

  // Weakness frequency
  const allDims: Record<string, number[]> = {};
  sessions.forEach(s => {
    Object.entries(s.scores).forEach(([k, v]) => {
      if (!allDims[k]) allDims[k] = [];
      allDims[k].push(v);
    });
  });
  const dimAvgs = Object.entries(allDims).map(([k, vals]) => ({
    name: k,
    avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
  })).sort((a, b) => a.avg - b.avg);

  const totalIQ = calcSessionIQ(sessions);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <IQBadge score={totalIQ} />
          <div>
            <div style={{ color: TEXT, fontWeight: 700 }}>Overall Interview IQ</div>
            <div style={{ color: MUTED, fontSize: '0.78rem' }}>Based on last {Math.min(sessions.length, 5)} sessions</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem' }}>
          {[{ label: 'Sessions', value: sessions.length, color: CYAN }, { label: 'Avg Score', value: Math.round(chartData.reduce((s, d) => s + d.score, 0) / chartData.length), color: GREEN }, { label: 'Improvement', value: `+${Math.max(0, chartData[chartData.length - 1].score - chartData[0].score)}`, color: AMBER }].map(m => (
            <div key={m.label} style={{ background: CARD2, borderRadius: 12, padding: '0.85rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: MUTED, marginBottom: 4, textTransform: 'uppercase' }}>{m.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Score trend */}
      <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.5rem' }}>
        <div style={{ color: TEXT, fontWeight: 700, marginBottom: '1rem' }}>Score Trend</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={{ fill: DIM, fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: DIM, fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: TEXT, fontSize: 12 }} />
            <Line type="monotone" dataKey="score" stroke={CYAN} strokeWidth={2} dot={{ fill: CYAN, r: 3 }} />
            <Line type="monotone" dataKey="iq" stroke={PURPLE} strokeWidth={2} dot={{ fill: PURPLE, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Skill radar / weaknesses */}
      {dimAvgs.length > 0 && (
        <div style={{ background: CARD, border: BORDER, borderRadius: 16, padding: '1.5rem' }}>
          <div style={{ color: TEXT, fontWeight: 700, marginBottom: '1rem' }}>Domain Skill Breakdown</div>
          {dimAvgs.map(d => {
            const c = d.avg >= 75 ? GREEN : d.avg >= 55 ? AMBER : RED;
            return (
              <div key={d.name} style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: MUTED, fontSize: '0.78rem' }}>{d.name}</span>
                  <span style={{ color: c, fontWeight: 700, fontSize: '0.78rem' }}>{d.avg}</span>
                </div>
                <Bar2 value={d.avg} color={c} h={6} />
              </div>
            );
          })}
          {dimAvgs.filter(d => d.avg < 60).length > 0 && (
            <div style={{ marginTop: '1rem', background: `${RED}10`, border: `1px solid ${RED}25`, borderRadius: 10, padding: '0.85rem' }}>
              <div style={{ color: RED, fontWeight: 700, fontSize: '0.78rem', marginBottom: 6 }}>🔍 Focus Areas</div>
              {dimAvgs.filter(d => d.avg < 60).map(d => (
                <div key={d.name} style={{ color: MUTED, fontSize: '0.76rem', marginBottom: 3 }}>• {d.name} ({d.avg}/100) — needs consistent practice</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────

type View = 'hub' | 'mock' | 'vocab' | 'scenarios' | 'history' | 'analytics';

export default function InterviewEngine() {
  const [career, setCareer]     = useState('');
  const [domain, setDomain]     = useState('general');
  const [view, setView]         = useState<View>('hub');
  const [sessions, setSessions] = useState<SessionRecord[]>(loadSessions);
  const [loadingCareer, setLoadingCareer] = useState(true);

  // Load career from Digital Twin
  useEffect(() => {
    api.get('/career/interview/config')
      .then(r => { setCareer(r.data.career || ''); setDomain(r.data.domain || 'general'); })
      .catch(() => {})
      .finally(() => setLoadingCareer(false));
  }, []);

  const cfg = getDomainConfig(domain);

  const navItems: { id: View; label: string; icon: string }[] = [
    { id: 'hub',       label: 'Hub',       icon: '🏠' },
    { id: 'mock',      label: 'Interview', icon: '🎤' },
    { id: 'vocab',     label: 'Vocabulary', icon: '📖' },
    { id: 'scenarios', label: 'Scenarios', icon: '🎭' },
    { id: 'history',   label: 'History',   icon: '🗓️' },
    { id: 'analytics', label: 'Analytics', icon: '📊' },
  ];

  if (loadingCareer) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: MUTED, gap: '0.75rem' }}>
      <div style={{ width: 20, height: 20, border: `2px solid ${INDIGO}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      Personalising your interview system…
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>

      {/* Career selector + Domain badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.9rem', background: `${CYAN}15`, border: `1px solid ${CYAN}40`, borderRadius: 99 }}>
          <span style={{ fontSize: '0.85rem' }}>{cfg.icon}</span>
          <span style={{ color: CYAN, fontSize: '0.78rem', fontWeight: 700 }}>{cfg.label}</span>
        </div>
        {career && (
          <div style={{ color: TEXT, fontSize: '0.82rem', fontWeight: 600 }}>
            🎯 <span style={{ color: MUTED }}>Role:</span> {career}
          </div>
        )}
      </div>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => setView(n.id)} style={{
            display: 'flex', alignItems: 'center', gap: '0.35rem',
            padding: '0.5rem 0.9rem', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: view === n.id ? `${INDIGO}30` : 'transparent',
            color: view === n.id ? CYAN : MUTED,
            fontWeight: view === n.id ? 700 : 400,
            fontSize: '0.78rem', whiteSpace: 'nowrap',
            borderBottom: view === n.id ? `2px solid ${CYAN}` : '2px solid transparent',
            transition: 'all 0.15s',
          }}>
            <span>{n.icon}</span><span>{n.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {view === 'hub'       && <HubView career={career} domain={domain} sessions={sessions} onStartMock={() => setView('mock')} onChangeView={v => setView(v as View)} />}
      {view === 'mock'      && <MockInterviewView career={career} domain={domain} onComplete={s => { setSessions(prev => [...prev, s]); }} />}
      {view === 'vocab'     && <VocabularyView domain={domain} />}
      {view === 'scenarios' && <ScenariosView career={career} domain={domain} />}
      {view === 'history'   && <HistoryView sessions={sessions} />}
      {view === 'analytics' && <AnalyticsView sessions={sessions} />}
    </div>
  );
}
