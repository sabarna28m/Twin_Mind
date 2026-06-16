import io
import json
import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy.orm import Session as DBSession
from groq import Groq

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.learning_data import LearningData
from app.models.subject_performance import SubjectRecord
from app.models.quiz import QuizSession
from app.models.student_profile import StudentProfile
from app.models.career_twin import CareerTwin
from app.api.routes.auth import get_current_user
from app.api.schemas.career import (
    CareerReadinessResponse,
    ResumeAnalyzeRequest, ResumeAnalyzeResponse, ResumeSection, BulletImprovement,
    LinkedInAnalyzeRequest, LinkedInAnalyzeResponse,
    AchievementItem, AchievementAnalyzeResponse,
    LinkedInImprovementItem, LinkedInChecklistItem, LinkedInTwinPrediction,
    LinkedInSectionScore, LinkedInTwinFullResponse, ManualAchievementRequest,
    InterviewChatRequest, InterviewChatResponse,
    SkillGapResponse, LearningStep,
    CareerRecommendationsResponse, CareerRecommendation,
    JobMatchResponse, JobMatchEntry,
    RoadmapResponse, RoadmapStep,
    CodingChallengeRequest, CodingChallengeResponse, CodingExample,
    CodingEvalRequest, CodingEvalResponse,
    CareerTwinResponse, CareerTwinPrediction,
    AnalyticsResponse,
)

router = APIRouter(prefix="/career", tags=["career"])
GROQ_MODEL = "llama-3.3-70b-versatile"
_client: Optional[Groq] = None

MAX_UPLOAD_MB = 5


# ── AI client ──────────────────────────────────────────────────────────────

def _get_client() -> Groq:
    global _client
    if _client is None:
        if not settings.groq_api_key:
            raise HTTPException(status_code=503, detail="AI service not configured.")
        _client = Groq(api_key=settings.groq_api_key)
    return _client


def _safe_avg(vals: List[float]) -> float:
    return sum(vals) / len(vals) if vals else 0.0


def _groq_json(prompt: str, max_tokens: int = 1200) -> Optional[dict | list]:
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=max_tokens,
        )
        text = resp.choices[0].message.content.strip()
        for start_ch, end_ch in [("{", "}"), ("[", "]")]:
            s = text.find(start_ch)
            e = text.rfind(end_ch) + 1
            if s >= 0 and e > 0:
                return json.loads(text[s:e])
    except Exception:
        pass
    return None


# ── File text extractors ───────────────────────────────────────────────────

def _extract_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        parts = []
        for page in reader.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
        return "\n".join(parts)
    except Exception as ex:
        raise HTTPException(status_code=422, detail=f"PDF extraction failed: {ex}")


