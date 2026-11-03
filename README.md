# ConvoIQ — AI Smart Meeting Assistant

ConvoIQ is a meeting-assistant project with a React dashboard prototype and a Node.js/Express API backed by MongoDB and Mongoose. The dashboard demonstrates ways to organize meetings, follow-up tasks, and decisions. Its meeting content and AI/device interactions are currently demonstrations, not connected services.

## Problem statement

Meeting outcomes are easy to lose across recordings, notes, decisions, and follow-up work. ConvoIQ is intended to bring those details together so teams can find what was discussed and keep next steps visible.

## Features and current status

### Implemented

- Responsive React dashboard with meeting, task, decision, memory, chat, analytics, and settings views.
- Sample meeting library with title search, category/status filters, meeting details, summaries, and decisions.
- Create, edit, filter, and update task and decision items in the frontend.
- Tasks and decisions persist in browser local storage.
- Meeting memory search and dashboard statistics use local sample data.
- Select and preview an audio file locally in the browser; it is not uploaded.
- Express health endpoint and meeting CRUD routes.
- Mongoose meeting schema and MongoDB Atlas connection configuration.
- Separate frontend and backend npm manifests and lockfiles.

### Demo-only or not yet connected

- Meeting records shown in the frontend are mock data and are not loaded from the backend.
- Recording controls, AI chat, summary generation, analytics, notifications, and device status are simulations or sample content.
- Audio preview stays in the browser; the backend does not currently expose an upload or transcription workflow.
- Backend CRUD endpoints have been created, but API/database testing is still pending.

## Technology stack

| Area | Technologies |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS, React Router, Lucide |
| Backend | Node.js, Express, Mongoose |
| Database | MongoDB Atlas (configured through a local environment variable) |

## Project structure

```text
ConvoIQ/
├── backend/
│   ├── config/          # MongoDB connection
│   ├── controllers/     # Meeting request handlers
│   ├── models/          # Mongoose schemas
│   ├── routes/          # Meeting API routes
│   ├── services/        # Reserved for backend services
│   ├── uploads/         # Local upload directory (private files are ignored)
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
└── frontend/
    ├── public/
    ├── src/
    │   ├── assets/
    │   ├── components/
    │   ├── data/        # Local demo data
    │   └── pages/
    ├── package.json
    └── package-lock.json
```

## Requirements

- Node.js and npm
- A MongoDB Atlas cluster and database user for running the backend

## Install and run

Install dependencies in each project folder:

```sh
cd frontend
npm install
```

In a second terminal, from the project root:

```sh
cd backend
npm install
```

Configure the backend environment as described below, then start the backend from `backend/`:

```sh
npm run dev
```

Start the frontend from `frontend/` in a separate terminal:

```sh
npm run dev
```

Vite prints the local frontend URL when it starts (typically `http://localhost:5173`). The backend listens on port `5000` by default.

Useful frontend checks, run from `frontend/`:

```sh
npm run lint
npm run build
```

The backend's current `test` script is a placeholder; API and database tests have not been added yet.

## MongoDB Atlas configuration

1. Create an Atlas cluster and database user, and allow your development machine's IP in Network Access.
2. In Atlas, copy the application connection-string template and replace its placeholders with your own cluster, database, and credentials.
3. Create `backend/.env` locally (do not commit it) with:

   ```dotenv
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/<database>?retryWrites=true&w=majority
   PORT=5000
   FRONTEND_URL=http://localhost:5173
   ```

Use your own values only in the local `.env` file. URL-encode special characters in the database username or password as required by MongoDB. Do not paste credentials or a real connection string into source control, issues, or logs. Environment files are ignored by Git; `.env.example` files are allowed for safe placeholder templates.

The frontend currently has no environment configuration and does not call the backend API.

## API endpoints

The backend provides:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check backend availability |
| `POST` | `/api/meetings` | Create a meeting |
| `GET` | `/api/meetings` | List meetings |
| `GET` | `/api/meetings/:id` | Retrieve a meeting |
| `PUT` | `/api/meetings/:id` | Update a meeting |
| `DELETE` | `/api/meetings/:id` | Delete a meeting |

The API connects to MongoDB before listening for requests. These routes are implemented but still need integration and error-path testing.

## Development status

**Current stage:** frontend prototype and initial backend CRUD implementation. Frontend behavior is primarily local/demo data; MongoDB configuration, a Meeting model, and API routes exist in the backend. CRUD testing and frontend/backend integration remain outstanding.

## Planned improvements

- Add automated backend tests for meeting validation and CRUD endpoints.
- Connect frontend meeting and task workflows to the backend API.
- Implement secure audio upload and storage handling.
- Add transcription, summarization, and task/decision extraction through an AI service.
- Connect and validate physical meeting-device recording controls.
- Replace sample analytics and settings behavior with persisted workspace data.
