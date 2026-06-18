import math
import random
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.models.user import User
from app.models.skill_tree import NodeProgress, XPTransaction, SkillTreeAchievement
from app.api.routes.auth import get_current_user

router = APIRouter(prefix="/skill-tree", tags=["skill-tree"])

# ── Career Tree Definitions ────────────────────────────────────────────────────

CAREER_TREES: dict[str, dict[str, Any]] = {
    "software_engineering": {
        "root": {"id": "se_root", "name": "Software Engineering", "icon": "💻"},
        "branches": [
            {"id": "se_prog", "name": "Programming", "icon": "🐍", "children": [
                {"id": "se_py", "name": "Python", "icon": "🐍", "desc": "Python fundamentals & advanced patterns"},
                {"id": "se_java", "name": "Java", "icon": "☕", "desc": "Object-oriented Java programming"},
                {"id": "se_cpp", "name": "C / C++", "icon": "⚡", "desc": "Systems & performance programming"},
            ]},
            {"id": "se_dsa", "name": "Data Structures", "icon": "🌳", "children": [
                {"id": "se_arrays", "name": "Arrays", "icon": "📊", "desc": "Arrays, strings & sliding window"},
                {"id": "se_trees_n", "name": "Trees", "icon": "🌲", "desc": "Binary trees, BST & traversal"},
                {"id": "se_graphs", "name": "Graphs", "icon": "🕸️", "desc": "BFS, DFS, shortest paths"},
                {"id": "se_dp", "name": "Dynamic Prog.", "icon": "🧩", "desc": "Memoization & tabulation"},
            ]},
            {"id": "se_web", "name": "Web Dev", "icon": "🌐", "children": [
                {"id": "se_html", "name": "HTML / CSS", "icon": "🎨", "desc": "Web structure & styling"},
                {"id": "se_js", "name": "JavaScript", "icon": "🟡", "desc": "DOM, async, ES6+"},
                {"id": "se_react", "name": "React", "icon": "⚛️", "desc": "Component-based UI & state"},
                {"id": "se_backend", "name": "Backend APIs", "icon": "🔧", "desc": "REST APIs & databases"},
            ]},
            {"id": "se_ai", "name": "AI Engineering", "icon": "🤖", "children": [
                {"id": "se_ml", "name": "Machine Learning", "icon": "📈", "desc": "ML algorithms & feature engineering"},
                {"id": "se_nn", "name": "Neural Networks", "icon": "🧠", "desc": "Deep learning & backpropagation"},
                {"id": "se_cv_ai", "name": "Computer Vision", "icon": "👁️", "desc": "Image recognition & processing"},
            ]},
            {"id": "se_sys", "name": "System Design", "icon": "🏗️", "children": [
                {"id": "se_arch", "name": "Architecture", "icon": "📐", "desc": "Design patterns & microservices"},
                {"id": "se_db", "name": "Databases", "icon": "💾", "desc": "SQL, NoSQL & data modeling"},
                {"id": "se_cloud", "name": "Cloud & DevOps", "icon": "☁️", "desc": "AWS, Docker, CI/CD pipelines"},
            ]},
        ],
        "achievements": [
            {"id": "se_first_commit", "name": "First Commit", "icon": "🌱", "color": "#52FFB8", "xp_bonus": 50, "desc": "Unlock your first skill node", "type": "first"},
            {"id": "se_code_warrior", "name": "Code Warrior", "icon": "⚔️", "color": "#39c98a", "xp_bonus": 200, "desc": "Master all Programming nodes", "type": "branch", "branch": "se_prog"},
            {"id": "se_algorithm_king", "name": "Algorithm King", "icon": "♛", "color": "#a3ffdc", "xp_bonus": 300, "desc": "Master all Data Structure nodes", "type": "branch", "branch": "se_dsa"},
            {"id": "se_fullstack", "name": "Full-Stack Dev", "icon": "🚀", "color": "#52FFB8", "xp_bonus": 250, "desc": "Master all Web Dev nodes", "type": "branch", "branch": "se_web"},
            {"id": "se_ai_pioneer", "name": "AI Pioneer", "icon": "🤖", "color": "#6bffc7", "xp_bonus": 400, "desc": "Master all AI Engineering nodes", "type": "branch", "branch": "se_ai"},
            {"id": "se_master", "name": "SE Master", "icon": "🌟", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 10+ skill nodes", "type": "count", "count": 10},
        ],
        "pillars": ["Programming", "Data Structures", "Web Dev", "AI Engineering", "System Design"],
        "readiness_weights": {"se_prog": 0.2, "se_dsa": 0.2, "se_web": 0.2, "se_ai": 0.2, "se_sys": 0.2},
    },

    "mbbs": {
        "root": {"id": "mbbs_root", "name": "MBBS", "icon": "🏥"},
        "branches": [
            {"id": "mbbs_anat", "name": "Anatomy", "icon": "🦴", "children": [
                {"id": "mbbs_neuro", "name": "Nervous System", "icon": "🧠", "desc": "CNS, PNS & autonomic nervous system"},
                {"id": "mbbs_musc", "name": "Muscular System", "icon": "💪", "desc": "Muscle types, groups & function"},
                {"id": "mbbs_cardio_a", "name": "Cardiovascular", "icon": "❤️", "desc": "Heart chambers & blood vessel anatomy"},
            ]},
            {"id": "mbbs_phys", "name": "Physiology", "icon": "🔬", "children": [
                {"id": "mbbs_dig", "name": "Digestion", "icon": "🍎", "desc": "GI tract function & digestive enzymes"},
                {"id": "mbbs_resp", "name": "Respiration", "icon": "🫁", "desc": "Respiratory mechanics & gas exchange"},
                {"id": "mbbs_circ", "name": "Circulation", "icon": "🩸", "desc": "Cardiac cycle & hemodynamics"},
            ]},
            {"id": "mbbs_pharma", "name": "Pharmacology", "icon": "💊", "children": [
                {"id": "mbbs_drug", "name": "Drug Classes", "icon": "📋", "desc": "Drug classification & mechanisms of action"},
                {"id": "mbbs_abx", "name": "Antibiotics", "icon": "🦠", "desc": "Antibiotic spectrum & resistance"},
                {"id": "mbbs_side", "name": "Side Effects", "icon": "⚠️", "desc": "Adverse drug reactions & monitoring"},
            ]},
            {"id": "mbbs_path", "name": "Pathology", "icon": "🔭", "children": [
                {"id": "mbbs_histo", "name": "Histology", "icon": "🔬", "desc": "Tissue types & cellular pathology"},
                {"id": "mbbs_micro", "name": "Microbiology", "icon": "🦠", "desc": "Bacteria, viruses, fungi & parasites"},
                {"id": "mbbs_lab", "name": "Lab Diagnostics", "icon": "🧪", "desc": "CBC, LFT, RFT & ECG interpretation"},
            ]},
            {"id": "mbbs_clinical", "name": "Clinical Skills", "icon": "🩺", "children": [
                {"id": "mbbs_diag", "name": "Diagnosis", "icon": "🔍", "desc": "Clinical diagnosis & differential diagnosis"},
                {"id": "mbbs_surg", "name": "Surgery Basics", "icon": "🔪", "desc": "Surgical principles & procedures"},
                {"id": "mbbs_cases", "name": "Case Studies", "icon": "📚", "desc": "Clinical case analysis & management"},
            ]},
        ],
        "achievements": [
            {"id": "mbbs_first_patient", "name": "First Patient", "icon": "🌱", "color": "#52FFB8", "xp_bonus": 50, "desc": "Begin your medical journey", "type": "first"},
            {"id": "mbbs_anatomist", "name": "The Anatomist", "icon": "🦴", "color": "#a3ffdc", "xp_bonus": 250, "desc": "Master all Anatomy nodes", "type": "branch", "branch": "mbbs_anat"},
            {"id": "mbbs_pharmacist", "name": "Drug Expert", "icon": "💊", "color": "#39c98a", "xp_bonus": 300, "desc": "Master all Pharmacology nodes", "type": "branch", "branch": "mbbs_pharma"},
            {"id": "mbbs_clinician", "name": "Clinician", "icon": "🩺", "color": "#6bffc7", "xp_bonus": 400, "desc": "Master all Clinical Skills", "type": "branch", "branch": "mbbs_clinical"},
            {"id": "mbbs_doctor", "name": "Future Doctor", "icon": "🏥", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 12+ skill nodes", "type": "count", "count": 12},
        ],
        "pillars": ["Anatomy", "Physiology", "Pharmacology", "Pathology", "Clinical Skills"],
        "readiness_weights": {"mbbs_anat": 0.2, "mbbs_phys": 0.2, "mbbs_pharma": 0.2, "mbbs_path": 0.2, "mbbs_clinical": 0.2},
    },

    "law": {
        "root": {"id": "law_root", "name": "Law", "icon": "⚖️"},
        "branches": [
            {"id": "law_const", "name": "Constitutional", "icon": "📜", "children": [
                {"id": "law_fr", "name": "Fundamental Rights", "icon": "🏛️", "desc": "Rights, freedoms & constitutional limits"},
                {"id": "law_dp", "name": "Directive Principles", "icon": "📋", "desc": "State policy directives & governance"},
                {"id": "law_jud", "name": "Judiciary", "icon": "⚖️", "desc": "Court hierarchy, writ jurisdiction"},
            ]},
            {"id": "law_crim", "name": "Criminal Law", "icon": "🔐", "children": [
                {"id": "law_ipc", "name": "Penal Code", "icon": "📖", "desc": "Criminal offenses, punishment & defences"},
                {"id": "law_crpc", "name": "Criminal Procedure", "icon": "📝", "desc": "FIR, trial & investigation process"},
                {"id": "law_evid", "name": "Evidence", "icon": "🔍", "desc": "Admissibility & burden of proof"},
            ]},
            {"id": "law_civil", "name": "Civil Law", "icon": "📄", "children": [
                {"id": "law_contract", "name": "Contract Law", "icon": "🤝", "desc": "Formation, breach & remedies"},
                {"id": "law_tort", "name": "Law of Torts", "icon": "⚠️", "desc": "Negligence, nuisance & strict liability"},
                {"id": "law_prop", "name": "Property Law", "icon": "🏠", "desc": "Ownership, transfer & tenancy"},
            ]},
            {"id": "law_corp", "name": "Corporate Law", "icon": "🏢", "children": [
                {"id": "law_comp", "name": "Company Law", "icon": "📈", "desc": "Corporate structure & governance"},
                {"id": "law_ip", "name": "IP Law", "icon": "💡", "desc": "Patents, trademarks & copyright"},
                {"id": "law_tax", "name": "Tax Law", "icon": "💰", "desc": "Direct & indirect taxation"},
            ]},
            {"id": "law_skills", "name": "Legal Practice", "icon": "🎯", "children": [
                {"id": "law_draft", "name": "Legal Drafting", "icon": "✍️", "desc": "Contracts, plaints & petitions"},
                {"id": "law_arg", "name": "Argumentation", "icon": "🗣️", "desc": "Oral arguments & mooting techniques"},
                {"id": "law_research", "name": "Legal Research", "icon": "📚", "desc": "Case law & statute analysis"},
            ]},
        ],
        "achievements": [
            {"id": "law_first_brief", "name": "First Brief", "icon": "📄", "color": "#52FFB8", "xp_bonus": 50, "desc": "Begin your legal education", "type": "first"},
            {"id": "law_constitutionalist", "name": "Constitutionalist", "icon": "📜", "color": "#a3ffdc", "xp_bonus": 250, "desc": "Master Constitutional Law", "type": "branch", "branch": "law_const"},
            {"id": "law_prosecutor", "name": "Prosecutor", "icon": "🔐", "color": "#39c98a", "xp_bonus": 300, "desc": "Master Criminal Law", "type": "branch", "branch": "law_crim"},
            {"id": "law_counselor", "name": "Senior Counsel", "icon": "⚖️", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 12+ legal skills", "type": "count", "count": 12},
        ],
        "pillars": ["Constitutional", "Criminal", "Civil", "Corporate", "Legal Practice"],
        "readiness_weights": {"law_const": 0.2, "law_crim": 0.2, "law_civil": 0.2, "law_corp": 0.2, "law_skills": 0.2},
    },

    "mba": {
        "root": {"id": "mba_root", "name": "MBA", "icon": "📊"},
        "branches": [
            {"id": "mba_fin", "name": "Finance", "icon": "💰", "children": [
                {"id": "mba_acc", "name": "Accounting", "icon": "📒", "desc": "Financial statements & analysis"},
                {"id": "mba_corp_fin", "name": "Corporate Finance", "icon": "🏦", "desc": "Capital budgeting & valuation"},
                {"id": "mba_invest", "name": "Investment", "icon": "📈", "desc": "Portfolio management & markets"},
            ]},
            {"id": "mba_mkt", "name": "Marketing", "icon": "📣", "children": [
                {"id": "mba_brand", "name": "Branding", "icon": "🎯", "desc": "Brand strategy & positioning"},
                {"id": "mba_digital", "name": "Digital Marketing", "icon": "💻", "desc": "SEO, social media & content strategy"},
                {"id": "mba_consumer", "name": "Consumer Behavior", "icon": "🧠", "desc": "Buyer psychology & decision models"},
            ]},
            {"id": "mba_ops", "name": "Operations", "icon": "⚙️", "children": [
                {"id": "mba_supply", "name": "Supply Chain", "icon": "🔗", "desc": "Logistics, procurement & inventory"},
                {"id": "mba_quality", "name": "Quality Mgmt", "icon": "✅", "desc": "Six Sigma, TQM & ISO standards"},
                {"id": "mba_proj", "name": "Project Mgmt", "icon": "📅", "desc": "Agile, PMP & execution"},
            ]},
            {"id": "mba_strategy", "name": "Strategy", "icon": "♟️", "children": [
                {"id": "mba_biz", "name": "Business Strategy", "icon": "🗺️", "desc": "Porter's Five Forces & Blue Ocean"},
                {"id": "mba_innov", "name": "Innovation", "icon": "💡", "desc": "Design thinking & disruption"},
                {"id": "mba_global", "name": "Global Business", "icon": "🌍", "desc": "International trade & expansion"},
            ]},
            {"id": "mba_lead", "name": "Leadership", "icon": "👑", "children": [
                {"id": "mba_neg", "name": "Negotiation", "icon": "🤝", "desc": "Win-win negotiation tactics"},
                {"id": "mba_team", "name": "Team Dynamics", "icon": "👥", "desc": "Organizational behavior & culture"},
                {"id": "mba_ethics", "name": "Business Ethics", "icon": "⚖️", "desc": "Corporate governance & CSR"},
            ]},
        ],
        "achievements": [
            {"id": "mba_first_deal", "name": "First Deal", "icon": "🤝", "color": "#52FFB8", "xp_bonus": 50, "desc": "Start your MBA journey", "type": "first"},
            {"id": "mba_cfo_track", "name": "CFO Track", "icon": "💰", "color": "#a3ffdc", "xp_bonus": 300, "desc": "Master all Finance nodes", "type": "branch", "branch": "mba_fin"},
            {"id": "mba_cmo_track", "name": "CMO Track", "icon": "📣", "color": "#39c98a", "xp_bonus": 300, "desc": "Master all Marketing nodes", "type": "branch", "branch": "mba_mkt"},
            {"id": "mba_ceo", "name": "CEO Material", "icon": "👑", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 12+ business skills", "type": "count", "count": 12},
        ],
        "pillars": ["Finance", "Marketing", "Operations", "Strategy", "Leadership"],
        "readiness_weights": {"mba_fin": 0.2, "mba_mkt": 0.2, "mba_ops": 0.15, "mba_strategy": 0.25, "mba_lead": 0.2},
    },

    "data_science": {
        "root": {"id": "ds_root", "name": "Data Science", "icon": "📊"},
        "branches": [
            {"id": "ds_math", "name": "Mathematics", "icon": "📐", "children": [
                {"id": "ds_lin", "name": "Linear Algebra", "icon": "🔢", "desc": "Vectors, matrices & eigenvalues"},
                {"id": "ds_stat", "name": "Statistics", "icon": "📊", "desc": "Probability, distributions & inference"},
                {"id": "ds_calc", "name": "Calculus", "icon": "∫", "desc": "Gradients, optimization & chain rule"},
            ]},
            {"id": "ds_prog", "name": "Programming", "icon": "🐍", "children": [
                {"id": "ds_py", "name": "Python", "icon": "🐍", "desc": "NumPy, Pandas, Scikit-learn"},
                {"id": "ds_sql", "name": "SQL", "icon": "🗄️", "desc": "Queries, joins & window functions"},
                {"id": "ds_spark", "name": "Big Data", "icon": "💥", "desc": "Spark, Hadoop & distributed systems"},
            ]},
            {"id": "ds_ml", "name": "Machine Learning", "icon": "🤖", "children": [
                {"id": "ds_sup", "name": "Supervised", "icon": "📈", "desc": "Regression, SVM & tree models"},
                {"id": "ds_unsup", "name": "Unsupervised", "icon": "🔍", "desc": "Clustering & dimensionality reduction"},
                {"id": "ds_dl", "name": "Deep Learning", "icon": "🧠", "desc": "CNNs, RNNs & transformers"},
            ]},
            {"id": "ds_viz", "name": "Visualization", "icon": "📈", "children": [
                {"id": "ds_plot", "name": "Plotting", "icon": "📊", "desc": "Matplotlib, Seaborn & Plotly"},
                {"id": "ds_dash", "name": "Dashboards", "icon": "🖥️", "desc": "Tableau, Power BI & Streamlit"},
                {"id": "ds_story", "name": "Data Storytelling", "icon": "📖", "desc": "Insight communication & narrative"},
            ]},
            {"id": "ds_mlops", "name": "MLOps", "icon": "🚀", "children": [
                {"id": "ds_deploy", "name": "Deployment", "icon": "🌐", "desc": "FastAPI, Docker & model serving"},
                {"id": "ds_monitor", "name": "Monitoring", "icon": "📡", "desc": "Model drift & performance tracking"},
                {"id": "ds_pipeline", "name": "Data Pipelines", "icon": "🔧", "desc": "ETL, Airflow & workflow automation"},
            ]},
        ],
        "achievements": [
            {"id": "ds_first_model", "name": "First Model", "icon": "🌱", "color": "#52FFB8", "xp_bonus": 50, "desc": "Train your first ML model", "type": "first"},
            {"id": "ds_math_wizard", "name": "Math Wizard", "icon": "📐", "color": "#a3ffdc", "xp_bonus": 250, "desc": "Master all Mathematics nodes", "type": "branch", "branch": "ds_math"},
            {"id": "ds_ml_master", "name": "ML Master", "icon": "🤖", "color": "#39c98a", "xp_bonus": 400, "desc": "Master all ML nodes", "type": "branch", "branch": "ds_ml"},
            {"id": "ds_data_guru", "name": "Data Guru", "icon": "🔮", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 12+ data science skills", "type": "count", "count": 12},
        ],
        "pillars": ["Mathematics", "Programming", "Machine Learning", "Visualization", "MLOps"],
        "readiness_weights": {"ds_math": 0.2, "ds_prog": 0.2, "ds_ml": 0.25, "ds_viz": 0.15, "ds_mlops": 0.2},
    },

    "mechanical_engineering": {
        "root": {"id": "me_root", "name": "Mechanical Eng.", "icon": "⚙️"},
        "branches": [
            {"id": "me_math", "name": "Engineering Math", "icon": "📐", "children": [
                {"id": "me_calc", "name": "Calculus", "icon": "∫", "desc": "Differential & integral calculus"},
                {"id": "me_diffeq", "name": "Diff. Equations", "icon": "📊", "desc": "ODEs & PDEs for engineering"},
                {"id": "me_numerical", "name": "Numerical Methods", "icon": "🔢", "desc": "Root finding & numerical integration"},
            ]},
            {"id": "me_thermo", "name": "Thermodynamics", "icon": "🌡️", "children": [
                {"id": "me_heat", "name": "Heat Transfer", "icon": "🔥", "desc": "Conduction, convection & radiation"},
                {"id": "me_fluid", "name": "Fluid Mechanics", "icon": "💧", "desc": "Flow analysis & Bernoulli principle"},
                {"id": "me_cycles", "name": "Power Cycles", "icon": "⚡", "desc": "Carnot, Rankine & Brayton cycles"},
            ]},
            {"id": "me_mech", "name": "Mechanics", "icon": "🔩", "children": [
                {"id": "me_statics", "name": "Statics", "icon": "⚖️", "desc": "Force equilibrium & moments"},
                {"id": "me_dyn", "name": "Dynamics", "icon": "🏃", "desc": "Kinematics & kinetics of motion"},
                {"id": "me_strength", "name": "Strength of Mat.", "icon": "🏗️", "desc": "Stress, strain & beam analysis"},
            ]},
            {"id": "me_design", "name": "Design & CAD", "icon": "📐", "children": [
                {"id": "me_cad", "name": "CAD", "icon": "💻", "desc": "AutoCAD, SolidWorks & Fusion360"},
                {"id": "me_fea", "name": "FEA / FEM", "icon": "🧩", "desc": "Finite element analysis & ANSYS"},
                {"id": "me_mfg", "name": "Manufacturing", "icon": "🏭", "desc": "Machining, casting & CNC processes"},
            ]},
            {"id": "me_auto", "name": "Automation", "icon": "🤖", "children": [
                {"id": "me_ctrl", "name": "Control Systems", "icon": "🎛️", "desc": "PID, state-space & feedback control"},
                {"id": "me_robot", "name": "Robotics", "icon": "🦾", "desc": "Robotic kinematics & programming"},
                {"id": "me_plc", "name": "PLC / SCADA", "icon": "🖥️", "desc": "Industrial automation & ladder logic"},
            ]},
        ],
        "achievements": [
            {"id": "me_first_gear", "name": "First Gear", "icon": "⚙️", "color": "#52FFB8", "xp_bonus": 50, "desc": "Start your engineering journey", "type": "first"},
            {"id": "me_thermodynamist", "name": "Thermodynamist", "icon": "🌡️", "color": "#a3ffdc", "xp_bonus": 300, "desc": "Master all Thermodynamics nodes", "type": "branch", "branch": "me_thermo"},
            {"id": "me_engineer", "name": "Master Engineer", "icon": "🏆", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 12+ engineering skills", "type": "count", "count": 12},
        ],
        "pillars": ["Math", "Thermodynamics", "Mechanics", "Design", "Automation"],
        "readiness_weights": {"me_math": 0.15, "me_thermo": 0.2, "me_mech": 0.25, "me_design": 0.25, "me_auto": 0.15},
    },

    "commerce": {
        "root": {"id": "com_root", "name": "Commerce", "icon": "💼"},
        "branches": [
            {"id": "com_acc", "name": "Accounting", "icon": "📒", "children": [
                {"id": "com_book", "name": "Bookkeeping", "icon": "📖", "desc": "Journal entries, ledgers & trial balance"},
                {"id": "com_fin_acc", "name": "Financial Accounting", "icon": "📊", "desc": "P&L, balance sheet & cash flow statements"},
                {"id": "com_cost", "name": "Cost Accounting", "icon": "💹", "desc": "Cost analysis, variance & marginal costing"},
            ]},
            {"id": "com_eco", "name": "Economics", "icon": "📈", "children": [
                {"id": "com_micro", "name": "Microeconomics", "icon": "🔍", "desc": "Supply, demand & market structures"},
                {"id": "com_macro", "name": "Macroeconomics", "icon": "🌍", "desc": "GDP, inflation, monetary & fiscal policy"},
                {"id": "com_biz_eco", "name": "Business Economics", "icon": "💡", "desc": "Applied economics for business decisions"},
            ]},
            {"id": "com_tax", "name": "Taxation", "icon": "💰", "children": [
                {"id": "com_gst", "name": "GST", "icon": "🧾", "desc": "Goods & Services Tax framework & filing"},
                {"id": "com_income", "name": "Income Tax", "icon": "📋", "desc": "Tax computation, deductions & filing"},
                {"id": "com_corp_tax", "name": "Corporate Tax", "icon": "🏢", "desc": "Corporate tax planning & compliance"},
            ]},
            {"id": "com_fin_mgmt", "name": "Financial Mgmt", "icon": "🏦", "children": [
                {"id": "com_cap", "name": "Capital Structure", "icon": "🔧", "desc": "Debt vs equity financing decisions"},
                {"id": "com_working", "name": "Working Capital", "icon": "⚡", "desc": "Cash, inventory & receivables management"},
                {"id": "com_invest", "name": "Investment Analysis", "icon": "📈", "desc": "NPV, IRR & capital project evaluation"},
            ]},
            {"id": "com_audit", "name": "Auditing", "icon": "🔎", "children": [
                {"id": "com_int_audit", "name": "Internal Audit", "icon": "🔍", "desc": "Internal controls & risk assessment"},
                {"id": "com_stat_audit", "name": "Statutory Audit", "icon": "📋", "desc": "External audit & financial reporting"},
                {"id": "com_forensic", "name": "Forensic Accounting", "icon": "🕵️", "desc": "Fraud detection & investigation"},
            ]},
        ],
        "achievements": [
            {"id": "com_first_entry", "name": "First Entry", "icon": "📒", "color": "#52FFB8", "xp_bonus": 50, "desc": "Begin your commerce journey", "type": "first"},
            {"id": "com_tax_expert", "name": "Tax Expert", "icon": "💰", "color": "#a3ffdc", "xp_bonus": 300, "desc": "Master all Taxation nodes", "type": "branch", "branch": "com_tax"},
            {"id": "com_ca_track", "name": "CA Track", "icon": "🏆", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 12+ commerce skills", "type": "count", "count": 12},
        ],
        "pillars": ["Accounting", "Economics", "Taxation", "Finance", "Auditing"],
        "readiness_weights": {"com_acc": 0.25, "com_eco": 0.15, "com_tax": 0.2, "com_fin_mgmt": 0.25, "com_audit": 0.15},
    },

    "psychology": {
        "root": {"id": "psy_root", "name": "Psychology", "icon": "🧠"},
        "branches": [
            {"id": "psy_bio", "name": "Biological Psych", "icon": "🔬", "children": [
                {"id": "psy_neuro", "name": "Neuroscience", "icon": "🧠", "desc": "Brain structure & neural pathways"},
                {"id": "psy_genetics", "name": "Behavioral Genetics", "icon": "🧬", "desc": "Nature vs nurture debate"},
                {"id": "psy_physio", "name": "Physiological Psych", "icon": "💉", "desc": "Hormones, drugs & behavior"},
            ]},
            {"id": "psy_cog", "name": "Cognitive Psych", "icon": "💡", "children": [
                {"id": "psy_memory", "name": "Memory", "icon": "🗄️", "desc": "Memory types, encoding & retrieval"},
                {"id": "psy_attention", "name": "Attention", "icon": "👁️", "desc": "Selective attention & divided focus"},
                {"id": "psy_decision", "name": "Decision Making", "icon": "⚖️", "desc": "Heuristics & cognitive biases"},
            ]},
            {"id": "psy_develop", "name": "Developmental", "icon": "👶", "children": [
                {"id": "psy_child", "name": "Child Psychology", "icon": "🧸", "desc": "Piaget & childhood cognitive development"},
                {"id": "psy_adol", "name": "Adolescence", "icon": "🎒", "desc": "Identity formation & peer influence"},
                {"id": "psy_adult", "name": "Adult Development", "icon": "👤", "desc": "Erikson's stages & lifespan psychology"},
            ]},
            {"id": "psy_social", "name": "Social Psych", "icon": "👥", "children": [
                {"id": "psy_conform", "name": "Conformity", "icon": "🔄", "desc": "Social influence, obedience & authority"},
                {"id": "psy_attitude", "name": "Attitudes", "icon": "💬", "desc": "Attitude formation & persuasion"},
                {"id": "psy_group", "name": "Group Dynamics", "icon": "🫂", "desc": "In-group bias, groupthink & leadership"},
            ]},
            {"id": "psy_clinical", "name": "Clinical Psych", "icon": "🩺", "children": [
                {"id": "psy_abnorm", "name": "Abnormal Psych", "icon": "🌪️", "desc": "Mental disorders & DSM-5 criteria"},
                {"id": "psy_therapy", "name": "Psychotherapy", "icon": "💬", "desc": "CBT, psychoanalysis & humanistic therapy"},
                {"id": "psy_assess", "name": "Psychological Tests", "icon": "📋", "desc": "IQ tests, personality inventories"},
            ]},
        ],
        "achievements": [
            {"id": "psy_first_session", "name": "First Session", "icon": "🌱", "color": "#52FFB8", "xp_bonus": 50, "desc": "Begin your psychology journey", "type": "first"},
            {"id": "psy_cognitive_master", "name": "Mind Reader", "icon": "💡", "color": "#a3ffdc", "xp_bonus": 300, "desc": "Master all Cognitive Psych nodes", "type": "branch", "branch": "psy_cog"},
            {"id": "psy_therapist", "name": "The Therapist", "icon": "🩺", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 12+ psychology skills", "type": "count", "count": 12},
        ],
        "pillars": ["Biological", "Cognitive", "Developmental", "Social", "Clinical"],
        "readiness_weights": {"psy_bio": 0.15, "psy_cog": 0.25, "psy_develop": 0.2, "psy_social": 0.2, "psy_clinical": 0.2},
    },

    "architecture": {
        "root": {"id": "arch_root", "name": "Architecture", "icon": "🏛️"},
        "branches": [
            {"id": "arch_design", "name": "Design Theory", "icon": "✏️", "children": [
                {"id": "arch_form", "name": "Form & Space", "icon": "📐", "desc": "Spatial relationships & composition principles"},
                {"id": "arch_hist", "name": "Arch. History", "icon": "🏺", "desc": "Greek to contemporary architectural styles"},
                {"id": "arch_urban", "name": "Urban Design", "icon": "🏙️", "desc": "City planning, zoning & public spaces"},
            ]},
            {"id": "arch_tech", "name": "Building Technology", "icon": "🏗️", "children": [
                {"id": "arch_struct", "name": "Structure", "icon": "🔩", "desc": "Load analysis & structural systems"},
                {"id": "arch_env", "name": "Environmental", "icon": "🌿", "desc": "Thermal comfort, acoustics & daylighting"},
                {"id": "arch_material", "name": "Materials", "icon": "🧱", "desc": "Concrete, steel, glass & timber"},
            ]},
            {"id": "arch_digital", "name": "Digital Tools", "icon": "💻", "children": [
                {"id": "arch_cad", "name": "AutoCAD", "icon": "📏", "desc": "Technical drawing & documentation"},
                {"id": "arch_revit", "name": "Revit / BIM", "icon": "🏢", "desc": "Building information modeling & coordination"},
                {"id": "arch_3d", "name": "3D Visualization", "icon": "🎨", "desc": "Rhino, SketchUp & rendering"},
            ]},
            {"id": "arch_sus", "name": "Sustainability", "icon": "🌱", "children": [
                {"id": "arch_green", "name": "Green Building", "icon": "♻️", "desc": "LEED, GRIHA & sustainable design standards"},
                {"id": "arch_passive", "name": "Passive Design", "icon": "☀️", "desc": "Natural ventilation & solar strategies"},
                {"id": "arch_energy", "name": "Energy Analysis", "icon": "⚡", "desc": "Energy modeling & building efficiency"},
            ]},
            {"id": "arch_prof", "name": "Professional Practice", "icon": "💼", "children": [
                {"id": "arch_contract", "name": "Contracts", "icon": "📋", "desc": "Architectural contracts & professional law"},
                {"id": "arch_pm", "name": "Project Mgmt", "icon": "📅", "desc": "Site supervision & project scheduling"},
                {"id": "arch_spec", "name": "Specifications", "icon": "📝", "desc": "Technical specs, BOQ & detailing"},
            ]},
        ],
        "achievements": [
            {"id": "arch_first_sketch", "name": "First Sketch", "icon": "✏️", "color": "#52FFB8", "xp_bonus": 50, "desc": "Begin your architecture journey", "type": "first"},
            {"id": "arch_sustainable", "name": "Green Architect", "icon": "🌱", "color": "#a3ffdc", "xp_bonus": 300, "desc": "Master all Sustainability nodes", "type": "branch", "branch": "arch_sus"},
            {"id": "arch_master", "name": "Master Architect", "icon": "🏛️", "color": "#FFFFFF", "xp_bonus": 1000, "desc": "Master 12+ architecture skills", "type": "count", "count": 12},
        ],
        "pillars": ["Design", "Technology", "Digital", "Sustainability", "Professional"],
        "readiness_weights": {"arch_design": 0.2, "arch_tech": 0.2, "arch_digital": 0.2, "arch_sus": 0.2, "arch_prof": 0.2},
    },
}

# ── Career Detection ────────────────────────────────────────────────────────────

CAREER_KEYWORDS: dict[str, list[str]] = {
    "software_engineering": ["software", "computer science", "cs", "btech", "b.tech", "information technology", "it", "cse", "programming", "computing"],
    "mbbs": ["mbbs", "medicine", "medical", "bds", "dental", "doctor", "clinical", "pharmacy", "pharma", "nursing", "health science"],
    "law": ["law", "llb", "ba llb", "llm", "legal", "advocate", "jurisprudence"],
    "mba": ["mba", "management", "business administration", "pgdm", "business", "mms"],
    "data_science": ["data science", "data analytics", "data engineering", "statistics", "artificial intelligence", "machine learning", "ai & ml"],
    "mechanical_engineering": ["mechanical", "mechatronics", "automobile", "production engineering", "thermal"],
    "commerce": ["commerce", "bcom", "b.com", "accounting", "finance", "economics", "ca ", "cfa", "cpa"],
    "psychology": ["psychology", "psycho", "behavioural science", "behavioral science", "counseling", "counselling"],
    "architecture": ["architecture", "arch", "planning", "interior design", "b.arch"],
}

def detect_career(course: str) -> str:
    if not course:
        return "software_engineering"
    c = course.lower()
    for career, keywords in CAREER_KEYWORDS.items():
        for kw in keywords:
            if kw in c:
                return career
    return "software_engineering"


def build_nodes(career_key: str) -> list[dict[str, Any]]:
    tree = CAREER_TREES.get(career_key, CAREER_TREES["software_engineering"])
    root_def = tree["root"]
    branches = tree["branches"]

    W, n_branches = 1100, len(branches)
    branch_spacing = (W - 200) / max(n_branches - 1, 1)

    nodes: list[dict] = [{
        "id": root_def["id"], "parent_id": None, "level": 0,
        "name": root_def["name"], "icon": root_def["icon"],
        "description": f"Your complete {root_def['name']} learning map",
        "xp_required": 0, "unlock_threshold": 0, "x": 550, "y": 80,
    }]

    for i, branch in enumerate(branches):
        bx = int(100 + i * branch_spacing)
        nodes.append({
            "id": branch["id"], "parent_id": root_def["id"], "level": 1,
            "name": branch["name"], "icon": branch["icon"],
            "description": f"Master {branch['name']}",
            "xp_required": 100, "unlock_threshold": 0, "x": bx, "y": 260,
        })
        children = branch["children"]
        nc = len(children)
        cs = min(120, max(80, branch_spacing / max(nc, 1)))
        start_x = bx - (nc - 1) * cs / 2
        for j, child in enumerate(children):
            nodes.append({
                "id": child["id"], "parent_id": branch["id"], "level": 2,
                "name": child["name"], "icon": child["icon"],
                "description": child["desc"],
                "xp_required": 200, "unlock_threshold": 20,
                "x": int(start_x + j * cs), "y": 450,
            })
    return nodes


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _compute_level(total_xp: int) -> dict:
    NAMES = ["", "Beginner", "Learner", "Skilled", "Advanced", "Expert", "Elite", "Master"]
    level = max(1, min(7, int(math.sqrt(total_xp / 100)))) if total_xp > 0 else 1
    thresholds = [n * n * 100 for n in range(9)]
    xp_curr, xp_next = thresholds[level], thresholds[level + 1]
    span = xp_next - xp_curr
    return {
        "level": level,
        "level_name": NAMES[level],
        "total_xp": total_xp,
        "xp_in_level": total_xp - xp_curr,
        "xp_for_next": xp_next,
        "span": span,
        "progress_pct": round((total_xp - xp_curr) / span * 100, 1) if span > 0 else 0,
    }


def _get_progress_map(user_id: int, db: DBSession) -> dict[str, NodeProgress]:
    rows = db.query(NodeProgress).filter(NodeProgress.user_id == user_id).all()
    return {r.node_id: r for r in rows}


def _unlock_available(user_id: int, db: DBSession, progress_map: dict, nodes: list):
    for node in nodes:
        nid, pid = node["id"], node["parent_id"]
        if nid in progress_map and progress_map[nid].status != "locked":
            continue
        if pid is None:
            if nid not in progress_map:
                _upsert_node(user_id, nid, "available", db)
            continue
        parent = progress_map.get(pid)
        if parent and parent.completion_pct >= node["unlock_threshold"]:
            _upsert_node(user_id, nid, "available", db)


def _upsert_node(user_id: int, node_id: str, status: str, db: DBSession,
                 comp_delta: float = 0.0, xp_delta: int = 0,
                 lessons_delta: int = 0, quizzes_delta: int = 0) -> NodeProgress:
    row = db.query(NodeProgress).filter_by(user_id=user_id, node_id=node_id).first()
    if row is None:
        row = NodeProgress(user_id=user_id, node_id=node_id, status=status)
        db.add(row)
    else:
        if status not in ("locked",) or row.status == "locked":
            row.status = status
    row.completion_pct = min(100.0, row.completion_pct + comp_delta)
    row.xp_earned += xp_delta
    row.lessons_completed += lessons_delta
    row.quizzes_completed += quizzes_delta
    if row.completion_pct >= 100:
        row.status = "mastered"
    elif row.completion_pct > 0 and row.status == "available":
        row.status = "in_progress"
    try:
        db.commit(); db.refresh(row)
    except IntegrityError:
        db.rollback()
    return row


def _health_score(p: NodeProgress | None) -> float:
    if p is None or p.status == "locked":
        return 100.0
    base = p.completion_pct * 0.65
    quiz_bonus = min(35.0, p.quizzes_completed * 12)
    return min(100.0, base + quiz_bonus)


def _effective_status(p: NodeProgress | None, health: float) -> str:
    if p is None:
        return "locked"
    s = p.status
    if s not in ("locked", "available") and health < 35 and p.completion_pct > 15:
        return "weak"
    return s


def _get_career_key(user_id: int, db: DBSession) -> str:
    try:
        from app.models.student_profile import StudentProfile
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()
        if profile and profile.course:
            return detect_career(profile.course)
    except Exception:
        pass
    return "software_engineering"


XP_REWARDS = {"quiz": 50, "lesson": 20, "task": 30, "challenge": 100}
COMP_GAINS = {"quiz": 15.0, "lesson": 10.0, "task": 12.0, "challenge": 25.0}


# ── Achievement checker ────────────────────────────────────────────────────────

def _check_achievements(user_id: int, db: DBSession, career_key: str, nodes: list) -> list[dict]:
    tree = CAREER_TREES.get(career_key, CAREER_TREES["software_engineering"])
    ach_defs = tree["achievements"]
    progress_map = _get_progress_map(user_id, db)
    earned_ids = {r.achievement_id for r in db.query(SkillTreeAchievement).filter_by(user_id=user_id).all()}
    mastered = {nid for nid, p in progress_map.items() if p.status == "mastered"}
    unlocked = {nid for nid, p in progress_map.items() if p.status != "locked"}
    node_map = {n["id"]: n for n in nodes}

    new_ids: set[str] = set()
    for a in ach_defs:
        aid = a["id"]
        if aid in earned_ids:
            continue
        t = a.get("type", "")
        if t == "first" and unlocked:
            new_ids.add(aid)
        elif t == "branch":
            branch_id = a.get("branch", "")
            branch_children = {n["id"] for n in nodes if n.get("parent_id") == branch_id}
            if branch_children and branch_children.issubset(mastered):
                new_ids.add(aid)
        elif t == "count":
            if len(mastered) >= a.get("count", 99):
                new_ids.add(aid)

    ach_map = {a["id"]: a for a in ach_defs}
    result = []
    for aid in new_ids:
        try:
            db.add(SkillTreeAchievement(user_id=user_id, achievement_id=aid))
            db.commit()
            result.append(ach_map[aid])
        except IntegrityError:
            db.rollback()
    return result


# ── Mission generator ──────────────────────────────────────────────────────────

MISSION_TEMPLATES: dict[str, list[dict]] = {
    "quiz": [
        {"title": "Knowledge Check", "desc": "Complete 1 quiz on {node}", "xp": 60},
        {"title": "Test Yourself", "desc": "Score on a {node} quiz", "xp": 60},
    ],
    "lesson": [
        {"title": "Study Session", "desc": "Complete a lesson on {node}", "xp": 30},
        {"title": "Deep Dive", "desc": "Study {node} fundamentals", "xp": 30},
    ],
    "task": [
        {"title": "Practice Task", "desc": "Complete a practical task for {node}", "xp": 40},
    ],
    "challenge": [
        {"title": "Elite Challenge", "desc": "Attempt the {node} challenge", "xp": 120},
    ],
}

def _generate_missions(career_key: str, nodes: list, progress_map: dict) -> list[dict]:
    skill_nodes = [n for n in nodes if n["level"] == 2]
    weak, available, in_prog = [], [], []
    for n in skill_nodes:
        p = progress_map.get(n["id"])
        if p is None or p.status == "locked":
            continue
        h = _health_score(p)
        if h < 40 and p.completion_pct > 5:
            weak.append((n, h))
        elif p.status == "available":
            available.append(n)
        elif p.status == "in_progress":
            in_prog.append(n)

    weak.sort(key=lambda x: x[1])
    missions = []
    seen: set[str] = set()

    def add_mission(node: dict, act: str, priority: str):
        if node["id"] in seen:
            return
        seen.add(node["id"])
        tpl = random.choice(MISSION_TEMPLATES.get(act, MISSION_TEMPLATES["lesson"]))
        missions.append({
            "id": f"{node['id']}_{act}",
            "title": tpl["title"],
            "description": tpl["desc"].replace("{node}", node["name"]),
            "node_id": node["id"],
            "node_name": node["name"],
            "node_icon": node["icon"],
            "activity_type": act,
            "xp_reward": tpl["xp"],
            "priority": priority,
            "completed": False,
        })

    for node, _ in weak[:2]:
        add_mission(node, "quiz", "critical")
    for node in in_prog[:2]:
        add_mission(node, "task", "recommended")
    for node in available[:1]:
        add_mission(node, "lesson", "new")

    # Fill to 5 with lesson missions from any started node
    all_started = [n for n in skill_nodes if progress_map.get(n["id"]) and progress_map[n["id"]].status != "locked"]
    random.shuffle(all_started)
    for node in all_started:
        if len(missions) >= 5:
            break
        add_mission(node, "lesson", "optional")

    return missions[:5]


# ── Career readiness ───────────────────────────────────────────────────────────

def _compute_readiness(career_key: str, nodes: list, progress_map: dict) -> dict:
    tree = CAREER_TREES.get(career_key, CAREER_TREES["software_engineering"])
    weights = tree.get("readiness_weights", {})
    branches = tree["branches"]

    breakdown = []
    for branch in branches:
        children_ids = [c["id"] for c in branch["children"]]
        pcts = [progress_map[cid].completion_pct if cid in progress_map else 0.0 for cid in children_ids]
        score = round(sum(pcts) / max(len(pcts), 1), 1)
        breakdown.append({"name": branch["name"], "score": score, "icon": branch["icon"]})

    all_nodes = [n for n in nodes if n["level"] == 2]
    all_pcts = [progress_map[n["id"]].completion_pct if n["id"] in progress_map else 0.0 for n in all_nodes]

    technical = round(sum(all_pcts) / max(len(all_pcts), 1), 1)
    unlocked_count = sum(1 for n in all_nodes if n["id"] in progress_map and progress_map[n["id"]].status != "locked")
    breadth = round(unlocked_count / max(len(all_nodes), 1) * 100, 1)
    total_quizzes = sum(p.quizzes_completed for p in progress_map.values())
    practice = min(100.0, round(total_quizzes * 5, 1))
    overall = round((technical * 0.4 + breadth * 0.3 + practice * 0.3), 1)

    return {
        "overall": overall,
        "technical": technical,
        "breadth": breadth,
        "practice": practice,
        "breakdown": breakdown,
    }


# ── AI Insight ─────────────────────────────────────────────────────────────────

MENTOR_TEMPLATES = [
    "Your {weak} skills need attention — consistent practice will accelerate your growth significantly.",
    "You're making real progress! Focus more on {weak} to unlock your next career milestone.",
    "TwinMind analysis: {weak} is your current bottleneck. Addressing it could boost your readiness by ~15%.",
]

def _generate_insight(career_key: str, nodes: list, progress_map: dict) -> dict:
    tree = CAREER_TREES.get(career_key, CAREER_TREES["software_engineering"])
    branches = tree["branches"]

    branch_scores: list[tuple[str, str, float]] = []
    for branch in branches:
        children_ids = [c["id"] for c in branch["children"]]
        pcts = [progress_map[cid].completion_pct if cid in progress_map else 0.0 for cid in children_ids]
        score = sum(pcts) / max(len(pcts), 1)
        branch_scores.append((branch["name"], branch["icon"], score))

    started = [(n, s, sc) for n, s, sc in branch_scores if sc > 0]
    if not started:
        # No progress yet
        weakest_name, weakest_icon = branches[0]["name"], branches[0]["icon"]
        message = f"Welcome! Start with {weakest_name} to begin your {tree['root']['name']} journey."
        recs = [f"Complete your first lesson in {branches[0]['name']}",
                f"Unlock all {branches[0]['name']} skills",
                "Set a daily study goal of 20 minutes"]
        prediction = "Estimated readiness in 14 days of study: 35%"
    else:
        weakest_name, weakest_icon, weakest_score = min(started, key=lambda x: x[2])
        strongest_name, _, strongest_score = max(started, key=lambda x: x[2])
        message = random.choice(MENTOR_TEMPLATES).replace("{weak}", weakest_name)
        recs = [
            f"Complete 2 quizzes on {weakest_name} this week",
            f"Spend 30 minutes daily on {weakest_name} practice",
            f"Build on your strength in {strongest_name} alongside {weakest_name}",
        ]
        delta = round((100 - weakest_score) * 0.15, 1)
        prediction = f"Expected improvement in {weakest_name}: +{delta:.0f}% within 7 days of focused study"

    all_nodes = [n for n in nodes if n["level"] == 2]
    all_pcts = [progress_map[n["id"]].completion_pct if n["id"] in progress_map else 0.0 for n in all_nodes]
    overall_now = sum(all_pcts) / max(len(all_pcts), 1)
    predicted_overall = min(100.0, overall_now + 12.0)

    return {
        "message": message,
        "weak_area": weakest_name if started else branches[0]["name"],
        "recommendations": recs,
        "prediction": prediction,
        "current_readiness": round(overall_now, 1),
        "predicted_readiness": round(predicted_overall, 1),
    }


# ── Pydantic schemas ───────────────────────────────────────────────────────────

class ActivityRequest(BaseModel):
    node_id: str
    activity_type: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/tree")
def get_skill_tree(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    career_key = _get_career_key(current_user.id, db)
    tree_def = CAREER_TREES.get(career_key, CAREER_TREES["software_engineering"])
    nodes = build_nodes(career_key)
    node_ids = {n["id"] for n in nodes}

    progress_map = _get_progress_map(current_user.id, db)
    # Only pass relevant nodes' progress
    _unlock_available(current_user.id, db, progress_map, nodes)
    progress_map = _get_progress_map(current_user.id, db)

    all_xp = db.query(XPTransaction).filter(XPTransaction.user_id == current_user.id).all()
    career_xp = [t for t in all_xp if t.node_id in node_ids]
    total_xp = sum(t.xp_amount for t in career_xp)

    from datetime import datetime, timedelta
    weekly_xp = sum(t.xp_amount for t in career_xp
                    if t.created_at and (datetime.utcnow() - t.created_at.replace(tzinfo=None)).days <= 7)

    earned_ach_ids = {r.achievement_id for r in db.query(SkillTreeAchievement).filter_by(user_id=current_user.id).all()}
    ach_defs = tree_def["achievements"]

    nodes_out = []
    for node in nodes:
        p = progress_map.get(node["id"])
        health = _health_score(p)
        eff_status = _effective_status(p, health)
        nodes_out.append({
            **node,
            "status": eff_status,
            "completion_pct": p.completion_pct if p else 0.0,
            "xp_earned": p.xp_earned if p else 0,
            "lessons_completed": p.lessons_completed if p else 0,
            "quizzes_completed": p.quizzes_completed if p else 0,
            "health_score": round(health, 1),
        })

    return {
        "career": tree_def["root"]["name"],
        "career_key": career_key,
        "career_icon": tree_def["root"]["icon"],
        "pillars": tree_def.get("pillars", []),
        "nodes": nodes_out,
        "xp": _compute_level(total_xp),
        "weekly_xp": weekly_xp,
        "achievements": [{**a, "earned": a["id"] in earned_ach_ids} for a in ach_defs],
    }


@router.post("/activity")
def record_activity(body: ActivityRequest,
                    current_user: User = Depends(get_current_user),
                    db: DBSession = Depends(get_db)):
    if body.activity_type not in XP_REWARDS:
        raise HTTPException(status_code=400, detail="Invalid activity_type")

    career_key = _get_career_key(current_user.id, db)
    nodes = build_nodes(career_key)
    node_map = {n["id"]: n for n in nodes}

    if body.node_id not in node_map:
        raise HTTPException(status_code=404, detail="Unknown node for this career")

    progress_map = _get_progress_map(current_user.id, db)
    prog = progress_map.get(body.node_id)
    if prog is None or prog.status == "locked":
        raise HTTPException(status_code=403, detail="Node is locked")

    xp = XP_REWARDS[body.activity_type]
    comp = COMP_GAINS[body.activity_type]

    db.add(XPTransaction(user_id=current_user.id, node_id=body.node_id,
                         activity_type=body.activity_type, xp_amount=xp))
    db.commit()

    _upsert_node(current_user.id, body.node_id,
                 prog.status if prog.status != "locked" else "in_progress", db,
                 comp_delta=comp, xp_delta=xp,
                 lessons_delta=1 if body.activity_type == "lesson" else 0,
                 quizzes_delta=1 if body.activity_type == "quiz" else 0)

    progress_map = _get_progress_map(current_user.id, db)
    _unlock_available(current_user.id, db, progress_map, nodes)

    new_achievements = _check_achievements(current_user.id, db, career_key, nodes)

    node_ids = {n["id"] for n in nodes}
    total_xp = sum(t.xp_amount for t in db.query(XPTransaction)
                   .filter(XPTransaction.user_id == current_user.id).all()
                   if t.node_id in node_ids)

    return {
        "xp_gained": xp,
        "total_xp": total_xp,
        "level_info": _compute_level(total_xp),
        "new_achievements": new_achievements,
        "completion_gain": comp,
    }


@router.get("/missions")
def get_missions(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    career_key = _get_career_key(current_user.id, db)
    nodes = build_nodes(career_key)
    progress_map = _get_progress_map(current_user.id, db)
    return {"missions": _generate_missions(career_key, nodes, progress_map)}


@router.get("/readiness")
def get_readiness(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    career_key = _get_career_key(current_user.id, db)
    nodes = build_nodes(career_key)
    progress_map = _get_progress_map(current_user.id, db)
    return _compute_readiness(career_key, nodes, progress_map)


@router.get("/insight")
def get_insight(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    career_key = _get_career_key(current_user.id, db)
    nodes = build_nodes(career_key)
    progress_map = _get_progress_map(current_user.id, db)
    return _generate_insight(career_key, nodes, progress_map)
