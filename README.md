# ConvoIQ — AI Smart Meeting Assistant

ConvoIQ is a meeting-assistant project with a React dashboard and a Node.js/Express API backed by MongoDB and Mongoose. Meeting records, workspaces, audio uploads, and optional AI meeting processing use the backend; device controls and some assistant views remain demonstrations.

## Problem statement

Meeting outcomes are easy to lose across recordings, notes, decisions, and follow-up work. ConvoIQ is intended to bring those details together so teams can find what was discussed and keep next steps visible.

## Features and current status

### Implemented

- Responsive React dashboard with meeting, task, decision, memory, chat, analytics, and settings views.
- Sample meeting library with title search, category/status filters, meeting details, summaries, and decisions.
- Create, edit, filter, and update task and decision items in the frontend.
- Tasks and decisions persist in browser local storage.
- Meeting records load from the backend; the Meetings page includes all assigned and unassigned meetings.
- Create, rename, and delete workspaces; deleting a workspace leaves its meetings unassigned.
- Assign, move, and remove existing meetings from workspaces without duplicating meeting records.
- Create meetings and upload audio directly into a workspace.
- Retrieve meetings through a workspace-ID-filtered backend endpoint.
- Express health endpoint, meeting CRUD, audio upload, and workspace routes.
- Local Ollama prompt-test endpoint using the `qwen2.5:3b` model.
- Mongoose meeting/workspace schemas and MongoDB Atlas connection configuration.
- Explicitly started OpenAI audio transcription with diarized speaker labels and structured meeting analysis.
- Saved transcripts, summaries, discussion points, customer insights, action items, decisions, and processing state.
- Separate frontend and backend npm manifests and lockfiles.

### Demo-only or not yet connected

- Recording controls, global AI chat, summary generation, analytics, notifications, and device status are simulations or sample content.
- Workspace chat accepts a workspace-scoped request but returns HTTP 501 until an AI provider is configured; it does not generate answers.
- Workspace-specific long-term memory and semantic retrieval are not implemented.
- Real external transcription and analysis require an OpenAI API key configured in the backend.
- Backend tests use mocked provider responses and do not call OpenAI.

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
│   ├── controllers/     # Meeting and workspace request handlers
│   ├── models/          # Meeting and workspace schemas
│   ├── routes/          # Meeting, workspace, and audio API routes
│   ├── services/        # Meeting processing service
│   ├── tests/           # Backend processing tests
│   ├── uploads/         # Local upload directory (private files are ignored)
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
└── frontend/
    ├── public/
    ├── src/
    │   ├── assets/
    │   ├── components/
    │   ├── data/            # Local demo data
    │   └── pages/           # Existing pages and the separate Workspaces page
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

Run backend unit tests with `npm test` from `backend/`. These tests use mocked OpenAI responses and do not upload recordings or contact the provider.

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

The frontend uses `http://localhost:5000` by default. Set `VITE_API_BASE_URL` in the frontend environment if the backend is hosted elsewhere.

## OpenAI meeting processing

Add these values to the local `backend/.env` file and restart the backend:

```dotenv
OPENAI_API_KEY=<your OpenAI API key>
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-transcribe-diarize
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
```

Only `OPENAI_API_KEY` is required; the model variables shown are defaults. The backend uses the OpenAI Audio Transcriptions API for transcript text and speaker turns, followed by a JSON-mode chat completion for the summary, discussion points, customer concerns/responses/outcomes, tasks, and decisions. Speaker IDs are displayed as `Speaker 1`, `Speaker 2`, etc.; the application does not infer participant names.

After uploading a recording, choose **Start AI processing** in the upload dialog, or open the meeting and choose **Process with AI**. Processing status and errors are stored with the meeting; failed jobs can be retried. The original audio stays available for playback. Oversized PCM WAV files are locally converted to mono 16-bit 16 kHz WAV to fit the provider's 25 MB per-file limit. Oversized MP3s and unsupported oversized WAV encodings must be converted to a smaller mono 16-bit 16 kHz WAV before processing. Audio is sent from the backend to OpenAI only after processing is explicitly started.

## API endpoints

The backend provides:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check backend availability |
| `POST` | `/api/ai/test` | Send a prompt to local Ollama (`qwen2.5:3b`) and return its response |
| `POST` | `/api/meetings` | Create a meeting |
| `GET` | `/api/meetings` | List meetings |
| `GET` | `/api/meetings/:id` | Retrieve a meeting, including processing state and generated results |
| `PUT` | `/api/meetings/:id` | Update a meeting |
| `DELETE` | `/api/meetings/:id` | Delete a meeting |
| `POST` | `/api/meetings/:id/process` | Start asynchronous transcription and AI analysis |
| `POST` | `/api/workspaces` | Create a workspace |
| `GET` | `/api/workspaces` | List workspaces with meeting counts and recent meeting |
| `GET` | `/api/workspaces/:id` | Retrieve a workspace |
| `PUT` | `/api/workspaces/:id` | Rename a workspace or update its description |
| `DELETE` | `/api/workspaces/:id` | Delete a workspace and unassign, but preserve, its meetings |
| `GET` | `/api/workspaces/:id/meetings` | Retrieve only meetings assigned to the workspace |
| `POST` | `/api/workspaces/:id/chat` | Workspace chat placeholder; returns 501 until AI integration |
| `PATCH` | `/api/meetings/:id/workspace` | Assign, move, or unassign a meeting (`workspaceId: null` unassigns) |

The API connects to MongoDB before listening for requests. Workspace assignments and AI processing results are stored on the existing meeting document; no existing meeting records need to be recreated.

## Local Ollama prompt test

The Stage 2 AI test endpoint sends prompts only to the local Ollama server at `http://127.0.0.1:11434`, using the `qwen2.5:3b` model. Ensure Ollama is running and that model is installed before calling it. This endpoint does not use OpenAI, does not process meeting recordings, and does not change the existing meeting, workspace, or audio-upload APIs.

In Thunder Client, create a request with:

- **Method:** `POST`
- **URL:** `http://localhost:5000/api/ai/test`
- **Header:** `Content-Type: application/json`
- **Body type:** JSON
- **Body:**

  ```json
  {
    "prompt": "Summarize this meeting in two sentences, then list decisions and action items: The product team reviewed the onboarding redesign. Maya will deliver updated wireframes by Friday. The team decided to run a five-user usability test next Tuesday. Leo will recruit participants by Monday."
  }
  ```

A successful request returns HTTP 200 with the model name and generated response under `data`. Invalid or oversized prompts return HTTP 400. If Ollama is unavailable or fails, the API returns a generic error without exposing provider details or environment values.

## Development status

**Current stage:** frontend dashboard, meeting CRUD/audio upload, workspace CRUD and organization, a local Ollama prompt-test endpoint, and the existing explicitly started processing pipeline are implemented. The Ollama endpoint is independent of audio processing. Workspace chat and isolated long-term memory remain pending.

## Planned improvements

- Add automated API tests for meeting validation, workspace CRUD, assignment, and deletion preservation.
- Implement workspace-scoped long-term memory and RAG after choosing an AI provider.
- Connect and validate physical meeting-device recording controls.
- Replace sample analytics and settings behavior with persisted workspace data.
