# Twin_Mind

A modern full-stack web application for mental health and wellness tracking. **Twin_Mind** combines a React-based frontend with a Python backend to provide comprehensive tools for burnout assessment, subject tracking, and wellness monitoring.

## 🚀 Features

- **Burnout Assessment**: Advanced burnout evaluation tools with data visualization
- **Subject Tracking**: Comprehensive tracking and management system
- **Real-time Face Detection**: Integration with face-api for behavioral analysis
- **Interactive Calendar**: Full calendar functionality with event management
- **PDF Report Generation**: Export assessments and tracking data as PDF
- **Google OAuth Integration**: Seamless authentication with Google accounts
- **Responsive Design**: Fully responsive UI with Tailwind CSS
- **Data Visualization**: Beautiful charts and graphs with Recharts

## 🏗️ Architecture

Twin_Mind is a full-stack application with clear separation between frontend and backend:

```
Twin_Mind/
├── Frontend/          # React + TypeScript + Vite application
├── Backend/           # Python Flask/Django backend API
├── docker-compose.yml # Container orchestration
└── render.yaml        # Deployment configuration
```

### Frontend Stack
- **React 19** with TypeScript
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Framer Motion** for animations
- **FullCalendar** for scheduling features
- **Recharts** for data visualization
- **Face-API** for facial recognition capabilities

### Backend Stack
- **Python** (21.3% of codebase)
- **Docker** for containerization
- **REST API** architecture

## 📊 Tech Stack Composition

| Language   | Percentage |
|-----------|-----------|
| TypeScript | 70.6%     |
| Python    | 21.3%     |
| CSS       | 6.6%      |
| JavaScript| 1.4%      |
| HTML      | 0.1%      |

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- Python (v3.9+)
- Docker & Docker Compose (optional)

### Local Development Setup

#### Frontend
```bash
cd Frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

#### Backend
```bash
cd Backend
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies and run server
# (Refer to Backend README for specific setup)
```

The API will be available at `http://localhost:8000`

### Docker Setup

Run both services with Docker Compose:

```bash
docker-compose up --build
```

This will start:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000/api/v1

## 📁 Project Structure

### Frontend (`/Frontend`)
- React + TypeScript + Vite setup
- ESLint and Tailwind CSS configured
- HMR (Hot Module Replacement) enabled for development

### Backend (`/Backend`)
- Python backend service
- RESTful API endpoints
- Docker containerized

## 🔧 Available Scripts

### Root Level
- `npm run dev` - Start frontend development server
- `npm run build` - Build frontend for production

### Utility Scripts
- `generate_logos.py` - Generate application logos
- `generate_pwa_icons.mjs` - Generate PWA icons
- `generate-icons.mjs` - Icon generation utility
- `convert_to_png.js` - Image format conversion
- `test-burnout.mjs` - Burnout module testing
- `test-subjects.mjs` - Subject tracking testing

## 📦 Dependencies

### Key Frontend Dependencies
- `@fullcalendar/react` - Calendar functionality
- `@react-oauth/google` - Google authentication
- `@vladmandic/face-api` - Face detection and recognition
- `axios` - HTTP client
- `framer-motion` - Animation library
- `jspdf` - PDF generation
- `lucide-react` - Icon library
- `recharts` - Data visualization
- `react-router-dom` - Routing

### Key Root Dependencies
- `playwright` - Browser automation (testing)
- `vite` - Build tool
- `sharp` - Image processing

## 🚀 Deployment

The project includes deployment configuration for:

- **Render.yaml**: Deploy to Render platform
- **Docker Compose**: Local containerization
- **Environment Variables**: Configurable via environment setup

## 📝 Development Notes

- Frontend uses Vite with React compiler considerations (not enabled by default)
- Hot reload enabled for both frontend and backend in Docker
- Type-aware ESLint rules can be enabled for production
- Secret key and API configuration needed for production deployment

## 🤝 Contributing

When contributing to Twin_Mind:
1. Maintain TypeScript for frontend code
2. Follow existing ESLint configuration
3. Update both Frontend and Backend READMEs as needed
4. Test with provided test scripts (test-burnout.mjs, test-subjects.mjs)

## 📄 License

No license specified. Please see repository for details.

## 🔗 Additional Resources

- [Frontend README](./Frontend/README.md) - React + TypeScript + Vite setup details
- [Docker Compose Configuration](./docker-compose.yml) - Container setup
- [Render Deployment](./render.yaml) - Production deployment config

---

**Created**: 35 days ago  
**Primary Language**: TypeScript (70.6%)  
**Repository**: [sabarna28m/Twin_Mind](https://github.com/sabarna28m/Twin_Mind)
