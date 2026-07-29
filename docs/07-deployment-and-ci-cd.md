# 07. Deployment & CI/CD Runbooks

This document provides step-by-step instructions for deploying the Kanban platform across all supported target environments: **Firebase**, **Containerized Node + PostgreSQL**, and **Standalone In-Memory Local Dev**.

---

## 1. Environment Variable Reference Matrix

Create a `.env` file in the root of your server or functions directory matching your active storage driver:

| Variable | Description | Allowed Values | Example |
|---|---|---|---|
| `STORAGE_DRIVER` | Active database adapter | `firebase` \| `postgres` \| `memory` | `firebase` |
| `PORT` | API Server listening port | integer | `4000` |
| `JWT_SECRET` | Secret key for local JWT signing | string | `super-secret-jwt-key` |
| `DATABASE_URL` | PostgreSQL connection string | Postgres URI | `postgres://user:pass@localhost:5432/kanban` |
| `FIREBASE_PROJECT_ID` | GCP/Firebase project identifier | string | `my-kanban-prod` |
| `FIREBASE_CLIENT_EMAIL` | Admin SDK service account email | email | `firebase-adminsdk@...` |
| `FIREBASE_PRIVATE_KEY` | Admin SDK RSA private key | PEM string | `"-----BEGIN PRIVATE KEY-----\n..."` |
| `REDIS_URL` | Redis URL for Pub/Sub & BullMQ | Redis URI | `redis://localhost:6379` |

---

## 2. Deployment Target A: Firebase Serverless (Hosting + Functions + Firestore)

### Prerequisite Setup
1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firebase Hosting**, **Cloud Functions**, **Cloud Firestore**, and **Firebase Authentication**.
3. Install the Firebase CLI globally:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

### Firebase Configuration (`firebase.json`)
```json
{
  "hosting": {
    "public": "frontend/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "function": "api"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "backend-functions",
    "codeIgnore": [
      "node_modules",
      ".git"
    ]
  },
  "firestore": {
    "rules": "docs/firestore.rules"
  }
}
```

### Deployment Commands
```bash
# 1. Build Frontend SPA
cd frontend
npm run build

# 2. Build Cloud Functions API
cd ../backend-functions
npm run build

# 3. Deploy to Firebase
firebase deploy --only hosting,functions,firestore:rules
```

---

## 3. Deployment Target B: Node.js + PostgreSQL (Railway / Vercel)

### Architecture
- **Frontend SPA:** Deployed on **Vercel** or **Netlify**.
- **Backend API:** Fastify/Express app running on **Railway** or **Render**.
- **PostgreSQL DB:** Managed PostgreSQL on Railway / AWS RDS.

### Step 1: Database Migration
```bash
# Run SQL migrations against target Postgres database
npx prisma migrate deploy
```

### Step 2: Docker Container Build (`Dockerfile`)
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV STORAGE_DRIVER=postgres
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
```

---

## 4. Deployment Target C: Standalone Local Dev (In-Memory Driver)

Ideal for rapid feature development and automated end-to-end tests with zero external database dependencies.

### Execution Command
```bash
# Set environment to memory mode
export STORAGE_DRIVER=memory
export PORT=4000

# Start backend server with seeded memory store
npm run dev:server

# In a separate terminal, launch Vite frontend dev server
npm run dev:client
```

---

## 5. GitHub Actions CI/CD Pipeline (`.github/workflows/deploy.yml`)

```yaml
name: Build & Deploy Kanban Platform

on:
  push:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      
      # Run test suite against In-Memory driver
      - run: npm test
        env:
          STORAGE_DRIVER: memory

  deploy-firebase:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci && npm run build
      
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: my-kanban-prod
```

---

## 6. Project Verification & Summary

- All 7 architecture sub-documents in [`docs/`](file:///c:/Users/ayush/Pictures/kanban/docs) and [plan.md](file:///c:/Users/ayush/Pictures/kanban/plan.md) are now complete.
