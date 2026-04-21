# SmartMedic (Monorepo)

This repository contains:
- `backend/`: Express API + Firebase Admin + Gemini/Groq symptom analysis pipeline
- `frontend_new/`: React + Vite web app

## Project Structure

- `backend/server.js`: API server (`/predict`, `/history`, `/health`)
- `backend/firestore.rules`: Firestore security rules (versioned source)
- `frontend_new/src/`: React application source code
- `frontend_new/index.html`: Vite app entry HTML

## Prerequisites

- Node.js 18+
- npm 9+
- Firebase project and service account
- Gemini API key
- (Optional) Groq API key
- (Optional) EmailJS for appointment notification emails

## Setup

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 2) Frontend

```bash
cd frontend_new
cp .env.example .env
npm install
npm run dev
```

## Validation Commands

### Frontend

```bash
cd frontend_new
npm run lint
npm run build
```

### Backend

```bash
cd backend
node --check server.js
```

## Production Build

```bash
cd frontend_new
npm run build
npm run preview
```

## Notes

- Do not commit `.env` files or service account JSON files.
- `dist/` is generated output and should not be edited manually.
- Keep `firestore.rules` in Git even if rules are already deployed.