def _extract_docx(content: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as ex:
        raise HTTPException(status_code=422, detail=f"DOCX extraction failed: {ex}")


# ── Career Twin DB helpers ─────────────────────────────────────────────────

def _get_or_create_twin(user_id: int, db: DBSession) -> CareerTwin:
    twin = db.query(CareerTwin).filter_by(user_id=user_id).first()
    if not twin:
        twin = CareerTwin(user_id=user_id)
        db.add(twin)
        db.commit()
        db.refresh(twin)
    return twin


def _update_twin(
    user_id: int,
    db: DBSession,
    *,
    resume_score: Optional[float] = None,
    linkedin_score: Optional[float] = None,
    interview_score: Optional[float] = None,
    coding_score: Optional[float] = None,
    skills: Optional[List[str]] = None,
    certifications: Optional[List[str]] = None,
    resume_text: Optional[str] = None,
    event: str = "update",
) -> CareerTwin:
    twin = _get_or_create_twin(user_id, db)

    if resume_score is not None:
        twin.resume_score = resume_score
    if linkedin_score is not None:
        twin.linkedin_score = linkedin_score
    if interview_score is not None:
        twin.interview_score = interview_score
    if coding_score is not None:
        twin.coding_score = coding_score
    if skills is not None:
        existing = set(json.loads(twin.skills_json or "[]"))
        existing.update(skills)
        twin.skills_json = json.dumps(sorted(existing))
    if certifications is not None:
        existing = set(json.loads(twin.certifications_json or "[]"))
        existing.update(certifications)
        twin.certifications_json = json.dumps(sorted(existing))
    if resume_text is not None:
        twin.last_resume_text = resume_text

    # Recompute employability
    scores = [s for s in [twin.resume_score, twin.linkedin_score, twin.interview_score, twin.coding_score] if s > 0]
    if scores:
        weights = [0.30, 0.20, 0.25, 0.25]
        all_scores = [twin.resume_score, twin.linkedin_score, twin.interview_score, twin.coding_score]
        twin.employability_score = round(
            all_scores[0] * 0.30 + all_scores[1] * 0.20 + all_scores[2] * 0.25 + all_scores[3] * 0.25, 1
        )

    # Append to history
    history = json.loads(twin.score_history_json or "[]")
    history.append({
        "date": date.today().isoformat(),
        "event": event,
        "resume": round(twin.resume_score, 1),
        "linkedin": round(twin.linkedin_score, 1),
        "interview": round(twin.interview_score, 1),
        "coding": round(twin.coding_score, 1),
        "employability": round(twin.employability_score, 1),
    })
    twin.score_history_json = json.dumps(history[-60:])  # keep last 60 snapshots

    db.commit()
    db.refresh(twin)
    return twin


# ── Domain detection: degree/course → domain ──────────────────────────────

DEGREE_DOMAIN_MAP: list[tuple[str, str]] = [
    # Medical & Healthcare (check most specific first)
    ("bsc nursing", "nursing"), ("b.sc nursing", "nursing"), ("gnm", "nursing"),
    ("m.sc nursing", "nursing"), ("msc nursing", "nursing"),
    ("b.pharm", "pharmacy"), ("m.pharm", "pharmacy"), ("pharm", "pharmacy"),
    ("bds", "dental"), ("mds", "dental"),
    ("bams", "medical"), ("bhms", "medical"), ("bpt", "medical"),
    ("mbbs", "medical"), (" md ", "medical"), (" ms ", "medical"), ("dnb", "medical"),
    ("public health", "public_health"),
    # Law
    ("llb", "law"), ("llm", "law"), ("integrated law", "law"),
    ("corporate law", "law"), ("criminal law", "law"), ("intellectual property law", "law"),
    # Commerce & Finance
    ("chartered accountancy", "finance"), ("company secretary", "finance"),
    (" ca ", "finance"), ("cma", "finance"), ("banking", "finance"),
    ("financial analysis", "finance"),
    ("b.com", "commerce"), ("bcom", "commerce"), ("m.com", "commerce"), ("mcom", "commerce"),
    # Management
    ("executive mba", "management"), ("pgdm", "management"),
    ("mba", "management"), ("bba", "management"),
    ("marketing", "management"), ("human resources", "management"),
    ("operations management", "management"), ("entrepreneurship", "management"),
    # Engineering & IT (most specific first)
    ("data science", "data_science"), ("artificial intelligence", "ai"),
    ("cyber security", "cybersecurity"), ("cybersecurity", "cybersecurity"),
    ("b.sc computer science", "it"), ("bsc computer science", "it"),
    ("m.sc computer science", "it"), ("information technology", "it"),
    ("bca", "it"), ("mca", "it"), ("software engineering", "it"),
    ("b.tech", "engineering"), ("btech", "engineering"),
    ("m.tech", "engineering"), ("mtech", "engineering"),
    ("b.e.", "engineering"), (" be ", "engineering"),
    ("diploma engineering", "engineering"), ("polytechnic", "engineering"),
    # Science
    ("biotechnology", "biotech"), ("microbiology", "science"),
    ("environmental science", "science"), ("statistics", "statistics"),
    ("mathematics", "science"), ("chemistry", "science"), ("physics", "science"),
    ("b.sc", "science"), ("bsc", "science"), ("m.sc", "science"), ("msc", "science"),
    # Arts & Humanities
    ("psychology", "psychology"),
    ("political science", "arts"), ("sociology", "arts"),
    ("philosophy", "arts"), ("literature", "arts"), ("history", "arts"),
    (" ba ", "arts"), (" ma ", "arts"),
    # Education
    ("b.ed", "education"), ("bed", "education"), ("m.ed", "education"),
    ("med", "education"), ("teaching", "education"),
    # Architecture & Design
    ("b.arch", "architecture"), ("barch", "architecture"),
    ("m.arch", "architecture"),
    ("interior design", "design"), ("graphic design", "design"),
    ("ui/ux", "design"), ("fashion design", "design"), ("product design", "design"),
    # Agriculture
    ("veterinary", "veterinary"),
    ("horticulture", "agriculture"), ("forestry", "agriculture"),
    ("agriculture", "agriculture"),
    # Media & Communication
    ("journalism", "media"), ("mass communication", "media"),
    ("public relations", "media"), ("digital media", "media"), ("film", "media"),
    # Hospitality
    ("hotel management", "hospitality"), ("tourism", "hospitality"),
    ("event management", "hospitality"),
    # Vocational
    ("iti", "vocational"), ("electrician", "vocational"),
    ("mechanic", "vocational"), ("welding", "vocational"), ("carpentry", "vocational"),
    # Research
    ("phd", "research"), ("m.phil", "research"), ("research scholar", "research"),
]

# ── Domain → relevant careers ─────────────────────────────────────────────

DOMAIN_CAREERS: dict[str, list[str]] = {
    "medical": [
        "General Physician", "Surgeon", "Medical Researcher",
        "Cardiologist", "Neurologist", "Pediatrician", "Dermatologist",
        "Radiologist", "Public Health Specialist", "Hospital Administrator",
        "Medical Educator", "Anesthesiologist",
    ],
    "dental": [
        "Dentist (General Practice)", "Oral Surgeon", "Orthodontist",
        "Periodontist", "Dental Educator", "Public Dental Health Officer",
    ],
    "nursing": [
        "Staff Nurse", "ICU / Critical Care Nurse", "Community Health Nurse",
        "Nurse Educator", "Clinical Nurse Specialist", "Nurse Practitioner",
    ],
    "pharmacy": [
        "Pharmacist", "Clinical Pharmacist", "Drug Safety Associate",
        "Medical Writer", "Pharmaceutical Researcher", "Regulatory Affairs Specialist",
    ],
    "public_health": [
        "Public Health Specialist", "Epidemiologist", "Health Policy Analyst",
        "Community Health Officer", "Medical Researcher", "Health Educator",
    ],
    "law": [
        "Advocate / Lawyer", "Corporate Lawyer", "Legal Consultant",
        "Compliance Officer", "Legal Researcher", "Public Prosecutor",
        "Intellectual Property Attorney", "Criminal Defense Attorney",
    ],
    "commerce": [
        "Chartered Accountant (CA)", "Auditor", "Tax Consultant",
        "Financial Analyst", "Banking Officer", "Stock Analyst",
        "Cost Accountant", "Commerce Educator",
    ],
    "finance": [
        "Chartered Accountant (CA)", "Investment Banker", "Financial Analyst",
        "Auditor", "Tax Consultant", "Portfolio Manager", "Actuary",
        "Risk Analyst", "Wealth Manager",
    ],
    "management": [
        "Business Analyst", "Product Manager", "Marketing Manager",
        "Human Resources Manager", "Operations Manager", "Entrepreneur",
        "Strategy Consultant", "Supply Chain Manager", "Brand Manager",
    ],
    "engineering": [
        "Software Engineer", "AI / ML Engineer", "Data Scientist",
        "Cloud Architect", "DevOps Engineer", "Cybersecurity Analyst",
        "Embedded Systems Engineer", "Research Engineer", "Data Analyst",
    ],
    "it": [
        "Software Engineer", "Full Stack Developer", "Data Analyst",
        "IT Consultant", "Web Developer", "Database Administrator",
        "AI / ML Engineer", "Systems Analyst",
    ],
    "data_science": [
        "Data Scientist", "ML Engineer", "AI Researcher",
        "Data Analyst", "Business Intelligence Analyst", "Data Engineer",
        "AI / ML Engineer",
    ],
    "ai": [
        "AI / ML Engineer", "NLP Engineer", "Computer Vision Engineer",
        "AI Researcher", "Data Scientist", "ML Engineer",
    ],
    "cybersecurity": [
        "Cybersecurity Analyst", "Ethical Hacker / Penetration Tester",
        "Security Operations Engineer", "Cloud Security Architect",
        "Digital Forensics Analyst", "IT Security Consultant",
    ],
    "science": [
        "Research Scientist", "Laboratory Technician", "Biotechnologist",
        "Environmental Scientist", "Science Educator", "Forensic Scientist",
        "Biostatistician", "Geologist",
    ],
    "biotech": [
        "Biotechnologist", "Molecular Biologist", "Genetic Researcher",
        "Pharmaceutical Researcher", "Clinical Research Associate",
        "Bioinformatics Analyst", "Biostatistician",
    ],
    "statistics": [
        "Statistician", "Data Scientist", "Actuary", "Biostatistician",
        "Market Research Analyst", "Data Analyst", "Quality Control Analyst",
    ],
    "arts": [
        "Content Writer", "Journalist", "Civil Services Officer (IAS/IPS)",
        "Social Worker", "Diplomat / Foreign Service",
        "Political Analyst", "Teacher / Lecturer", "NGO Program Manager",
    ],
    "psychology": [
        "Clinical Psychologist", "Counseling Psychologist", "Educational Psychologist",
        "Organizational Psychologist", "School Counselor",
        "Mental Health Researcher", "HR Specialist",
    ],
    "education": [
        "School Teacher", "University Professor / Lecturer",
        "Curriculum Developer", "Education Consultant",
        "Educational Psychologist", "E-Learning Designer",
    ],
    "architecture": [
        "Architect", "Urban Planner", "Landscape Architect",
        "Interior Designer", "Construction Manager", "BIM Specialist",
    ],
    "design": [
        "Graphic Designer", "UI/UX Designer", "Product Designer",
        "Brand Identity Designer", "Motion Graphics Artist",
        "Fashion Designer", "Industrial Designer",
    ],
    "agriculture": [
        "Agricultural Scientist", "Horticulturist", "Agricultural Extension Officer",
        "Farm Manager", "Agri-Business Manager", "Food Technologist",
    ],
    "veterinary": [
        "Veterinarian (Small Animal)", "Veterinarian (Large Animal)",
        "Wildlife Veterinarian", "Veterinary Researcher", "Animal Health Inspector",
    ],
    "media": [
        "Journalist", "Content Creator / Influencer", "Film Director",
        "Public Relations Specialist", "Social Media Manager",
        "Documentary Filmmaker", "Media Analyst",
    ],
    "hospitality": [
        "Hotel Manager", "Tourism Manager", "Event Manager",
        "F&B Manager", "Travel Consultant", "Hospitality Educator",
    ],
    "vocational": [
        "Electrical Technician", "Automotive Mechanic", "Welding Technician",
        "Civil Technician", "Carpenter / Woodworker", "HVAC Technician",
        "Field Service Engineer",
    ],
    "research": [
        "Research Scientist", "University Professor / Lecturer",
        "Research Analyst", "Policy Researcher", "Academic Writer",
        "R&D Specialist", "Think Tank Analyst",
    ],
}

# ── Comprehensive multi-domain career keyword / role maps ─────────────────

CAREER_SKILLS: dict[str, list[str]] = {
    # ── Medical ──
    "General Physician":         ["mbbs", "medicine", "clinical", "diagnosis", "patient care", "anatomy", "physiology", "treatment", "general practice", "pharmacology"],
    "Surgeon":                   ["mbbs", "surgery", "anatomy", "operative", "clinical", "medical", "ms", "dnb", "surgical", "theatre"],
    "Medical Researcher":        ["mbbs", "research", "clinical trials", "pathology", "pharmacology", "medical", "statistics", "laboratory", "md", "publication"],
    "Cardiologist":              ["mbbs", "cardiology", "heart", "anatomy", "physiology", "clinical", "ecg", "cardio", "cardiac"],
    "Neurologist":               ["mbbs", "neurology", "brain", "anatomy", "clinical", "nervous system", "neuro"],
    "Pediatrician":              ["mbbs", "pediatrics", "child health", "clinical", "medicine", "pediatric", "neonatology"],
    "Dermatologist":             ["mbbs", "dermatology", "skin", "clinical", "medicine", "cosmetic"],
    "Radiologist":               ["mbbs", "radiology", "imaging", "x-ray", "mri", "ct scan", "clinical", "ultrasound"],
    "Public Health Specialist":  ["public health", "epidemiology", "mbbs", "community health", "medicine", "health policy", "preventive", "biostatistics"],
    "Hospital Administrator":    ["healthcare management", "hospital", "administration", "health management", "mbbs", "healthcare", "operations"],
    "Medical Educator":          ["mbbs", "teaching", "medical education", "anatomy", "clinical", "education", "curriculum"],
    "Anesthesiologist":          ["mbbs", "anesthesia", "surgery", "clinical", "critical care", "md", "pharmacology"],
    # ── Dental ──
    "Dentist (General Practice)": ["bds", "dentistry", "oral health", "dental", "teeth", "clinical", "prosthodontics"],
    "Oral Surgeon":              ["bds", "oral surgery", "dental", "surgery", "mds", "jaw", "implant"],
    "Orthodontist":              ["bds", "orthodontics", "braces", "dental", "oral health", "alignment"],
    # ── Nursing ──
    "Staff Nurse":               ["nursing", "patient care", "bsc nursing", "gnm", "clinical care", "medication", "ward", "vitals"],
    "ICU / Critical Care Nurse": ["icu", "critical care", "nursing", "bsc nursing", "gnm", "patient monitoring", "ventilator", "hemodynamics"],
    "Community Health Nurse":    ["community health", "nursing", "public health", "gnm", "bsc nursing", "primary care", "immunization"],
    "Nurse Educator":            ["nursing", "education", "teaching", "bsc nursing", "gnm", "clinical training", "curriculum"],
    "Clinical Nurse Specialist": ["nursing", "clinical", "specialist", "bsc nursing", "m.sc nursing", "advanced practice", "protocol"],
    # ── Pharmacy ──
    "Pharmacist":                ["pharmacy", "drugs", "medications", "b.pharm", "pharmacology", "dispensing", "drug store", "m.pharm"],
    "Clinical Pharmacist":       ["clinical pharmacy", "b.pharm", "m.pharm", "pharmacology", "drug therapy", "clinical", "rounds"],
    "Drug Safety Associate":     ["pharmacovigilance", "b.pharm", "m.pharm", "drug safety", "pharmaceutical", "adverse events", "reporting"],
    "Medical Writer":            ["medical writing", "pharmacy", "m.pharm", "clinical", "pharmacology", "documentation", "regulatory"],
    "Pharmaceutical Researcher": ["pharmaceutical research", "pharmacology", "b.pharm", "m.pharm", "drug development", "clinical trials", "synthesis"],
    "Regulatory Affairs Specialist": ["regulatory", "b.pharm", "m.pharm", "pharmaceutical", "compliance", "drug approval", "cdsco", "fda"],
    # ── Law ──
    "Advocate / Lawyer":         ["law", "legal", "llb", "litigation", "court", "legal reasoning", "advocacy", "pleading"],
    "Corporate Lawyer":          ["corporate law", "llb", "contracts", "mergers", "acquisitions", "business law", "llm", "company law"],
    "Legal Consultant":          ["llb", "legal", "consulting", "legal advice", "compliance", "advisory", "contract review"],
    "Compliance Officer":        ["compliance", "llb", "regulatory", "legal", "corporate governance", "risk", "audit"],
    "Legal Researcher":          ["legal research", "llb", "llm", "law", "jurisprudence", "academic", "case analysis"],
    "Public Prosecutor":         ["criminal law", "llb", "prosecution", "court", "criminal procedure", "litigation", "fir"],
    "Intellectual Property Attorney": ["intellectual property", "llb", "patents", "trademarks", "ip law", "copyright", "llm"],
    "Criminal Defense Attorney": ["criminal law", "llb", "defense", "court", "litigation", "criminal procedure", "bail"],
    # ── Commerce & Finance ──
    "Chartered Accountant (CA)": ["ca", "accounting", "finance", "taxation", "auditing", "financial statements", "b.com", "gst", "icai"],
    "Auditor":                   ["auditing", "accounting", "finance", "bcom", "ca", "financial statements", "audit", "internal audit"],
    "Tax Consultant":            ["taxation", "tax", "ca", "bcom", "finance", "gst", "income tax", "tds", "tax planning"],
    "Financial Analyst":         ["financial analysis", "bcom", "mba finance", "investment", "markets", "valuation", "cfa", "excel", "modelling"],
    "Investment Banker":         ["investment banking", "finance", "mba", "capital markets", "valuation", "corporate finance", "cfa", "deal"],
    "Actuary":                   ["actuarial", "statistics", "mathematics", "risk", "insurance", "finance", "mortality"],
    "Portfolio Manager":         ["portfolio", "investment", "finance", "cfa", "equity", "mutual funds", "wealth", "asset management"],
    "Banking Officer":           ["banking", "bcom", "finance", "loans", "credit", "bank", "financial services", "retail banking"],
    "Stock Analyst":             ["equity research", "bcom", "mba finance", "stock market", "valuation", "financial modelling", "cfa"],
    "Cost Accountant":           ["cost accounting", "cma", "bcom", "management accounting", "costing", "budgeting"],
    # ── Management ──
    "Business Analyst":          ["business analysis", "bba", "mba", "strategy", "requirements", "process improvement", "data", "stakeholders"],
    "Product Manager":           ["product management", "mba", "strategy", "agile", "market research", "roadmap", "user research"],
    "Marketing Manager":         ["marketing", "mba", "digital marketing", "bba", "brand management", "advertising", "seo", "campaigns"],
    "Human Resources Manager":   ["human resources", "hr", "mba", "recruitment", "talent management", "payroll", "labour law"],
    "Operations Manager":        ["operations", "supply chain", "mba", "bba", "process management", "logistics", "lean", "six sigma"],
    "Entrepreneur":              ["entrepreneurship", "startup", "business", "mba", "innovation", "product", "funding", "bba"],
    "Strategy Consultant":       ["strategy", "consulting", "mba", "business analysis", "market research", "management", "frameworks"],
    "Supply Chain Manager":      ["supply chain", "logistics", "mba", "operations", "procurement", "inventory", "bba"],
    "Brand Manager":             ["brand management", "marketing", "mba", "advertising", "consumer insights", "bba", "campaigns"],
    # ── Engineering & IT ──
    "Software Engineer":         ["computer science", "programming", "software", "algorithms", "btech", "bca", "coding", "development", "oop"],
    "AI / ML Engineer":          ["machine learning", "deep learning", "ai", "neural network", "tensorflow", "pytorch", "python", "btech", "data science"],
    "ML Engineer":               ["machine learning", "mlops", "python", "docker", "cloud", "kubernetes", "model deployment", "feature engineering"],
    "Data Scientist":            ["data science", "statistics", "python", "machine learning", "analytics", "data analysis", "pandas", "numpy", "sql"],
    "Cloud Architect":           ["cloud", "aws", "azure", "btech", "computer science", "infrastructure", "devops", "gcp", "networking"],
    "DevOps Engineer":           ["devops", "docker", "kubernetes", "ci/cd", "btech", "linux", "automation", "terraform", "jenkins"],
    "Cybersecurity Analyst":     ["cybersecurity", "security", "network", "ethical hacking", "btech", "penetration testing", "soc", "siem"],
    "Full Stack Developer":      ["btech", "bca", "web development", "react", "node.js", "database", "api", "programming", "javascript"],
    "Data Analyst":              ["data analysis", "sql", "excel", "visualization", "statistics", "btech", "bca", "bcom", "python", "tableau"],
    "Embedded Systems Engineer": ["embedded", "c programming", "microcontroller", "iot", "btech", "electronics", "firmware", "rtos"],
    "Research Engineer":         ["mathematics", "physics", "research", "machine learning", "algorithms", "optimization", "btech", "mtech"],
    "NLP Engineer":              ["nlp", "natural language processing", "python", "transformers", "bert", "ai", "text analysis", "btech"],
    "Computer Vision Engineer":  ["computer vision", "image processing", "opencv", "deep learning", "python", "btech", "cnn"],
    "Ethical Hacker / Penetration Tester": ["ethical hacking", "penetration testing", "cybersecurity", "btech", "kali linux", "owasp", "ceh"],
    "Digital Forensics Analyst": ["digital forensics", "cybersecurity", "btech", "incident response", "evidence", "malware analysis"],
    # ── Science ──
    "Research Scientist":        ["bsc", "msc", "research", "laboratory", "scientific method", "phd", "experiments", "publications"],
    "Biotechnologist":           ["biotechnology", "bsc", "msc", "molecular biology", "genetics", "laboratory", "biotech", "pcr"],
    "Environmental Scientist":   ["environmental science", "bsc", "ecology", "conservation", "pollution", "sustainability", "gis"],
    "Forensic Scientist":        ["forensic", "bsc", "chemistry", "biology", "criminal investigation", "laboratory", "toxicology"],
    "Biostatistician":           ["statistics", "bsc", "msc", "biostatistics", "clinical trials", "data analysis", "public health", "r"],
    "Molecular Biologist":       ["molecular biology", "bsc", "msc", "genetics", "dna", "pcr", "sequencing", "laboratory"],
    "Bioinformatics Analyst":    ["bioinformatics", "bsc", "msc", "computational biology", "python", "genomics", "data analysis"],
    # ── Psychology ──
    "Clinical Psychologist":     ["psychology", "clinical", "counseling", "therapy", "msc psychology", "ma psychology", "assessment", "diagnosis"],
    "Counseling Psychologist":   ["counseling", "psychology", "mental health", "therapy", "ba psychology", "ma psychology", "listening"],
    "Organizational Psychologist": ["organizational psychology", "hr", "mba", "psychology", "workplace", "industrial psychology"],
    "Educational Psychologist":  ["educational psychology", "bed", "psychology", "learning disabilities", "school", "assessment"],
    # ── Education ──
    "School Teacher":            ["bed", "teaching", "education", "classroom", "curriculum", "pedagogy", "subject expertise", "ctet"],
    "University Professor / Lecturer": ["phd", "research", "teaching", "msc", "academic", "university", "publication", "bed", "med", "net"],
    "Curriculum Developer":      ["curriculum", "bed", "med", "education", "instructional design", "content development", "e-learning"],
    "Education Consultant":      ["education", "bed", "med", "consulting", "school management", "policy", "learning", "leadership"],
    "E-Learning Designer":       ["e-learning", "instructional design", "education", "bed", "lms", "articulate", "moodle", "content"],
    # ── Architecture & Design ──
    "Architect":                 ["architecture", "barch", "design", "construction", "urban planning", "autocad", "revit", "building"],
    "Urban Planner":             ["urban planning", "barch", "city planning", "gis", "infrastructure", "zoning", "development"],
    "Interior Designer":         ["interior design", "barch", "space planning", "furniture", "design", "bdes", "3d visualization"],
    "Graphic Designer":          ["graphic design", "visual design", "adobe", "illustration", "typography", "branding", "bdes", "bfa"],
    "UI/UX Designer":            ["ui/ux", "user experience", "design", "prototyping", "figma", "bdes", "interaction design", "usability"],
    "Fashion Designer":          ["fashion design", "textiles", "bdes", "garment", "styling", "trend", "pattern making", "fashion"],
    "Product Designer":          ["product design", "industrial design", "bdes", "prototyping", "user research", "cad", "materials"],
    # ── Agriculture ──
    "Agricultural Scientist":    ["agriculture", "bsc agriculture", "agronomy", "soil science", "crops", "farming", "horticulture", "icar"],
    "Horticulturist":            ["horticulture", "bsc agriculture", "plants", "cultivation", "nursery", "garden", "floriculture"],
    "Food Technologist":         ["food technology", "agriculture", "bsc agriculture", "food science", "processing", "fssai", "quality"],
    "Agricultural Extension Officer": ["agriculture", "bsc agriculture", "extension", "farming", "rural development", "community"],
    "Veterinarian (Small Animal)": ["veterinary", "bvsc", "animal", "clinical", "medicine", "surgery", "pets"],
    "Veterinarian (Large Animal)": ["veterinary", "bvsc", "animal", "livestock", "cattle", "farm", "surgery"],
    # ── Media & Communication ──
    "Journalist":                ["journalism", "mass communication", "writing", "reporting", "media", "news", "editing", "bjmc"],
    "Content Creator / Influencer": ["content", "digital media", "social media", "journalism", "writing", "video", "youtube", "instagram"],
    "Film Director":             ["film", "media", "direction", "storytelling", "mass communication", "cinema", "screenplay"],
    "Public Relations Specialist": ["public relations", "pr", "journalism", "communication", "media", "corporate communication", "crisis"],
    "Social Media Manager":      ["social media", "digital media", "content", "marketing", "analytics", "instagram", "facebook"],
    # ── Hospitality ──
    "Hotel Manager":             ["hotel management", "hospitality", "tourism", "food and beverage", "front office", "revenue management"],
    "Event Manager":             ["event management", "hospitality", "planning", "coordination", "logistics", "vendor management"],
    "Travel Consultant":         ["tourism", "travel", "hospitality", "geography", "tour planning", "ticketing", "itinerary"],
    "F&B Manager":               ["food and beverage", "hotel management", "hospitality", "culinary", "restaurant", "menu planning"],
    # ── Vocational ──
    "Electrical Technician":     ["iti", "electrical", "electrician", "wiring", "circuits", "electronics", "panel board"],
    "Automotive Mechanic":       ["iti", "mechanic", "automobile", "engines", "repair", "vehicles", "diagnostics"],
    "Welding Technician":        ["iti", "welding", "fabrication", "metal", "manufacturing", "mig", "tig"],
    "Civil Technician":          ["iti", "civil", "construction", "surveying", "autocad", "building", "structural"],
    "HVAC Technician":           ["iti", "hvac", "air conditioning", "refrigeration", "cooling", "installation"],
    # ── Government & Arts ──
    "Civil Services Officer (IAS/IPS)": ["upsc", "civil services", "public administration", "ba", "ma", "government", "policy", "law", "ias"],
    "Political Analyst":         ["political science", "ba", "ma", "policy", "governance", "research", "elections"],
    "Social Worker":             ["social work", "ba", "ma", "community", "sociology", "welfare", "ngo"],
    "NGO Program Manager":       ["social work", "ngo", "development", "community", "ba", "ma", "social science", "fundraising"],
    "Diplomat / Foreign Service": ["foreign service", "ba", "ma", "international relations", "languages", "upsc", "ifs"],
    # ── Research & Academia ──
    "Research Scientist":        ["phd", "mphil", "research", "publication", "academic", "thesis", "university", "grants"],
    "University Professor / Lecturer": ["phd", "net", "jrf", "teaching", "university", "research", "publication", "academic"],
    "R&D Specialist":            ["research", "development", "phd", "innovation", "laboratory", "mtech", "msc", "patents"],
    "Think Tank Analyst":        ["research", "policy", "ba", "ma", "phd", "analysis", "writing", "economics"],
    # ── HR / Psychology cross ──
    "HR Specialist":             ["hr", "mba", "psychology", "recruitment", "training", "employee relations", "bba", "payroll"],
}

CAREER_REQUIRED_SKILLS: dict[str, list[str]] = {
    # Medical
    "General Physician":         ["Clinical Medicine", "Diagnosis & Treatment", "Patient Communication", "Pharmacology", "Medical Records"],
    "Surgeon":                   ["Surgical Techniques", "Anatomy", "Operative Care", "Pre/Post-op Management", "Clinical Decision Making"],
    "Medical Researcher":        ["Research Methodology", "Clinical Trials", "Biostatistics", "Scientific Writing", "Research Ethics"],
    "Cardiologist":              ["Cardiology", "ECG Interpretation", "Cardiac Imaging", "Clinical Medicine", "Patient Management"],
    "Neurologist":               ["Neuroscience", "Clinical Neurology", "Brain Imaging", "Patient Assessment", "Medical Management"],
    "Pediatrician":              ["Pediatrics", "Child Development", "Clinical Medicine", "Vaccination Protocols", "Family Communication"],
    "Dermatologist":             ["Dermatology", "Skin Pathology", "Clinical Assessment", "Procedural Skills", "Patient Education"],
    "Radiologist":               ["Medical Imaging", "Radiology", "Anatomy", "Report Writing", "Clinical Correlation"],
    "Public Health Specialist":  ["Epidemiology", "Health Policy", "Biostatistics", "Community Health", "Research Methods"],
    "Hospital Administrator":    ["Healthcare Management", "Leadership", "Finance", "Operations", "Regulatory Compliance"],
    "Medical Educator":          ["Teaching Skills", "Curriculum Development", "Clinical Expertise", "Assessment Design", "Mentorship"],
    "Anesthesiologist":          ["Anesthesia Techniques", "Critical Care", "Pharmacology", "Patient Monitoring", "Emergency Medicine"],
    # Dental
    "Dentist (General Practice)": ["Clinical Dentistry", "Dental Procedures", "Patient Communication", "Radiology", "Infection Control"],
    "Oral Surgeon":              ["Oral Surgery", "Anesthesia", "Implantology", "Post-op Care", "Clinical Dentistry"],
    "Orthodontist":              ["Orthodontic Techniques", "Treatment Planning", "Clinical Dentistry", "Radiography", "Patient Management"],
    # Nursing
    "Staff Nurse":               ["Patient Care", "Medication Administration", "Vital Signs Monitoring", "Wound Care", "Communication"],
    "ICU / Critical Care Nurse": ["Critical Care", "Ventilator Management", "Hemodynamic Monitoring", "Emergency Procedures", "Patient Assessment"],
    "Community Health Nurse":    ["Community Health", "Health Education", "Primary Care", "Family Planning", "Disease Prevention"],
    "Nurse Educator":            ["Teaching", "Curriculum Design", "Clinical Supervision", "Assessment", "Nursing Practice"],
    "Clinical Nurse Specialist": ["Advanced Clinical Practice", "Research", "Nursing Protocols", "Leadership", "Specialized Care"],
    # Pharmacy
    "Pharmacist":                ["Drug Knowledge", "Dispensing", "Patient Counseling", "Drug Interactions", "Regulatory Compliance"],
    "Clinical Pharmacist":       ["Clinical Pharmacology", "Drug Therapy Management", "Patient Counseling", "Evidence-Based Practice", "Rounds"],
    "Drug Safety Associate":     ["Pharmacovigilance", "Adverse Event Reporting", "Regulatory Requirements", "Medical Writing", "Data Analysis"],
    "Medical Writer":            ["Medical Writing", "Scientific Communication", "Regulatory Documents", "Research Interpretation", "Editing"],
    "Pharmaceutical Researcher": ["Drug Discovery", "Laboratory Skills", "Clinical Trials", "Data Analysis", "Scientific Writing"],
    "Regulatory Affairs Specialist": ["Regulatory Guidelines", "Drug Approval Process", "Documentation", "Quality Assurance", "Compliance"],
    # Law
    "Advocate / Lawyer":         ["Legal Research", "Drafting", "Litigation", "Client Communication", "Court Procedure"],
    "Corporate Lawyer":          ["Corporate Law", "Contract Drafting", "M&A", "Company Law", "Due Diligence"],
    "Legal Consultant":          ["Legal Analysis", "Advisory", "Risk Assessment", "Contract Review", "Regulatory Knowledge"],
    "Compliance Officer":        ["Regulatory Compliance", "Risk Management", "Policy Development", "Auditing", "Reporting"],
    "Legal Researcher":          ["Legal Research", "Case Analysis", "Academic Writing", "Jurisprudence", "Documentation"],
    "Public Prosecutor":         ["Criminal Law", "Litigation", "Evidence Evaluation", "Court Advocacy", "Legal Research"],
    "Intellectual Property Attorney": ["IP Law", "Patent Drafting", "Trademark Registration", "Copyright Law", "IP Strategy"],
    "Criminal Defense Attorney": ["Criminal Law", "Evidence Analysis", "Litigation", "Client Relations", "Trial Advocacy"],
    # Commerce & Finance
    "Chartered Accountant (CA)": ["Financial Accounting", "Taxation", "Auditing", "Corporate Law", "Financial Reporting"],
    "Auditor":                   ["Audit Procedures", "Financial Analysis", "Risk Assessment", "Accounting Standards", "Reporting"],
    "Tax Consultant":            ["Taxation", "GST", "Income Tax", "Tax Planning", "Compliance"],
    "Financial Analyst":         ["Financial Modelling", "Valuation", "Excel", "Investment Analysis", "Reporting"],
    "Investment Banker":         ["Valuation", "Capital Markets", "Financial Modelling", "Deal Structuring", "Relationship Management"],
    "Actuary":                   ["Actuarial Mathematics", "Statistics", "Risk Analysis", "Financial Modelling", "Insurance"],
    "Portfolio Manager":         ["Investment Analysis", "Portfolio Construction", "Risk Management", "Market Analysis", "CFA"],
    "Banking Officer":           ["Banking Products", "Credit Analysis", "Customer Service", "Regulatory Compliance", "Financial Planning"],
    "Stock Analyst":             ["Equity Research", "Financial Modelling", "Valuation", "Report Writing", "Market Analysis"],
    "Cost Accountant":           ["Cost Accounting", "Management Accounting", "Budgeting", "Variance Analysis", "Costing Techniques"],
    # Management
    "Business Analyst":          ["Requirements Analysis", "Process Mapping", "Data Analysis", "Stakeholder Management", "Problem Solving"],
    "Product Manager":           ["Product Strategy", "Roadmapping", "Agile", "User Research", "Data Analysis"],
    "Marketing Manager":         ["Digital Marketing", "Brand Management", "Campaign Planning", "Analytics", "Communication"],
    "Human Resources Manager":   ["Talent Acquisition", "Employee Relations", "Payroll", "Training & Development", "Labour Law"],
    "Operations Manager":        ["Process Optimization", "Supply Chain", "Budgeting", "Team Leadership", "Performance Metrics"],
    "Entrepreneur":              ["Business Planning", "Fundraising", "Team Building", "Market Research", "Financial Management"],
    "Strategy Consultant":       ["Strategic Analysis", "Frameworks", "Client Management", "Research", "Presentation Skills"],
    "Supply Chain Manager":      ["Supply Chain Planning", "Logistics", "Procurement", "Inventory Management", "ERP Systems"],
    "Brand Manager":             ["Brand Strategy", "Market Research", "Campaign Management", "Consumer Insights", "Analytics"],
    # Engineering & IT
    "Software Engineer":         ["Programming", "Data Structures & Algorithms", "System Design", "Version Control", "Testing"],
    "AI / ML Engineer":          ["Python", "Machine Learning", "Deep Learning", "MLOps", "Mathematics", "Model Deployment"],
    "ML Engineer":               ["Python", "Machine Learning", "MLOps", "Docker", "Cloud Platform", "CI/CD"],
    "Data Scientist":            ["Python/R", "Statistics", "Machine Learning", "SQL", "Data Visualization", "Feature Engineering"],
    "Cloud Architect":           ["Cloud Platforms (AWS/Azure/GCP)", "System Design", "Networking", "Security", "Infrastructure"],
    "DevOps Engineer":           ["Linux", "Docker", "Kubernetes", "CI/CD", "Cloud", "Monitoring"],
    "Cybersecurity Analyst":     ["Network Security", "Penetration Testing", "SIEM Tools", "Vulnerability Assessment", "Security Protocols"],
    "Full Stack Developer":      ["Frontend (React/Vue)", "Backend (Node/Django)", "Database", "APIs", "Version Control"],
    "Data Analyst":              ["SQL", "Python/R", "Excel", "Data Visualization", "Statistical Analysis"],
    "Embedded Systems Engineer": ["C/C++", "Microcontrollers", "RTOS", "Hardware Interfacing", "Debugging"],
    "Research Engineer":         ["Mathematics", "Research Methodology", "ML/AI", "Paper Writing", "Programming"],
    # Science
    "Research Scientist":        ["Scientific Methodology", "Data Analysis", "Lab Techniques", "Scientific Writing", "Critical Thinking"],
    "Biotechnologist":           ["Molecular Biology", "Genetic Engineering", "Lab Skills", "Bioinformatics", "Research Methods"],
    "Environmental Scientist":   ["Environmental Analysis", "Field Research", "GIS", "Report Writing", "Sustainability"],
    "Biostatistician":           ["Biostatistics", "Clinical Trial Design", "R/SAS", "Data Analysis", "Report Writing"],
    "Forensic Scientist":        ["Forensic Analysis", "Chain of Custody", "Lab Skills", "Report Writing", "Criminal Procedure"],
    # Psychology
    "Clinical Psychologist":     ["Psychological Assessment", "Therapeutic Techniques", "Case Formulation", "Ethics", "Documentation"],
    "Counseling Psychologist":   ["Counseling Skills", "Active Listening", "Psychological Assessment", "Mental Health", "Client Relations"],
    "Organizational Psychologist": ["IO Psychology", "HR Analytics", "Workplace Wellbeing", "Assessment Tools", "Consulting"],
    "Educational Psychologist":  ["Learning Assessment", "Child Development", "Intervention Strategies", "Report Writing", "School Collaboration"],
    # Education
    "School Teacher":            ["Subject Expertise", "Lesson Planning", "Classroom Management", "Assessment Design", "Communication"],
    "University Professor / Lecturer": ["Research", "Academic Writing", "Teaching", "Mentorship", "Subject Expertise"],
    "Curriculum Developer":      ["Curriculum Design", "Instructional Design", "Content Development", "Assessment", "Learning Objectives"],
    "Education Consultant":      ["Education Policy", "School Management", "Leadership", "Communication", "Problem Solving"],
    "E-Learning Designer":       ["Instructional Design", "LMS Platforms", "Multimedia Production", "Content Writing", "Assessment Design"],
    # Architecture & Design
    "Architect":                 ["AutoCAD", "Design Principles", "Construction Knowledge", "3D Modelling", "Project Management"],
    "Urban Planner":             ["Urban Design", "GIS", "Policy Analysis", "Community Engagement", "Spatial Planning"],
    "Interior Designer":         ["Space Planning", "3D Visualization", "Material Knowledge", "Client Management", "Design Software"],
    "Graphic Designer":          ["Adobe Creative Suite", "Typography", "Visual Communication", "Brand Design", "Illustration"],
    "UI/UX Designer":            ["Figma/Sketch", "User Research", "Prototyping", "Interaction Design", "Usability Testing"],
    "Fashion Designer":          ["Fashion Illustration", "Textile Knowledge", "Garment Construction", "Trend Analysis", "Portfolio"],
    "Product Designer":          ["CAD Software", "User Research", "Prototyping", "Materials Knowledge", "Design Thinking"],
    # Agriculture
    "Agricultural Scientist":    ["Agronomy", "Soil Science", "Crop Management", "Research Methods", "Data Analysis"],
    "Food Technologist":         ["Food Science", "Quality Control", "Food Processing", "Regulatory Compliance", "Lab Skills"],
    "Horticulturist":            ["Plant Science", "Pest Management", "Nursery Management", "Crop Cultivation", "Soil Knowledge"],
    "Agricultural Extension Officer": ["Extension Education", "Farming Techniques", "Communication", "Rural Development", "Report Writing"],
    "Veterinarian (Small Animal)": ["Clinical Veterinary Medicine", "Surgery", "Pharmacology", "Diagnostics", "Client Communication"],
    # Media
    "Journalist":                ["Writing & Editing", "Research", "Interview Skills", "Media Ethics", "Digital Media"],
    "Content Creator / Influencer": ["Content Strategy", "Social Media", "Video Production", "SEO", "Analytics"],
    "Film Director":             ["Direction", "Scriptwriting", "Cinematography", "Editing", "Production Management"],
    "Public Relations Specialist": ["PR Strategy", "Media Relations", "Crisis Communication", "Writing", "Digital PR"],
    # Hospitality
    "Hotel Manager":             ["Hotel Operations", "Guest Relations", "Revenue Management", "Team Leadership", "F&B Knowledge"],
    "Event Manager":             ["Event Planning", "Vendor Management", "Budgeting", "Logistics", "Communication"],
    "Travel Consultant":         ["Geography", "Travel Products", "Customer Service", "Booking Systems", "Itinerary Planning"],
    # Vocational
    "Electrical Technician":     ["Electrical Wiring", "Circuit Analysis", "Safety Protocols", "Equipment Maintenance", "Troubleshooting"],
    "Automotive Mechanic":       ["Engine Repair", "Diagnostics", "Electrical Systems", "Vehicle Maintenance", "Safety"],
    "Welding Technician":        ["Welding Techniques", "Metal Fabrication", "Safety Protocols", "Blueprint Reading", "Quality Inspection"],
    # Government & Arts
    "Civil Services Officer (IAS/IPS)": ["Public Administration", "Policy Analysis", "Communication", "Leadership", "General Knowledge"],
    "Political Analyst":         ["Political Theory", "Policy Research", "Communication", "Data Analysis", "Writing"],
    "Social Worker":             ["Community Development", "Counseling", "Report Writing", "Empathy", "Program Management"],
    "NGO Program Manager":       ["Program Management", "Fundraising", "Community Development", "Reporting", "Stakeholder Engagement"],
    # Research
    "Research Scientist":        ["Research Methodology", "Data Analysis", "Lab Techniques", "Scientific Writing", "Critical Thinking"],
    "R&D Specialist":            ["Research Planning", "Innovation Management", "Lab Skills", "Patent Writing", "Cross-functional Collaboration"],
    "HR Specialist":             ["Talent Acquisition", "Payroll", "Employee Relations", "HRIS", "Training & Development"],
}

CAREER_CERTIFICATIONS: dict[str, list[str]] = {
    "General Physician": ["USMLE / PLAB", "BLS / ACLS", "FMGE (MCI Screening)", "Fellowship Programs"],
    "Surgeon": ["MRCS", "MS Surgery Board Cert", "ATLS", "Laparoscopic Surgery Cert"],
    "Medical Researcher": ["GCP Certification", "ACRP Clinical Research", "Biostatistics Cert", "Research Ethics"],
    "Cardiologist": ["MRCP", "Cardiology Board Cert", "ACLS", "Echocardiography Cert"],
    "Neurologist": ["Neurology Board Cert", "MRCP", "EEG Certification", "ACLS"],
    "Pediatrician": ["Pediatrics Board Cert", "NRP", "PALS", "Neonatology Cert"],
    "Radiologist": ["Radiology Board Cert", "PET-CT Certification", "Interventional Radiology Cert"],
    "Public Health Specialist": ["CHES", "MPH Degree", "WHO Health Promotion Cert", "Epidemiology Cert"],
    "Hospital Administrator": ["FACHE", "PMP", "LEAN Healthcare Cert", "CPHIMS"],
    "Dentist (General Practice)": ["BDS Registration", "BLS", "Implantology Cert", "Endodontics Cert"],
    "Staff Nurse": ["RN License", "BLS", "Infection Control Cert", "IV Therapy Cert"],
    "ICU / Critical Care Nurse": ["CCRN", "BLS/ACLS", "Ventilator Management Cert", "PCCN"],
    "Community Health Nurse": ["PHN Certificate", "BLS", "Family Planning Cert", "ASHA Training"],
    "Pharmacist": ["Pharmacy Council Registration", "BCPS", "Pharm.D", "MTM Certification"],
    "Clinical Pharmacist": ["BCPS", "PharmD", "Clinical Pharmacology Cert"],
    "Drug Safety Associate": ["DIA Pharmacovigilance Cert", "RAPS Regulatory Affairs", "GVP Cert"],
    "Medical Writer": ["AMWA Certification", "RAC (RAPS)", "Medical Writing Cert"],
    "Pharmaceutical Researcher": ["GLP Certification", "GCP Cert", "Clinical Research Cert"],
    "Regulatory Affairs Specialist": ["RAC (RAPS)", "ISO 13485", "CDSCO Regulatory Cert"],
    "Advocate / Lawyer": ["Bar Council Enrollment", "Mediation Cert", "Criminal Trial Advocacy"],
    "Corporate Lawyer": ["Company Law Cert", "SEBI Registration", "Bar Council Enrollment", "M&A Cert"],
    "Compliance Officer": ["Certified Compliance Professional (CCP)", "CAMS", "ISO 37301 Lead Implementer"],
    "Intellectual Property Attorney": ["Patent Agent Exam", "Trademark Agent Registration", "IP Law Cert"],
    "Chartered Accountant (CA)": ["ICAI CA Final", "DISA", "Certificate in Ind AS", "USFPA"],
    "Auditor": ["CIA", "CPA", "CISA", "ACCA"],
    "Tax Consultant": ["GST Practitioner Cert", "CA Inter", "CPA", "Tax Audit Cert"],
    "Financial Analyst": ["CFA Level 1/2/3", "FRM", "Bloomberg Market Concepts", "CPA"],
    "Investment Banker": ["CFA", "FRM", "CISI", "NISM Equity Derivatives"],
    "Actuary": ["IAI Exams", "IFoA Exams", "SoA/CAS Exams"],
    "Portfolio Manager": ["CFA", "NISM Series-V-A", "FRM", "Bloomberg Cert"],
    "Business Analyst": ["CBAP", "PMI-PBA", "Agile BA Cert", "Six Sigma Green Belt"],
    "Product Manager": ["AIPMM CPM", "Certified Scrum PO", "Google PM Cert", "PMP"],
    "Marketing Manager": ["Google Digital Marketing", "HubSpot Marketing", "Meta Blueprint", "CIMM"],
    "Human Resources Manager": ["SHRM-CP", "PHR", "CIPD", "HR Analytics Cert"],
    "Operations Manager": ["Six Sigma Black Belt", "PMP", "APICS CPIM", "Lean Cert"],
    "Software Engineer": ["AWS Developer", "Google Cloud Associate", "Oracle Java", "Microsoft Azure"],
    "AI / ML Engineer": ["TensorFlow Developer Cert", "AWS ML Specialty", "Deep Learning Specialization", "Google ML Cert"],
    "ML Engineer": ["AWS ML Specialty", "Google Cloud ML", "MLflow Certified", "Kubeflow"],
    "Data Scientist": ["IBM Data Science", "Google Data Analytics", "Databricks Associate", "Kaggle Cert"],
    "Cloud Architect": ["AWS Solutions Architect", "Google Cloud Professional Architect", "Azure Solutions Architect"],
    "DevOps Engineer": ["CKA", "AWS DevOps Pro", "HashiCorp Terraform", "GitLab CI/CD"],
    "Cybersecurity Analyst": ["CompTIA Security+", "CEH", "CISSP", "OSCP"],
    "Data Analyst": ["Google Data Analytics", "Microsoft Power BI", "Tableau Desktop Specialist", "SQL Cert"],
    "Research Scientist": ["GCP Cert", "Lab Safety Cert", "Research Ethics Cert", "Domain-specific Cert"],
    "Biotechnologist": ["GLP Cert", "Bioinformatics Cert", "Flow Cytometry Cert", "PCR Specialist"],
    "Environmental Scientist": ["ISO 14001 Lead Auditor", "GIS Certification (ESRI)", "NEBOSH Cert"],
    "Biostatistician": ["SAS Certified", "R Programming Cert", "Biostatistics Cert"],
    "School Teacher": ["B.Ed Degree", "TET / CTET", "CBSE Training Cert", "Google Educator"],
    "University Professor / Lecturer": ["NET / JRF", "PhD Degree", "Faculty Development Program"],
    "Curriculum Developer": ["Instructional Design Cert", "eLearning Authoring Cert", "Google Educator"],
    "Architect": ["Council of Architecture (COA) Registration", "LEED Green Associate", "AutoCAD Certified"],
    "UI/UX Designer": ["Google UX Design Cert", "Adobe XD Cert", "Figma Advanced Cert", "IDF Cert"],
    "Graphic Designer": ["Adobe Certified Expert", "Canva Cert", "CorelDRAW Cert"],
    "Agricultural Scientist": ["ICAR-NET", "ASRB ARS Exam", "Plant Protection Cert"],
    "Food Technologist": ["FSSAI Cert", "HACCP Cert", "ISO 22000 Lead Auditor"],
    "Veterinarian (Small Animal)": ["VCI Registration", "NAVLE", "Surgery Specialization Cert"],
    "Journalist": ["Press Council Accreditation", "NCTJ Diploma", "Digital Journalism Cert"],
    "Hotel Manager": ["IHM Diploma", "Revenue Management Cert", "Food Safety Supervisor Cert"],
    "Event Manager": ["CSEP", "CMP", "Event Management Cert"],
    "Electrical Technician": ["ITI Certificate", "Wireman License", "CPRI Cert"],
    "Automotive Mechanic": ["ITI Mechanic Cert", "ASE Certification", "EV Mechanic Cert"],
    "Welding Technician": ["ASME Welding Cert", "AWS CWI", "ISO 9606 Welding Cert"],
    "Civil Services Officer (IAS/IPS)": ["UPSC Civil Services", "State PCS", "LBSNAA Training"],
    "Clinical Psychologist": ["RCI License", "AMHCA Cert", "CBT Certification"],
    "Counseling Psychologist": ["Counseling Cert", "RCI License", "Mental Health First Aid"],
    "Research Scientist": ["Domain Specialization Cert", "GCP Cert", "Data Analysis Cert"],
}

CAREER_PROJECTS: dict[str, list[str]] = {
    "General Physician": ["Clinical Case Portfolio", "Community Health Camp", "Patient Education Module"],
    "Surgeon": ["Surgical Case Log", "Operative Techniques Portfolio", "Case Presentation at Conference"],
    "Medical Researcher": ["Clinical Trial Protocol", "Systematic Review Publication", "Epidemiological Study"],
    "Public Health Specialist": ["Community Health Survey", "Disease Surveillance Report", "Health Policy Brief"],
    "Hospital Administrator": ["Hospital Process Improvement", "Budget Management Report", "Accreditation Prep Report"],
    "Staff Nurse": ["Patient Care Protocol Manual", "Infection Control Audit", "Nursing Case Portfolio"],
    "ICU / Critical Care Nurse": ["Critical Care Protocol Review", "Patient Safety Audit", "ICU Data Study"],
    "Pharmacist": ["Drug Interaction Database", "Formulary Review", "Medication Counseling Record"],
    "Drug Safety Associate": ["Pharmacovigilance Case Studies", "SAE Report Portfolio", "Signal Detection Report"],
    "Pharmaceutical Researcher": ["Drug Synthesis Report", "Preclinical Study Report", "Research Publication"],
    "Advocate / Lawyer": ["Legal Case Brief Portfolio", "Moot Court Participation", "Contract Drafting Portfolio"],
    "Corporate Lawyer": ["M&A Due Diligence Report", "Corporate Governance Manual", "Company Law Audit"],
    "Compliance Officer": ["Regulatory Compliance Framework", "AML Policy Document", "Risk Assessment Report"],
    "Chartered Accountant (CA)": ["Financial Audit Report", "Tax Compliance Project", "Articleship Case Studies"],
    "Financial Analyst": ["Financial Model (DCF/LBO)", "Equity Research Report", "Investment Thesis"],
    "Investment Banker": ["Pitch Deck / CIM", "Valuation Model", "M&A Case Study"],
    "Auditor": ["Internal Audit Report", "Risk Assessment Study", "Statutory Audit Case"],
    "Business Analyst": ["Business Process Mapping", "Requirements Specification Doc", "Case Study Analysis"],
    "Product Manager": ["Product Roadmap", "PRD Document", "User Research Report", "A/B Testing Analysis"],
    "Marketing Manager": ["Digital Campaign Project", "Brand Strategy Deck", "Market Research Report"],
    "Human Resources Manager": ["HR Policy Manual", "Recruitment Campaign", "Employee Engagement Survey"],
    "Software Engineer": ["REST API Project", "CRUD Application", "Open Source Contribution"],
    "AI / ML Engineer": ["ML Model Deployment", "NLP Chatbot", "Computer Vision Project", "Kaggle Competition"],
    "Data Scientist": ["EDA + Dashboard", "Predictive Model", "Customer Segmentation Project"],
    "Cloud Architect": ["Multi-Tier Cloud Architecture", "Infrastructure as Code", "Cloud Cost Optimization"],
    "DevOps Engineer": ["CI/CD Pipeline", "Kubernetes Cluster Setup", "Monitoring Stack"],
    "Cybersecurity Analyst": ["Penetration Test Report", "Vulnerability Assessment", "SIEM Implementation"],
    "Data Analyst": ["Interactive Dashboard (Power BI/Tableau)", "SQL Analysis Report", "BI Project"],
    "Research Scientist": ["Research Paper Publication", "Lab Experiment Documentation", "Thesis Project"],
    "Biotechnologist": ["Gene Expression Analysis", "PCR Protocol Project", "Bioinformatics Pipeline"],
    "Environmental Scientist": ["Environmental Impact Assessment", "GIS Mapping Project", "Sustainability Report"],
    "School Teacher": ["Lesson Plan Portfolio", "Student Assessment Project", "Classroom Innovation"],
    "University Professor / Lecturer": ["Research Publication", "Course Design Portfolio", "Grant Proposal"],
    "Curriculum Developer": ["Curriculum Design Document", "eLearning Module", "Assessment Framework"],
    "Architect": ["Building Design Portfolio", "3D Model Project", "Urban Design Proposal"],
    "UI/UX Designer": ["Mobile App UX Case Study", "Website Redesign", "Design System"],
    "Graphic Designer": ["Brand Identity Project", "Logo Portfolio", "Poster Campaign"],
    "Agricultural Scientist": ["Crop Yield Analysis", "Soil Testing Report", "Pest Management Study"],
    "Food Technologist": ["FSSAI Compliance Report", "New Product Development", "Quality Audit Report"],
    "Journalist": ["News Article Portfolio", "Investigative Report", "Feature Story"],
    "Hotel Manager": ["Revenue Optimization Report", "Guest Satisfaction Survey", "Hotel Operations Manual"],
    "Event Manager": ["Event Portfolio", "Budget Management Report", "Vendor Management Case Study"],
    "Electrical Technician": ["Electrical Installation Project", "Wiring Diagram Portfolio", "Safety Audit"],
    "Automotive Mechanic": ["Vehicle Diagnosis Portfolio", "Engine Overhaul Report", "EV Servicing Log"],
    "Welding Technician": ["Welding Certification Portfolio", "Metal Fabrication Project", "Quality Inspection Log"],
    "Civil Services Officer (IAS/IPS)": ["Policy Analysis Essay", "Case Study Reports", "Essay Competition Portfolio"],
    "Clinical Psychologist": ["Case Formulation Portfolio", "Assessment Report Portfolio", "Research Paper"],
    "Counseling Psychologist": ["Client Case Studies", "Group Therapy Design", "Counseling Portfolio"],
}

# ── Domain detection helper ────────────────────────────────────────────────

def _detect_domain(profile: Optional[StudentProfile], user_subjects: set[str]) -> str:
    """Detect learner's domain from degree/course, goals, and subjects."""
    context = " " + " ".join(user_subjects).lower() + " "
    if profile:
        context += f" {(profile.course or '').lower()} {(profile.academic_goals or '').lower()} "

    for keyword, domain in DEGREE_DOMAIN_MAP:
        if keyword in context:
            return domain
    return "general"


def _get_domain_careers(domain: str, context: str) -> list[str]:
    """Return relevant careers for the domain, with cross-domain additions."""
    careers = list(DOMAIN_CAREERS.get(domain, []))

    # Cross-domain additions based on detected skills/keywords
    if any(kw in context for kw in ["data", "analytics", "statistics", "python", "sql"]):
        for c in ["Data Analyst", "Data Scientist", "Biostatistician"]:
            if c not in careers and c in CAREER_SKILLS:
                careers.append(c)

    if any(kw in context for kw in ["research", "publication", "phd", "mphil"]):
        for c in ["Research Scientist", "University Professor / Lecturer"]:
            if c not in careers and c in CAREER_SKILLS:
                careers.append(c)

    if any(kw in context for kw in ["management", "leadership", "hr", "administration"]):
        for c in ["Operations Manager", "Human Resources Manager"]:
            if c not in careers and c in CAREER_SKILLS:
                careers.append(c)

    if not careers:
        # General fallback — pick roles with most keyword overlap
        careers = list(CAREER_SKILLS.keys())[:12]

    return careers


def _best_role(subjects: List[str], profile: Optional[StudentProfile]) -> str:
    """Return the single best-matching career for this learner."""
    context = " ".join(subjects).lower()
    if profile:
        context += f" {(profile.course or '').lower()} {(profile.academic_goals or '').lower()}"

    domain = _detect_domain(profile, set(subjects))
    candidates = _get_domain_careers(domain, context)

    best_role = candidates[0] if candidates else "Software Engineer"
    best_score = -1
    for role in candidates:
        keywords = CAREER_SKILLS.get(role, [])
        if not keywords:
            continue
        score = sum(1 for kw in keywords if kw in context)
        if score > best_score:
            best_score, best_role = score, role
    return best_role


def _compute_career_score(
    role: str,
    context: str,
    course: str,
    goals: str,
    resume_skills: list[str],
    certifications: list[str],
    avg_score: float,
    avg_study: float,
) -> tuple[int, list[str], list[str], str]:
    """
    Domain-aware career compatibility.
    Formula: 40% Skill Match + 25% Education Match + 20% Experience +
             10% Certification Match + 5% Goals Match
    """
    keywords = CAREER_SKILLS.get(role, [])
    if not keywords:
        return 0, [], [], f"No keyword data available for {role}."

    full_ctx = (context + " " + " ".join(resume_skills)).lower()
    course_l = course.lower()
    goals_l  = goals.lower()
    cert_l   = " ".join(certifications).lower()

    # 40% — Skill Match (subjects + resume skills vs role keywords)
    matched_kw = [kw for kw in keywords if kw in full_ctx]
    skill_pct  = (len(matched_kw) / len(keywords)) * 100

    # 25% — Education Match (degree keywords vs role keywords)
    edu_matches = sum(1 for kw in keywords if kw in course_l)
    edu_pct     = min(100.0, (edu_matches / max(1, min(4, len(keywords)))) * 100)

    # 20% — Experience Match (proxy: academic score × study hours factor)
    exp_pct = min(100.0, avg_score * 0.65 + min(avg_study / 6, 1) * 35)

    # 10% — Certification Match
    cert_matches = sum(1 for kw in keywords if kw in cert_l)
    cert_pct     = min(100.0, cert_matches * 30.0)

    # 5% — Goals Match
    goal_matches = sum(1 for kw in keywords if kw in goals_l)
    goals_pct    = min(100.0, goal_matches * 25.0)

    total = int(
        skill_pct * 0.40 +
        edu_pct   * 0.25 +
        exp_pct   * 0.20 +
        cert_pct  * 0.10 +
        goals_pct * 0.05
    )
    total = max(5, min(99, total))

    # Human-readable reasoning
    if matched_kw:
        reasoning = (
            f"Your {course or 'academic'} background with matched skills "
            f"({', '.join(matched_kw[:2])}) aligns well with {role}."
        )
    elif edu_matches:
        reasoning = f"Your {course} programme provides relevant foundational knowledge for {role}."
    elif avg_score > 70:
        reasoning = f"Strong academic performance ({avg_score:.0f}%) indicates capacity to grow into {role}."
    else:
        reasoning = f"With targeted upskilling you can transition into {role} from your current profile."

    required = CAREER_REQUIRED_SKILLS.get(role, [])
    missing  = [r for r in required if r.lower() not in full_ctx][:5]
    return total, [m.title() for m in matched_kw[:4]], missing, reasoning


def _match_score(user_context: str, role: str) -> tuple[int, list[str], list[str]]:
    """Legacy helper kept for skill-gap and roadmap endpoints."""
    keywords = CAREER_SKILLS.get(role, [])
    required = CAREER_REQUIRED_SKILLS.get(role, [])
    matched  = [kw for kw in keywords if kw in user_context.lower()]
    missing  = [r for r in required if r.lower() not in user_context.lower()]
    pct      = round(len(matched) / len(keywords) * 100) if keywords else 0
    return pct, [m.title() for m in matched], missing[:5]


# ── Shared resume analysis logic ───────────────────────────────────────────

def _run_resume_analysis(resume_text: str, target_role: str) -> dict:
    prompt = f"""You are an expert resume reviewer, ATS specialist, and career coach.
Analyze this resume for a {target_role} role. Be thorough and specific.

RESUME:
{resume_text[:5000]}

Respond ONLY with valid JSON in this exact structure:
{{
  "score": <0-100>,
  "ats_score": <0-100>,
  "formatting_score": <0-100>,
  "content_score": <0-100>,
  "keyword_score": <0-100>,
  "industry_relevance": "<1 sentence on how well it fits {target_role}>",
  "strengths": ["s1", "s2", "s3"],
  "weaknesses": ["w1", "w2", "w3"],
  "grammar_issues": ["g1", "g2"],
  "formatting_issues": ["f1", "f2"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3", "suggestion4"],
  "missing_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],
  "sections": [
    {{"name": "Contact Info",     "score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Summary/Objective","score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Experience",       "score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Education",        "score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Skills",           "score": <0-100>, "feedback": "...", "suggestions": ["..."]}},
    {{"name": "Projects",         "score": <0-100>, "feedback": "...", "suggestions": ["..."]}}
  ],
  "bullet_improvements": [
    {{"section": "Experience", "original": "<exact weak bullet from resume>", "improved": "<stronger version with metrics>", "reason": "<why it's better>"}},
    {{"section": "Projects",   "original": "<exact weak bullet>",            "improved": "<stronger version>",             "reason": "..."}},
    {{"section": "Experience", "original": "<another weak bullet>",          "improved": "<stronger version>",             "reason": "..."}}
  ]
}}"""
    return _groq_json(prompt, max_tokens=2000) or {}


# ── 1. Career Overview ─────────────────────────────────────────────────────

@router.get("/overview", response_model=CareerReadinessResponse)
def get_career_overview(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile  = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    entries  = db.query(LearningData).filter_by(user_id=current_user.id).order_by(LearningData.date).all()
    records  = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    quizzes  = db.query(QuizSession).filter_by(user_id=current_user.id).filter(QuizSession.score.isnot(None)).all()

    subj_scores = [r.score for r in records]
    if subj_scores:
        academic_score = _safe_avg(subj_scores)
    else:
        fb = [e.exam_scores for e in entries if e.exam_scores] + [e.quiz_scores for e in entries if e.quiz_scores]
        academic_score = _safe_avg(fb) if fb else 0.0

    consistency_score  = _safe_avg([e.attendance_percentage     for e in entries])
    assignment_score   = _safe_avg([e.assignment_completion_rate for e in entries])
    study_score        = _safe_avg([min(e.study_hours / 6.0, 1.0) * 100 for e in entries])
    conf_vals          = [(r.confidence / 5.0) * 100 for r in records]
    confidence_score   = _safe_avg(conf_vals) if conf_vals else 50.0

    qv: list[float] = []
    for qs in quizzes:
        if qs.total and qs.total > 0: qv.append((qs.score / qs.total) * 100)
    for e in entries:
        if e.quiz_scores: qv.append(e.quiz_scores)
    quiz_score = _safe_avg(qv)

    today  = date.today()
    recent = {e.date for e in entries if (today - e.date).days <= 7}
    engagement_score = min(len(recent) / 5.0, 1.0) * 100

    has_data = bool(entries or records)
    overall = int(round(min(max(
        (academic_score * 0.25 + consistency_score * 0.20 + quiz_score * 0.15 +
         assignment_score * 0.15 + study_score * 0.15 + confidence_score * 0.05 +
         engagement_score * 0.05) if has_data else 0, 0), 100)))

    grade = "A" if overall >= 85 else "B" if overall >= 70 else "C" if overall >= 55 else "D"
    components = {
        "Academic Performance": round(academic_score, 1),
        "Consistency":          round(consistency_score, 1),
        "Quiz Performance":     round(quiz_score, 1),
        "Assignment Completion":round(assignment_score, 1),
        "Study Dedication":     round(study_score, 1),
        "Confidence":           round(confidence_score, 1),
        "Engagement":           round(engagement_score, 1),
    }
    sorted_comps = sorted(components.items(), key=lambda x: x[1], reverse=True)
    strengths    = [k for k, v in sorted_comps if v >= 65][:3]
    improvements = [k for k, v in sorted_comps if v < 65][:3]

    if len(entries) >= 3:
        r_entries = sorted(entries, key=lambda e: e.date)[-10:]
        trend = r_entries[-1].study_hours - r_entries[0].study_hours
        prob  = min(95, max(30, overall + int(trend * 3)))
    else:
        prob = max(20, int(overall * 0.8))

    subjects = list({r.subject for r in records})
    if profile and profile.subjects:
        subjects += [s.strip() for s in profile.subjects.split(",") if s.strip()]
    top_role = _best_role(subjects, profile)

    return CareerReadinessResponse(
        score=overall, grade=grade,
        strengths=strengths or ["Getting Started"],
        areas_to_improve=improvements or ["Build more learning data"],
        component_scores=components,
        twin_prediction=(
            f"Your Digital Twin predicts a {prob}% probability of becoming job-ready for "
            f"{top_role} roles within 6 months, based on your learning trajectory."
        ),
        job_readiness_probability=round(prob / 100, 2),
    )


# ── 2. Resume upload (multipart) ───────────────────────────────────────────

@router.post("/resume/upload", response_model=ResumeAnalyzeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    target_role: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_UPLOAD_MB} MB limit.")

    fname = (file.filename or "").lower()
    if fname.endswith(".pdf"):
        text = _extract_pdf(content)
    elif fname.endswith(".docx"):
        text = _extract_docx(content)
    elif fname.endswith(".txt"):
        text = content.decode("utf-8", errors="replace")
    else:
        raise HTTPException(status_code=415, detail="Only PDF, DOCX, and TXT files are supported.")

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from this file.")

    role = target_role.strip() or "Software Developer"
    data = _run_resume_analysis(text, role)
    if not data:
        raise HTTPException(status_code=500, detail="AI analysis failed. Please try again.")

    sections = [ResumeSection(
        name=s.get("name", ""),
        score=int(s.get("score", 50)),
        feedback=s.get("feedback", ""),
        suggestions=s.get("suggestions", []),
    ) for s in data.get("sections", [])]

    bullets = [BulletImprovement(**b) for b in data.get("bullet_improvements", []) if isinstance(b, dict)]

    # Extract skills from resume text for Career Twin
    skill_keywords = [kw for kws in CAREER_SKILLS.values() for kw in kws]
    detected_skills = [kw.title() for kw in skill_keywords if kw in text.lower()]

    resume_score = float(data.get("score", 60))
    _update_twin(current_user.id, db,
                 resume_score=resume_score,
                 skills=detected_skills[:20],
                 resume_text=text[:8000],
                 event="resume_upload")

    return ResumeAnalyzeResponse(
        score=int(data.get("score", 60)),
        ats_score=int(data.get("ats_score", 55)),
        formatting_score=int(data.get("formatting_score", 60)),
        content_score=int(data.get("content_score", 60)),
        keyword_score=int(data.get("keyword_score", 50)),
        industry_relevance=data.get("industry_relevance", ""),
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        grammar_issues=data.get("grammar_issues", []),
        formatting_issues=data.get("formatting_issues", []),
        suggestions=data.get("suggestions", []),
        missing_keywords=data.get("missing_keywords", []),
        sections=sections,
        bullet_improvements=bullets,
        twin_updated=True,
    )


# ── 2b. Resume analyze (text paste, backward-compat) ──────────────────────

@router.post("/resume/analyze", response_model=ResumeAnalyzeResponse)
def analyze_resume(
    payload: ResumeAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    role = payload.target_role or "Software Developer"
    data = _run_resume_analysis(payload.resume_text, role)
    if not data:
        raise HTTPException(status_code=500, detail="AI analysis failed.")

    sections = [ResumeSection(
        name=s.get("name", ""), score=int(s.get("score", 50)),
        feedback=s.get("feedback", ""), suggestions=s.get("suggestions", []),
    ) for s in data.get("sections", [])]
    bullets = [BulletImprovement(**b) for b in data.get("bullet_improvements", []) if isinstance(b, dict)]

    resume_score = float(data.get("score", 60))
    _update_twin(current_user.id, db, resume_score=resume_score,
                 resume_text=payload.resume_text[:8000], event="resume_analyze")

    return ResumeAnalyzeResponse(
        score=int(data.get("score", 60)),
        ats_score=int(data.get("ats_score", 55)),
        formatting_score=int(data.get("formatting_score", 60)),
        content_score=int(data.get("content_score", 60)),
        keyword_score=int(data.get("keyword_score", 50)),
        industry_relevance=data.get("industry_relevance", ""),
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        grammar_issues=data.get("grammar_issues", []),
        formatting_issues=data.get("formatting_issues", []),
        suggestions=data.get("suggestions", []),
        missing_keywords=data.get("missing_keywords", []),
        sections=sections,
        bullet_improvements=bullets,
        twin_updated=True,
    )


# ── 3. LinkedIn Optimizer ──────────────────────────────────────────────────

@router.post("/linkedin/analyze", response_model=LinkedInAnalyzeResponse)
def analyze_linkedin(
    payload: LinkedInAnalyzeRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    role = payload.target_role or "Software Developer"
    prompt = f"""You are a LinkedIn optimization expert and personal branding specialist.
Analyze this LinkedIn profile for a {role} role. Be detailed and specific.

PROFILE:
{payload.profile_text[:5000]}

Respond ONLY with valid JSON:
{{
  "score": <0-100>,
  "visibility_score": <0-100>,
  "personal_brand_score": <0-100>,
  "recruiter_score": <0-100>,
  "section_scores": {{
    "Headline": <0-100>, "About": <0-100>, "Experience": <0-100>,
    "Skills": <0-100>, "Education": <0-100>, "Recommendations": <0-100>
  }},
  "optimized_headline": "<compelling headline under 220 chars>",
  "optimized_summary": "<improved About section, 4-5 sentences, first-person, metrics-driven>",
  "suggestions": ["s1", "s2", "s3", "s4"],
  "missing_skills": ["skill1", "skill2", "skill3"],
  "missing_certifications": ["cert1", "cert2"],
  "networking_suggestions": ["ns1", "ns2", "ns3"],
  "keyword_recommendations": ["kw1", "kw2", "kw3", "kw4"]
}}"""
    data = _groq_json(prompt, max_tokens=1400)
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="AI analysis failed.")

    li_score = float(data.get("score", 60))
    _update_twin(current_user.id, db, linkedin_score=li_score, event="linkedin_analyze")

    return LinkedInAnalyzeResponse(
        score=int(data.get("score", 60)),
        visibility_score=int(data.get("visibility_score", 55)),
        personal_brand_score=int(data.get("personal_brand_score", 55)),
        recruiter_score=int(data.get("recruiter_score", 50)),
        section_scores=data.get("section_scores", {}),
        optimized_headline=data.get("optimized_headline", ""),
        optimized_summary=data.get("optimized_summary", ""),
        suggestions=data.get("suggestions", []),
        missing_skills=data.get("missing_skills", []),
        missing_certifications=data.get("missing_certifications", []),
        networking_suggestions=data.get("networking_suggestions", []),
        keyword_recommendations=data.get("keyword_recommendations", []),
        twin_updated=True,
    )


# ── LinkedIn Digital Twin helpers ─────────────────────────────────────────────

def _get_li_achievements(twin: CareerTwin) -> list[dict]:
    return json.loads(twin.linkedin_achievements_json or "[]")


def _save_li_achievements(twin: CareerTwin, achievements: list[dict], db: DBSession) -> None:
    twin.linkedin_achievements_json = json.dumps(achievements[-50:])  # keep latest 50
    db.commit()


def _analyze_achievement_text(text: str, achiev_type: str) -> dict:
    prompt = f"""You are a career coach analyzing a professional achievement or certificate.

ACHIEVEMENT/CERTIFICATE TEXT:
{text[:3000]}

TYPE: {achiev_type}

Respond ONLY with valid JSON:
{{
  "title": "<concise title for this achievement>",
  "skills_gained": ["skill1", "skill2", "skill3"],
  "technologies": ["tech1", "tech2"],
  "difficulty_level": "<Beginner|Intermediate|Advanced>",
  "career_value": "<1 sentence on career value>",
  "industry_relevance": "<which industries value this>",
  "impact_score": <0-100>,
  "career_value_score": <0-100>,
  "recruiter_appeal_score": <0-100>,
  "why_it_matters": "<2 sentences: why recruiters care>",
  "how_it_improves": "<2 sentences: how it improves employability>",
  "career_paths_supported": ["path1", "path2", "path3"]
}}"""
    return _groq_json(prompt, max_tokens=700) or {}


def _run_linkedin_twin_analysis(profile_text: str, role: str, achievements: list[dict]) -> tuple[dict, dict]:
    """Two focused Groq calls for reliability. Returns (analysis_data, recommendations_data)."""
    achiev_summary = ", ".join(
        f"{a.get('title','?')} ({', '.join(a.get('skills_gained', [])[:2])})"
        for a in achievements[:6]
    ) if achievements else "None yet"

    # Call 1: Profile scoring + content + checklist + improvements
    prompt1 = f"""You are a LinkedIn optimization expert and personal branding specialist.
Analyze this LinkedIn profile for a {role} role.

PROFILE TEXT:
{profile_text[:4500]}

UPLOADED ACHIEVEMENTS/CERTS: {achiev_summary}

Respond ONLY with valid JSON (no extra text):
{{
  "profile_strength": <0-100>,
  "recruiter_visibility": <0-100>,
  "personal_branding": <0-100>,
  "industry_relevance_score": <0-100>,
  "network_readiness": <0-100>,
  "overall_score": <0-100>,
  "sections": [
    {{"name": "Headline",        "score": <0-100>, "feedback": "...", "suggestion": "..."}},
    {{"name": "About",           "score": <0-100>, "feedback": "...", "suggestion": "..."}},
    {{"name": "Experience",      "score": <0-100>, "feedback": "...", "suggestion": "..."}},
    {{"name": "Skills",          "score": <0-100>, "feedback": "...", "suggestion": "..."}},
    {{"name": "Projects",        "score": <0-100>, "feedback": "...", "suggestion": "..."}},
    {{"name": "Certifications",  "score": <0-100>, "feedback": "...", "suggestion": "..."}},
    {{"name": "Recommendations", "score": <0-100>, "feedback": "...", "suggestion": "..."}}
  ],
  "suggested_headline": "<compelling headline under 220 chars with keywords>",
  "suggested_about": "<improved About section, 4-5 sentences, first-person, impact-driven>",
  "improvements": [
    {{"section": "Headline",    "current_version": "<extract from profile or describe>", "suggested_version": "<improved>", "reason": "..."}},
    {{"section": "About",       "current_version": "<extract or describe>",               "suggested_version": "<improved>", "reason": "..."}},
    {{"section": "Experience",  "current_version": "<weak bullet or description>",        "suggested_version": "<stronger>",  "reason": "..."}},
    {{"section": "Skills",      "current_version": "<current skills list>",               "suggested_version": "<optimized>", "reason": "..."}}
  ],
  "checklist": [
    {{"key": "headline",      "label": "Strong Keyword-Rich Headline",   "completed": <true|false>, "recommendation": "..."}},
    {{"key": "about",         "label": "Compelling About Section",       "completed": <true|false>, "recommendation": "..."}},
    {{"key": "skills",        "label": "15+ Relevant Skills Listed",     "completed": <true|false>, "recommendation": "..."}},
    {{"key": "experience",    "label": "Quantified Experience Bullets",  "completed": <true|false>, "recommendation": "..."}},
    {{"key": "projects",      "label": "Portfolio Projects Added",       "completed": <true|false>, "recommendation": "..."}},
    {{"key": "certifications","label": "Industry Certifications Listed", "completed": <true|false>, "recommendation": "..."}},
    {{"key": "photo",         "label": "Professional Profile Photo",     "completed": <true|false>, "recommendation": "..."}},
    {{"key": "connections",   "label": "500+ Connections",               "completed": <true|false>, "recommendation": "..."}},
    {{"key": "keywords",      "label": "Industry Keywords in Profile",   "completed": <true|false>, "recommendation": "..."}},
    {{"key": "recommendations","label": "Peer Recommendations Added",   "completed": <true|false>, "recommendation": "..."}}
  ]
}}"""

    # Call 2: Recommendations + predictions
    prompt2 = f"""Based on this LinkedIn profile for a {role} position and their achievements ({achiev_summary}), generate career recommendations and predictions.

PROFILE SUMMARY: {profile_text[:1500]}

Respond ONLY with valid JSON:
{{
  "suitable_roles": ["role1", "role2", "role3", "role4"],
  "internship_opportunities": ["opp1", "opp2", "opp3"],
  "missing_skills": ["skill1", "skill2", "skill3", "skill4"],
  "missing_certifications": ["cert1", "cert2", "cert3"],
  "important_projects": ["project1", "project2", "project3"],
  "learning_priorities": ["p1", "p2", "p3"],
  "twin_insight": "<1 compelling sentence (max 35 words) predicting career trajectory>",
  "predictions": {{
    "3m": {{
      "months": 3,
      "career_growth": "<short description>",
      "recruiter_interest": <0-100>,
      "employability_score": <0-100>,
      "skill_growth": "<short description>",
      "opportunities": ["opp1", "opp2"]
    }},
    "6m": {{
      "months": 6,
      "career_growth": "<short description>",
      "recruiter_interest": <0-100>,
      "employability_score": <0-100>,
      "skill_growth": "<short description>",
      "opportunities": ["opp1", "opp2"]
    }},
    "12m": {{
      "months": 12,
      "career_growth": "<short description>",
      "recruiter_interest": <0-100>,
      "employability_score": <0-100>,
      "skill_growth": "<short description>",
      "opportunities": ["opp1", "opp2"]
    }}
  }}
}}"""

    analysis = _groq_json(prompt1, max_tokens=2200) or {}
    recs      = _groq_json(prompt2, max_tokens=1200) or {}
    return analysis, recs


def _build_linkedin_twin_response(
    analysis: dict, recs: dict,
    achievements: list[dict],
    now_str: str,
) -> LinkedInTwinFullResponse:
    sections = [
        LinkedInSectionScore(
            name=s.get("name", ""), score=int(s.get("score", 50)),
            feedback=s.get("feedback", ""), suggestion=s.get("suggestion", ""),
        )
        for s in analysis.get("sections", [])
    ]
    improvements = [
        LinkedInImprovementItem(**imp)
        for imp in analysis.get("improvements", [])
        if isinstance(imp, dict) and all(k in imp for k in ["section","current_version","suggested_version","reason"])
    ]
    checklist_raw = analysis.get("checklist", [])
    checklist = [
        LinkedInChecklistItem(**c)
        for c in checklist_raw
        if isinstance(c, dict) and all(k in c for k in ["key","label","completed","recommendation"])
    ]
    completed = sum(1 for c in checklist if c.completed)
    completion_pct = round(completed / len(checklist) * 100) if checklist else 0

    raw_preds = recs.get("predictions", {})
    predictions: dict[str, LinkedInTwinPrediction] = {}
    for key in ["3m", "6m", "12m"]:
        p = raw_preds.get(key, {})
        if isinstance(p, dict):
            predictions[key] = LinkedInTwinPrediction(
                months=int(p.get("months", {"3m":3,"6m":6,"12m":12}[key])),
                career_growth=p.get("career_growth", "Steady progress expected."),
                recruiter_interest=int(p.get("recruiter_interest", 50)),
                employability_score=int(p.get("employability_score", 50)),
                skill_growth=p.get("skill_growth", "Gradual improvement."),
                opportunities=p.get("opportunities", []),
            )

    achiev_models = [AchievementItem(**a) for a in achievements if _valid_achievement(a)]

    return LinkedInTwinFullResponse(
        profile_strength=int(analysis.get("profile_strength", 50)),
        recruiter_visibility=int(analysis.get("recruiter_visibility", 50)),
        personal_branding=int(analysis.get("personal_branding", 50)),
        industry_relevance_score=int(analysis.get("industry_relevance_score", 50)),
        network_readiness=int(analysis.get("network_readiness", 50)),
        overall_score=int(analysis.get("overall_score", 50)),
        sections=sections,
        suggested_headline=analysis.get("suggested_headline", ""),
        suggested_about=analysis.get("suggested_about", ""),
        improvements=improvements,
        checklist=checklist,
        checklist_completion=completion_pct,
        suitable_roles=recs.get("suitable_roles", []),
        internship_opportunities=recs.get("internship_opportunities", []),
        missing_skills=recs.get("missing_skills", []),
        missing_certifications=recs.get("missing_certifications", []),
        important_projects=recs.get("important_projects", []),
        learning_priorities=recs.get("learning_priorities", []),
        achievements=achiev_models,
        achievements_count=len(achiev_models),
        predictions=predictions,
        last_analyzed=now_str,
        twin_insight=recs.get("twin_insight", "Your LinkedIn profile is evolving — keep adding achievements."),
        twin_updated=True,
    )


def _valid_achievement(a: dict) -> bool:
    required = ["id","title","achievement_type","raw_text","skills_gained","technologies",
                "difficulty_level","career_value","industry_relevance","impact_score",
                "career_value_score","recruiter_appeal_score","why_it_matters",
                "how_it_improves","career_paths_supported","uploaded_at"]
    return all(k in a for k in required)


# ── 3b. LinkedIn Digital Twin — Upload / Analyze ─────────────────────────────

@router.post("/linkedin/upload", response_model=LinkedInTwinFullResponse)
async def upload_linkedin_profile(
    file: Optional[UploadFile] = File(None),
    profile_text: str = Form(""),
    profile_url: str = Form(""),
    target_role: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    text = ""
    if file and file.filename:
        content = await file.read()
        if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
            raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB.")
        fname = file.filename.lower()
        if fname.endswith(".pdf"):
            text = _extract_pdf(content)
        elif fname.endswith(".docx"):
            text = _extract_docx(content)
        elif fname.endswith(".txt"):
            text = content.decode("utf-8", errors="replace")
        else:
            raise HTTPException(415, "Only PDF, DOCX, or TXT files are supported.")

    if profile_text.strip():
        text = profile_text.strip() + "\n\n" + text

    # URL is stored as metadata; actual scraping is not possible without OAuth
    if profile_url.strip() and not text.strip():
        raise HTTPException(400, "LinkedIn scraping requires authentication. Please paste or upload your profile content.")

    if not text.strip():
        raise HTTPException(400, "Please provide profile content via text paste or file upload.")

    role = target_role.strip() or "Software Developer"
    twin = _get_or_create_twin(current_user.id, db)
    achievements = _get_li_achievements(twin)

    analysis, recs = _run_linkedin_twin_analysis(text, role, achievements)
    if not analysis:
        raise HTTPException(500, "AI analysis failed. Please try again.")

    now_str = datetime.utcnow().isoformat()
    response = _build_linkedin_twin_response(analysis, recs, achievements, now_str)

    # Persist profile JSON and update twin score
    twin.linkedin_profile_json = json.dumps({
        "profile_text": text[:5000],
        "target_role": role,
        "analysis": analysis,
        "recs": recs,
        "analyzed_at": now_str,
    })
    li_score = float(response.overall_score)
    _update_twin(current_user.id, db, linkedin_score=li_score, event="linkedin_twin")

    return response


# ── 3c. LinkedIn Digital Twin — Certificate Upload ────────────────────────────

@router.post("/linkedin/certificate", response_model=AchievementAnalyzeResponse)
async def upload_certificate(
    file: UploadFile = File(...),
    achievement_type: str = Form("certificate"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    content = await file.read()
    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB.")

    fname = (file.filename or "").lower()
    if fname.endswith(".pdf"):
        text = _extract_pdf(content)
    elif fname.endswith(".docx"):
        text = _extract_docx(content)
    elif fname.endswith(".txt"):
        text = content.decode("utf-8", errors="replace")
    elif fname.endswith((".jpg", ".jpeg", ".png", ".webp")):
        # Try Gemini for images
        import base64, requests as req
        if not settings.gemini_api_key:
            raise HTTPException(415, "Image certificates require GEMINI_API_KEY. Please upload as PDF or paste text.")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={settings.gemini_api_key}"
        mime = "image/jpeg" if fname.endswith((".jpg",".jpeg")) else "image/png" if fname.endswith(".png") else "image/webp"
        body = {"contents": [{"parts": [{"inline_data": {"mime_type": mime, "data": base64.b64encode(content).decode()}}, {"text": "Extract all text from this certificate or achievement document. Include name, issuer, date, skills, and any other relevant information."}]}]}
        try:
            r = req.post(url, json=body, timeout=20)
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            raise HTTPException(500, "Image analysis failed. Please upload as PDF instead.")
    else:
        raise HTTPException(415, "Supported formats: PDF, DOCX, TXT, JPG, PNG.")

    if not text.strip():
        raise HTTPException(422, "Could not extract text from this file.")

    data = _analyze_achievement_text(text, achievement_type)
    if not data:
        raise HTTPException(500, "Achievement analysis failed.")

    achievement = AchievementItem(
        id=str(uuid.uuid4()),
        title=data.get("title", file.filename or "Achievement"),
        achievement_type=achievement_type,
        raw_text=text[:2000],
        skills_gained=data.get("skills_gained", []),
        technologies=data.get("technologies", []),
        difficulty_level=data.get("difficulty_level", "Intermediate"),
        career_value=data.get("career_value", ""),
        industry_relevance=data.get("industry_relevance", ""),
        impact_score=int(data.get("impact_score", 60)),
        career_value_score=int(data.get("career_value_score", 60)),
        recruiter_appeal_score=int(data.get("recruiter_appeal_score", 60)),
        why_it_matters=data.get("why_it_matters", ""),
        how_it_improves=data.get("how_it_improves", ""),
        career_paths_supported=data.get("career_paths_supported", []),
        uploaded_at=datetime.utcnow().isoformat(),
    )

    # Persist to Career Twin
    twin = _get_or_create_twin(current_user.id, db)
    achievements = _get_li_achievements(twin)
    achievements.append(achievement.model_dump())
    _save_li_achievements(twin, achievements, db)

    # Extract skills into main skills list
    _update_twin(current_user.id, db, skills=achievement.skills_gained, certifications=[achievement.title], event="certificate")

    return AchievementAnalyzeResponse(achievement=achievement, twin_updated=True)


# ── 3d. LinkedIn Digital Twin — Manual Achievement ────────────────────────────

@router.post("/linkedin/achievement", response_model=AchievementAnalyzeResponse)
def add_manual_achievement(
    payload: ManualAchievementRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    text = f"{payload.title}\n\n{payload.description}"
    data = _analyze_achievement_text(text, payload.achievement_type)
    if not data:
        raise HTTPException(500, "Analysis failed.")

    achievement = AchievementItem(
        id=str(uuid.uuid4()),
        title=data.get("title", payload.title),
        achievement_type=payload.achievement_type,
        raw_text=text[:2000],
        skills_gained=data.get("skills_gained", []),
        technologies=data.get("technologies", []),
        difficulty_level=data.get("difficulty_level", "Intermediate"),
        career_value=data.get("career_value", ""),
        industry_relevance=data.get("industry_relevance", ""),
        impact_score=int(data.get("impact_score", 60)),
        career_value_score=int(data.get("career_value_score", 60)),
        recruiter_appeal_score=int(data.get("recruiter_appeal_score", 60)),
        why_it_matters=data.get("why_it_matters", ""),
        how_it_improves=data.get("how_it_improves", ""),
        career_paths_supported=data.get("career_paths_supported", []),
        uploaded_at=datetime.utcnow().isoformat(),
    )

    twin = _get_or_create_twin(current_user.id, db)
    achievements = _get_li_achievements(twin)
    achievements.append(achievement.model_dump())
    _save_li_achievements(twin, achievements, db)
    _update_twin(current_user.id, db, skills=achievement.skills_gained, event="achievement")

    return AchievementAnalyzeResponse(achievement=achievement, twin_updated=True)


# ── 3e. LinkedIn Digital Twin — Full Twin State ───────────────────────────────

@router.get("/linkedin/twin", response_model=LinkedInTwinFullResponse)
def get_linkedin_twin(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    twin = _get_or_create_twin(current_user.id, db)
    achievements = _get_li_achievements(twin)

    stored = json.loads(twin.linkedin_profile_json or "{}")
    if stored:
        analysis = stored.get("analysis", {})
        recs     = stored.get("recs", {})
        now_str  = stored.get("analyzed_at", datetime.utcnow().isoformat())
        return _build_linkedin_twin_response(analysis, recs, achievements, now_str)

    # No profile analyzed yet — return empty state with achievements only
    achiev_models = [AchievementItem(**a) for a in achievements if _valid_achievement(a)]
    return LinkedInTwinFullResponse(
        profile_strength=0, recruiter_visibility=0, personal_branding=0,
        industry_relevance_score=0, network_readiness=0, overall_score=0,
        sections=[], suggested_headline="", suggested_about="",
        improvements=[], checklist=[], checklist_completion=0,
        suitable_roles=[], internship_opportunities=[],
        missing_skills=[], missing_certifications=[],
        important_projects=[], learning_priorities=[],
        achievements=achiev_models, achievements_count=len(achiev_models),
        predictions={}, last_analyzed=None,
        twin_insight="Upload your LinkedIn profile or paste its content to activate your LinkedIn Digital Twin.",
        twin_updated=False,
    )


# ── 3f. LinkedIn Digital Twin — Delete Achievement ───────────────────────────

@router.delete("/linkedin/achievement/{achievement_id}")
def delete_achievement(
    achievement_id: str,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    twin = _get_or_create_twin(current_user.id, db)
    achievements = _get_li_achievements(twin)
    updated = [a for a in achievements if a.get("id") != achievement_id]
    if len(updated) == len(achievements):
        raise HTTPException(404, "Achievement not found.")
    _save_li_achievements(twin, updated, db)
    return {"deleted": True, "remaining": len(updated)}


# ── 4. Mock Interview ──────────────────────────────────────────────────────

@router.post("/interview/chat", response_model=InterviewChatResponse)
def interview_chat(
    payload: InterviewChatRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    client = _get_client()
    total_q = 8
    user_messages = [m for m in payload.history if m.role == "user"]
    q_num = len(user_messages) + 1

    if payload.mode == "evaluate" or q_num > total_q:
        convo = "\n".join(f"{m.role.upper()}: {m.content}" for m in payload.history)
        eval_prompt = f"""You are an expert technical interviewer evaluating a mock interview for a {payload.role} position.

INTERVIEW TRANSCRIPT:
{convo[:3500]}

Score the candidate (0-100) on each dimension and provide detailed feedback.
Respond ONLY with valid JSON:
{{
  "interview_score": <0-100>,
  "communication_score": <0-100>,
  "confidence_score": <0-100>,
  "technical_score": <0-100>,
  "problem_solving_score": <0-100>,
  "feedback": "<3-4 sentence overall assessment>",
  "strengths": ["s1", "s2", "s3"],
  "improvements": ["i1", "i2", "i3"],
  "weak_areas": ["wa1", "wa2"],
  "improvement_plan": ["step1", "step2", "step3"]
}}"""
        data = _groq_json(eval_prompt, max_tokens=800) or {}
        iv_score = float(data.get("interview_score", 65))
        _update_twin(current_user.id, db, interview_score=iv_score, event="interview")

        return InterviewChatResponse(
            message=f"Interview complete!\n\n{data.get('feedback', 'Great effort on your mock interview!')}",
            is_complete=True,
            scores={
                "interview":        int(data.get("interview_score", 65)),
                "communication":    int(data.get("communication_score", 70)),
                "confidence":       int(data.get("confidence_score", 65)),
                "technical":        int(data.get("technical_score", 60)),
                "problem_solving":  int(data.get("problem_solving_score", 60)),
            },
            feedback=data.get("feedback", ""),
            strengths=data.get("strengths", []),
            improvements=data.get("improvements", []),
            twin_updated=True,
        )

    history_msgs = [{"role": m.role, "content": m.content} for m in payload.history]
    sys_prompt = (
        f"You are a professional interviewer conducting a mock interview for a {payload.role} position. "
        f"Ask {total_q} questions mixing technical, behavioral, HR, and situation-based questions. "
        f"This is question {q_num} of {total_q}. Ask ONE clear question. No numbering. No feedback."
    )
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": sys_prompt}] + history_msgs,
        temperature=0.6,
        max_tokens=200,
    )
    return InterviewChatResponse(
        message=resp.choices[0].message.content.strip(),
        question_number=q_num,
        total_questions=total_q,
        is_complete=False,
    )


# ── 5. Coding ──────────────────────────────────────────────────────────────

@router.post("/coding/challenge", response_model=CodingChallengeResponse)
def get_coding_challenge(
    payload: CodingChallengeRequest,
    current_user: User = Depends(get_current_user),
):
    prompt = f"""Generate a {payload.difficulty} difficulty coding problem on {payload.topic}.
Make it realistic and interview-worthy.

Respond ONLY with valid JSON:
{{
  "title": "<problem title>",
  "problem": "<full problem statement>",
  "examples": [
    {{"input": "...", "output": "...", "explanation": "..."}},
    {{"input": "...", "output": "...", "explanation": "..."}}
  ],
  "hints": ["hint1", "hint2", "hint3"],
  "constraints": ["constraint1", "constraint2", "constraint3"],
  "expected_approach": "<brief description of optimal approach>"
}}"""
    data = _groq_json(prompt, max_tokens=1000)
    if not data or not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Failed to generate challenge.")
    examples = [CodingExample(**e) for e in data.get("examples", []) if isinstance(e, dict)]
    return CodingChallengeResponse(
        title=data.get("title", "Coding Challenge"),
        problem=data.get("problem", ""),
        examples=examples,
        hints=data.get("hints", []),
        difficulty=payload.difficulty,
        topic=payload.topic,
        constraints=data.get("constraints", []),
        expected_approach=data.get("expected_approach", ""),
    )


@router.post("/coding/evaluate", response_model=CodingEvalResponse)
def evaluate_coding(
    payload: CodingEvalRequest,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    prompt = f"""Evaluate this {payload.language} solution for the coding problem.

PROBLEM: {payload.problem[:800]}

SOLUTION:
{payload.solution[:2000]}

Respond ONLY with valid JSON:
{{
  "score": <0-100>,
  "is_correct": <true|false>,
  "feedback": "<2-3 sentence assessment>",
  "time_complexity": "<Big-O>",
  "space_complexity": "<Big-O>",
  "approach_quality": "<Optimal|Good|Acceptable|Needs Work>",
  "improvements": ["imp1", "imp2", "imp3"]
}}"""
    data = _groq_json(prompt, max_tokens=600) or {}
    coding_score = float(data.get("score", 60))
    _update_twin(current_user.id, db, coding_score=coding_score, event="coding")
    return CodingEvalResponse(
        score=int(data.get("score", 60)),
        is_correct=bool(data.get("is_correct", False)),
        feedback=data.get("feedback", ""),
        time_complexity=data.get("time_complexity", "Unknown"),
        space_complexity=data.get("space_complexity", "Unknown"),
        approach_quality=data.get("approach_quality", "Needs Work"),
        improvements=data.get("improvements", []),
        twin_updated=True,
    )


# ── 6. Skill Gap ──────────────────────────────────────────────────────────

@router.get("/skill-gap", response_model=SkillGapResponse)
def get_skill_gap(
    target: str = Query("AI Engineer"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    twin    = db.query(CareerTwin).filter_by(user_id=current_user.id).first()

    user_subjects: set[str] = set()
    if profile and profile.subjects:
        for s in profile.subjects.split(","):
            if s.strip(): user_subjects.add(s.strip())
    for r in records: user_subjects.add(r.subject)
    if twin and twin.skills_json:
        for s in json.loads(twin.skills_json): user_subjects.add(s)

    context = " ".join(user_subjects).lower()
    if profile: context += f" {profile.course} {profile.academic_goals}".lower()

    required = CAREER_REQUIRED_SKILLS.get(target, [])
    missing  = [r for r in required if r.lower() not in context]
    current_skills = [r for r in required if r.lower() in context]

    miss_certs   = CAREER_CERTIFICATIONS.get(target, [])[:4]
    miss_projects= CAREER_PROJECTS.get(target, [])[:4]

    compat = round(len(current_skills) / len(required) * 100) if required else 0
    priority = (
        "Critical — start immediately with foundational skills" if compat < 30 else
        "High — focus on core missing skills" if compat < 60 else
        "Medium — refine and add advanced skills" if compat < 80 else
        "Low — polish and specialize"
    )

    prompt = f"""Create a 5-step learning roadmap for a student targeting a {target} role.
Current skills: {', '.join(list(user_subjects)[:8]) if user_subjects else 'None yet'}
Missing skills: {', '.join(missing)}

Respond ONLY with valid JSON array (5 steps):
[{{"step":1,"title":"...","description":"...","resources":["r1","r2"],"duration":"..."}},...]"""
    plan_data = _groq_json(prompt, max_tokens=900)
    plan = [LearningStep(**s) for s in plan_data if isinstance(s, dict)] if isinstance(plan_data, list) else [
        LearningStep(step=1, title="Build Foundation", description=f"Learn {missing[0] if missing else 'core concepts'}.", resources=["Coursera", "YouTube"], duration="3 weeks")
    ]

    return SkillGapResponse(
        target_career=target,
        current_skills=list(user_subjects) or ["No data yet — add subjects in your profile"],
        missing_skills=missing,
        missing_certifications=miss_certs,
        missing_projects=miss_projects,
        learning_plan=plan,
        compatibility_score=compat,
        learning_priority=priority,
    )


# ── 7. Career Recommendations (domain-aware) ──────────────────────────────

@router.get("/recommendations", response_model=CareerRecommendationsResponse)
def get_career_recommendations(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()
    twin    = db.query(CareerTwin).filter_by(user_id=current_user.id).first()

    # Gather all learner context
    user_subjects: set[str] = set()
    if profile and profile.subjects:
        for s in profile.subjects.split(","):
            if s.strip(): user_subjects.add(s.strip())
    for r in records:
        user_subjects.add(r.subject)

    resume_skills: list[str] = []
    certifications: list[str] = []
    if twin:
        if twin.skills_json:
            resume_skills = json.loads(twin.skills_json or "[]")
        if twin.certifications_json:
            certifications = json.loads(twin.certifications_json or "[]")

    course    = (profile.course if profile else "") or ""
    goals     = (profile.academic_goals if profile else "") or ""
    context   = " ".join(user_subjects).lower() + " " + course.lower() + " " + goals.lower()
    avg_score = _safe_avg([r.score for r in records]) if records else 50.0
    avg_study = _safe_avg([e.study_hours for e in entries]) if entries else 0.0

    # Detect the learner's domain and get relevant careers
    domain    = _detect_domain(profile, user_subjects)
    candidates = _get_domain_careers(domain, context)

    # Score every candidate role using the 5-factor formula
    recs: list[CareerRecommendation] = []
    for role in candidates:
        if role not in CAREER_REQUIRED_SKILLS:
            continue
        score, matched, missing, reasoning = _compute_career_score(
            role, context, course, goals,
            resume_skills, certifications, avg_score, avg_study,
        )
        recs.append(CareerRecommendation(
            role=role,
            compatibility=score,
            reasoning=reasoning,
            required_skills=CAREER_REQUIRED_SKILLS.get(role, [])[:5],
            key_matches=matched,
        ))

    recs.sort(key=lambda r: r.compatibility, reverse=True)
    top = recs[0].role if recs else (candidates[0] if candidates else "Research Scientist")

    # Domain-aware Twin Insight via LLM
    domain_label = domain.replace("_", " ").title()
    subjects_str = ", ".join(list(user_subjects)[:6]) or "various subjects"
    insight_prompt = (
        f"Learner domain: {domain_label}. "
        f"Degree/Course: {course or 'Not specified'}. "
        f"Subjects/Skills: {subjects_str}. "
        f"Academic score: {avg_score:.0f}%. "
        f"Top career match: {top}. "
        "Write ONE compelling, domain-specific sentence (max 35 words) from Digital Twin perspective "
        "predicting this learner's career trajectory. Be specific to their field, not generic tech."
    )
    try:
        client = _get_client()
        resp = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": insight_prompt}],
            temperature=0.5, max_tokens=90,
        )
        twin_insight = resp.choices[0].message.content.strip().strip('"')
    except Exception:
        twin_insight = (
            f"Your {course or domain_label} background and {subjects_str[:40]} "
            f"strongly align with a future in {top}."
        )

    return CareerRecommendationsResponse(
        recommendations=recs[:6],
        top_match=top,
        twin_insight=twin_insight,
    )


# ── 8. Job Matching (domain-aware) ───────────────────────────────────────

@router.get("/job-matching", response_model=JobMatchResponse)
def get_job_matching(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()
    twin    = db.query(CareerTwin).filter_by(user_id=current_user.id).first()

    user_subjects: set[str] = set()
    if profile and profile.subjects:
        for s in profile.subjects.split(","):
            if s.strip(): user_subjects.add(s.strip())
    for r in records:
        user_subjects.add(r.subject)

    resume_skills: list[str] = []
    certifications: list[str] = []
    if twin:
        resume_skills  = json.loads(twin.skills_json or "[]")
        certifications = json.loads(twin.certifications_json or "[]")

    course    = (profile.course if profile else "") or ""
    goals     = (profile.academic_goals if profile else "") or ""
    context   = " ".join(user_subjects).lower() + " " + course.lower() + " " + goals.lower()
    avg_score = _safe_avg([r.score for r in records]) if records else 50.0
    avg_study = _safe_avg([e.study_hours for e in entries]) if entries else 0.0

    resume_r    = int(twin.resume_score    if twin else 0)
    interview_r = int(twin.interview_score if twin else 0)

    # Use domain-aware career list
    domain     = _detect_domain(profile, user_subjects)
    candidates = _get_domain_careers(domain, context)

    matches: list[JobMatchEntry] = []
    for role in candidates:
        if role not in CAREER_REQUIRED_SKILLS:
            continue
        score, matched, missing, reasoning = _compute_career_score(
            role, context, course, goals,
            resume_skills, certifications, avg_score, avg_study,
        )
        gap_pct    = max(1, 100 - score)
        res_ready  = min(99, resume_r + 5)
        int_ready  = min(99, interview_r + 5)
        matches.append(JobMatchEntry(
            role=role,
            match_percent=score,
            skill_gap_percent=gap_pct,
            resume_readiness=res_ready,
            interview_readiness=int_ready,
            reasoning=reasoning,
            key_skills_matched=matched[:4],
            missing_skills=missing[:3],
            recommended_certifications=CAREER_CERTIFICATIONS.get(role, [])[:2],
            portfolio_projects=CAREER_PROJECTS.get(role, [])[:2],
        ))

    matches.sort(key=lambda m: m.match_percent, reverse=True)
    top = matches[0].role if matches else (candidates[0] if candidates else "Research Scientist")
    return JobMatchResponse(matches=matches, top_role=top)


# ── 9. Career Roadmap ─────────────────────────────────────────────────────

@router.get("/roadmap", response_model=RoadmapResponse)
def get_career_roadmap(
    target: str = Query("AI Engineer"),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()

    current_pos = profile.course if profile else "Student"
    user_subjects = list({r.subject for r in records})
    avg_score     = _safe_avg([r.score for r in records]) if records else 50.0

    prompt = f"""Create a personalized career roadmap for a student targeting a {target} role.
Current position: {current_pos}
Known subjects/skills: {', '.join(user_subjects[:6]) if user_subjects else 'General studies'}
Current performance: {avg_score:.0f}%

Generate a 6-step roadmap with monthly milestones. Respond ONLY with valid JSON:
{{
  "estimated_time": "<e.g. '9-12 months'>",
  "steps": [
    {{"step":1,"title":"...","description":"...","duration":"...","resources":["r1","r2"],"skills":["s1","s2"],"status":"current"}},
    ...6 steps total...
  ],
  "monthly_milestones": [
    {{"month":1,"goal":"...","deliverable":"..."}},
    {{"month":3,"goal":"...","deliverable":"..."}},
    {{"month":6,"goal":"...","deliverable":"..."}},
    {{"month":12,"goal":"...","deliverable":"..."}}
  ]
}}"""
    data = _groq_json(prompt, max_tokens=1400)

    if isinstance(data, dict) and "steps" in data:
        steps = [RoadmapStep(**s) for s in data["steps"] if isinstance(s, dict)]
        estimated = data.get("estimated_time", "9-12 months")
        milestones = data.get("monthly_milestones", [])
    else:
        steps = [
            RoadmapStep(step=1, title="Build Foundations", description="Master core fundamentals.", duration="1 month", resources=["Coursera"], skills=["Python"], status="current"),
            RoadmapStep(step=2, title="Learn Key Tools",   description="Study essential tools.",   duration="2 months", resources=["YouTube"], skills=["Libraries"], status="pending"),
            RoadmapStep(step=3, title="Build Projects",    description="Create portfolio work.",   duration="2 months", resources=["GitHub"],  skills=["Projects"],  status="pending"),
            RoadmapStep(step=4, title="Interview Prep",    description="Practice mock interviews.",duration="1 month", resources=["LeetCode"],skills=["DSA"],      status="pending"),
        ]
        estimated  = "6-8 months"
        milestones = []

    prob = min(0.95, max(0.3, avg_score / 100 + 0.05))
    return RoadmapResponse(
        current_position=current_pos, target_career=target,
        steps=steps, estimated_time=estimated,
        twin_success_probability=round(prob, 2),
        monthly_milestones=milestones,
    )


# ── 10. Career Twin ────────────────────────────────────────────────────────

@router.get("/twin", response_model=CareerTwinResponse)
def get_career_twin(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    twin    = _get_or_create_twin(current_user.id, db)
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()
    entries = db.query(LearningData).filter_by(user_id=current_user.id).all()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()

    # Career Twin Score = weighted avg of all components
    r = twin.resume_score; li = twin.linkedin_score
    iv = twin.interview_score; co = twin.coding_score
    ct_score = int(round(r * 0.30 + li * 0.20 + iv * 0.25 + co * 0.25))

    # Employability blends Career Twin + academic performance
    avg_acad = _safe_avg([rec.score for rec in records]) if records else 50.0
    employability = int(round(ct_score * 0.60 + avg_acad * 0.40))

    # Industry and interview readiness
    industry_r  = int(round((avg_acad * 0.5 + co * 0.5)))
    interview_r = int(round(iv if iv > 0 else avg_acad * 0.7))

    # Predictions — simple linear extrapolation + 10-20% monthly gain
    history = json.loads(twin.score_history_json or "[]")
    if len(history) >= 2:
        emp_vals = [h["employability"] for h in history[-5:] if "employability" in h]
        slope = (emp_vals[-1] - emp_vals[0]) / max(len(emp_vals) - 1, 1) if len(emp_vals) > 1 else 2
    else:
        slope = max(2, (100 - employability) * 0.05)  # conservative 5% headroom

    def _predict(months: int) -> CareerTwinPrediction:
        gain = slope * months * 1.5
        return CareerTwinPrediction(
            months=months,
            career_twin_score    =min(99, ct_score      + int(gain)),
            employability_score  =min(99, employability + int(gain)),
            interview_readiness  =min(99, interview_r   + int(gain * 0.8)),
            industry_readiness   =min(99, industry_r    + int(gain * 0.6)),
        )

    # AI insight
    subjects = [r.subject for r in records]
    top_role = _best_role(subjects, profile)
    try:
        client = _get_client()
        resp   = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": (
                f"Digital Twin career scores: Resume={r:.0f}, LinkedIn={li:.0f}, "
                f"Interview={iv:.0f}, Coding={co:.0f}. Target role: {top_role}. "
                "Write one specific, motivating prediction sentence (max 35 words) about career readiness."
            )}],
            temperature=0.5, max_tokens=80,
        )
        insight = resp.choices[0].message.content.strip().strip('"')
    except Exception:
        insight = f"Your Career Twin is evolving — consistent effort will unlock {top_role} opportunities."

    label = (
        "Highly Employable" if ct_score >= 80 else
        "Interview Ready"   if ct_score >= 65 else
        "Building Profile"  if ct_score >= 40 else
        "Early Stage"
    )

    return CareerTwinResponse(
        career_twin_score=ct_score,
        employability_score=employability,
        interview_readiness=interview_r,
        industry_readiness=industry_r,
        resume_score=int(r), linkedin_score=int(li),
        interview_score=int(iv), coding_score=int(co),
        skills=json.loads(twin.skills_json or "[]"),
        certifications=json.loads(twin.certifications_json or "[]"),
        last_updated=twin.updated_at.isoformat() if twin.updated_at else None,
        predictions={"3m": _predict(3), "6m": _predict(6), "12m": _predict(12)},
        score_history=history[-30:],
        twin_insight=insight,
        current_state_label=label,
    )


# ── 11. Analytics ──────────────────────────────────────────────────────────

@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    twin    = db.query(CareerTwin).filter_by(user_id=current_user.id).first()
    records = db.query(SubjectRecord).filter_by(user_id=current_user.id).all()
    profile = db.query(StudentProfile).filter_by(user_id=current_user.id).first()

    history = json.loads(twin.score_history_json or "[]") if twin else []

    # Career twin trend
    twin_trend = [
        {"date": h["date"], "Career Twin": int(h.get("employability", 0))}
        for h in history
    ]

    # Score breakdown trend (multi-line)
    breakdown_trend = [
        {
            "date":      h["date"],
            "Resume":    int(h.get("resume",    0)),
            "LinkedIn":  int(h.get("linkedin",  0)),
            "Interview": int(h.get("interview", 0)),
            "Coding":    int(h.get("coding",    0)),
        }
        for h in history
    ]

    # Radar: current skills vs required for top role
    subjects = {r.subject.lower() for r in records}
    if profile and profile.subjects:
        subjects.update(s.strip().lower() for s in profile.subjects.split(","))
    context = " ".join(subjects)
    top_role = _best_role(list(subjects), profile)
    required = CAREER_SKILLS.get(top_role, [])
    radar = [
        {"skill": kw.title(), "current": 100 if kw in context else 20, "target": 100}
        for kw in required[:8]
    ]

    # Insights
    improvements = []
    if twin:
        scores = {"Resume": twin.resume_score, "LinkedIn": twin.linkedin_score,
                  "Interview": twin.interview_score, "Coding": twin.coding_score}
        least = min(scores, key=lambda k: scores[k])
        improvements.append(least)

    total = len(history)
    consistency = round(min(total / 10, 1.0) * 100, 1)

    return AnalyticsResponse(
        career_twin_trend=twin_trend,
        score_breakdown_trend=breakdown_trend,
        skill_radar=radar,
        total_analyses=total,
        top_improvement=improvements[0] if improvements else "Keep analyzing",
        consistency_score=consistency,
    )
