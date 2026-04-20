# Backend

Express backend for symptom analysis and history persistence.

## Features

- Firebase ID token authentication
- Firestore persistence (`diagnoses` collection)
- AI analysis pipeline: Gemini -> Groq -> fallback rules
- Health endpoint: `/health`

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

## Scripts

- `npm run dev`: run with watch mode
- `npm start`: run normally

## Important Files

- `server.js`: API server
- `.env.example`: environment template
- `firestore.rules`: Firestore security rules
