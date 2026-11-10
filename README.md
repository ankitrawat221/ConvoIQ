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
- Local Ollama prompt-test endpoint and meeting transcript analysis using the `qwen2.5:3b` model.
- Mongoose meeting/workspace schemas and MongoDB Atlas connection configuration.
- Meeting summaries, discussion points, customer insights, action items, decisions, unresolved questions, and processing state saved on the existing meeting record.
- Audio uploads remain available for playback; after upload, start transcription and analysis from the meeting details page.
- Local Faster-Whisper transcription and Ollama analysis run in sequence when meeting processing is started.
- Separate frontend and backend npm manifests and lockfiles.

### Demo-only or not yet connected

- Recording controls, global AI chat, summary generation, analytics, notifications, and device status are simulations or sample content.
- Workspace chat accepts a workspace-scoped request but returns HTTP 501 until an AI provider is configured; it does not generate answers.
- Workspace-specific long-term memory and semantic retrieval are not implemented.
- The meeting analysis endpoint requires an existing transcript and a running local Ollama server; it does not require an OpenAI API key.
- No transcription is performed by the meeting analysis endpoint. Add a completed transcript to the meeting before analyzing it.
- Backend tests use mocked provider responses and do not call Ollama.

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

## Local meeting processing

Run Ollama locally at `http://127.0.0.1:11434` and make sure `qwen2.5:3b` is installed. No `OPENAI_API_KEY` is needed for transcription or meeting analysis.

Create a meeting and upload an MP3 or WAV recording. Open its details and choose **Process Meeting & Generate Insights**. The frontend calls `POST /api/meetings/:id/process` without a transcript body. The backend transcribes the saved audio with Faster-Whisper, saves the transcript and timestamped segments, sends the transcript to local Ollama, then saves the structured analysis on that same meeting. The details page polls for status and displays the saved transcript and results.

If transcription fails, retry it without re-uploading. If analysis fails after a transcript is saved, retry analysis using the saved transcript. A transcript can also be supplied directly for analysis:

```json
{
  "transcript": "Paste the actual, completed meeting transcript here."
}
```

The backend validates the analysis and its supporting transcript evidence, saves the summary, discussion points, customer insights, action items, decisions, unresolved questions, and processing status to that meeting, and returns the saved record. Processing the same transcript again replaces its extracted lists rather than appending duplicate items. Changing a transcript clears its previous analysis.

If neither a transcript nor an audio recording is available, processing returns a clear error. Ollama/model and transcription failures are reported without exposing internal details. The original audio remains available for playback.

## Local audio transcription (stages 1-2)

The Faster-Whisper CLI uses the multilingual `small` model on CPU with int8. Its first run downloads the model weights; audio decoding and transcription then run locally. The backend invokes the CLI through `meetingProcessingService` and validates its JSON result. Speaker diarization is not available in this setup, so it returns timestamps without guessed speaker names. Uploading saves audio; processing starts when requested from the meeting details page.

From the repository root in PowerShell:

```powershell
python -m venv backend\transcription-service\.venv
backend\transcription-service\.venv\Scripts\python.exe -m pip install -r backend\transcription-service\requirements.txt
backend\transcription-service\.venv\Scripts\python.exe backend\transcription-service\transcribe.py backend\uploads\meetings\<recording>.wav
```

MP3 files are supported in the same way. The command writes a JSON object with transcript text, timestamped segments, detected language, and a flag indicating that speaker identification is unavailable. The backend uses that virtual environment by default; set `FASTER_WHISPER_PYTHON` to an alternate Python executable if needed.

## Local speaker diarization

The standalone `backend\transcription-service\diarize.py` command runs the Hugging Face `pyannote/speaker-diarization-community-1` pipeline locally. Before its first run, sign in to Hugging Face, accept the model conditions, and create an access token. Keep the token out of source control and chat. In PowerShell, enter it without echoing it and run diarization on an MP3 or WAV:

```powershell
$secureToken = Read-Host "Hugging Face token" -AsSecureString
$env:HF_TOKEN = [System.Net.NetworkCredential]::new("", $secureToken).Password
backend\transcription-service\.venv\Scripts\python.exe backend\transcription-service\diarize.py backend\uploads\meetings\<recording>.wav --device cpu
```

The initial model download requires internet access; model files are cached locally and inference then runs on the selected device. The JSON output contains speaker turns (including overlaps), an exclusive turn list for transcript alignment, a count, and anonymous `SPEAKER_00`-style IDs. IDs do not identify people or carry across meetings. Run output-format tests with `backend\transcription-service\.venv\Scripts\python.exe -m unittest discover -s backend\transcription-service -p "test_*.py"`.

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
| `POST` | `/api/meetings/:id/process` | With no body, transcribe saved audio and analyze it; with a `transcript` body, analyze that text |
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

The prompt-test endpoint and meeting analysis use the local Ollama server at `http://127.0.0.1:11434` with the `qwen2.5:3b` model. Ensure Ollama is running and that model is installed before calling either endpoint. Meeting processing can transcribe a saved recording before analysis, or analyze an existing transcript.

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

**Current stage:** frontend dashboard, meeting CRUD/audio upload, workspace CRUD and organization, local Ollama prompt testing, and transcript-based meeting analysis are implemented. Audio transcription is not started by the meeting analysis endpoint. Workspace chat and isolated long-term memory remain pending.

## Planned improvements

- Add automated API tests for meeting validation, workspace CRUD, assignment, and deletion preservation.
- Implement workspace-scoped long-term memory and RAG after choosing an AI provider.
- Connect and validate physical meeting-device recording controls.
- Replace sample analytics and settings behavior with persisted workspace data.
