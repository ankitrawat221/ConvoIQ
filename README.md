# ConvoIQ — AI-Powered Smart Meeting Assistant

<p align="center">
  An intelligent meeting assistant designed to simplify meeting management, automate transcription, and extract meaningful insights from conversations.
</p>

---

## About the Project

**ConvoIQ** is an AI-powered Smart Meeting Assistant built to make meetings more productive and organized.

It provides a centralized platform where users can manage meetings, organize workspaces, upload audio recordings, generate transcripts, and extract important information such as meeting summaries, key discussion points, decisions, and action items.

The application combines a React-based dashboard with a Node.js backend, MongoDB database, Faster-Whisper for speech-to-text transcription, and Ollama for local AI-powered meeting analysis.

## Key Features

### 1. Meeting Management
- Create, view, update, and delete meetings.
- Search meetings by title.
- Filter meetings by category and status.
- View meeting summaries and important decisions.

### 2. Workspace Management
- Create, rename, and delete workspaces.
- Organize meetings into different workspaces.
- Assign, move, and unassign meetings.
- View meetings associated with individual workspaces.

### 3. AI Meeting Transcription
- Upload MP3 and WAV meeting recordings.
- Convert speech into text using Faster-Whisper.
- Generate timestamped transcript segments.
- Support multilingual transcription.
- Run transcription locally.

### 4. AI-Powered Meeting Insights
Using the locally hosted Ollama model, ConvoIQ can extract:

- Meeting summaries.
- Key discussion points.
- Customer insights.
- Action items.
- Important decisions.
- Unresolved questions.

The generated information is stored in MongoDB and displayed on the meeting details page.

### 5. Dashboard and Analytics
- Responsive React dashboard.
- Meeting overview and management views.
- Task and decision management.
- Chat, memory, analytics, and settings interfaces.

**Note:** Some dashboard features currently use demonstration or sample data and are not fully connected to backend services.

## Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, Tailwind CSS |
| Routing | React Router |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| AI Model | Ollama (Qwen 2.5:3B) |
| Speech Recognition | Faster-Whisper |
| Speaker Diarization | Pyannote (optional standalone pipeline) |
| Development Tools | VS Code, Git, GitHub |

## System Architecture

The application follows a frontend-backend architecture.

1. **Frontend:** React dashboard handles user interaction, meeting management, and displaying results.
2. **Backend:** Node.js and Express handle API requests, meeting operations, workspace management, and audio uploads.
3. **Database:** MongoDB stores meeting records, workspace information, transcripts, and AI-generated insights.
4. **Transcription:** Faster-Whisper converts uploaded audio recordings into text.
5. **AI Processing:** Ollama processes transcripts and extracts structured meeting insights.

## Project Structure

```text
ConvoIQ/
│
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── tests/
│   ├── transcription-service/
│   ├── uploads/
│   ├── server.js
│   └── package.json
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── data/
│   │   └── pages/
│   └── package.json
│
├── .gitignore
└── README.md
```

## Getting Started

Follow these steps to run ConvoIQ locally.

### Prerequisites

Make sure you have installed:

- Node.js and npm
- MongoDB Atlas account
- Python (for Faster-Whisper transcription)
- Ollama
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/ankitrawat221/ConvoIQ.git

cd ConvoIQ
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies

Open another terminal:

```bash
cd frontend
npm install
```

### 4. Configure Environment Variables

Create a `.env` file inside the backend folder.

```env
MONGO_URI=your_mongodb_connection_string
PORT=5000
FRONTEND_URL=http://localhost:5173
```

Replace the MongoDB connection string with your own credentials.

**Important:** Never upload your actual `.env` file, database credentials, or API secrets to GitHub.

### 5. Configure MongoDB

- Create a MongoDB Atlas cluster.
- Create a database user.
- Configure Network Access.
- Add your MongoDB connection string to the backend `.env` file.

### 6. Configure Ollama

Install Ollama and download the required model:

```bash
ollama pull qwen2.5:3b
```

Make sure Ollama is running locally.

### 7. Configure Faster-Whisper

Create a Python virtual environment from the repository root:

```bash
python -m venv backend/transcription-service/.venv
```

For Windows PowerShell:

```powershell
backend\transcription-service\.venv\Scripts\python.exe -m pip install -r backend\transcription-service\requirements.txt
```

The first transcription run downloads the required model weights.

### 8. Run the Application

**Start the backend:**

```bash
cd backend
npm run dev
```

Backend runs on:

```text
http://localhost:5000
```

**Start the frontend in another terminal:**

```bash
cd frontend
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

## How AI Meeting Processing Works

ConvoIQ follows a two-stage processing pipeline:

**Stage 1: Audio Transcription**

- User uploads an MP3 or WAV recording.
- Faster-Whisper processes the audio locally.
- The system generates a transcript with timestamps.
- The transcript is saved against the meeting record.

**Stage 2: AI Meeting Analysis**

- The transcript is sent to the locally running Ollama model.
- The model analyzes the conversation.
- Structured meeting insights are generated.
- Results are saved in MongoDB.
- The frontend displays the generated insights.

The application can also analyze an existing transcript without uploading an audio recording.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Check server status |
| POST | `/api/ai/test` | Test local Ollama integration |
| POST | `/api/meetings` | Create a meeting |
| GET | `/api/meetings` | Get all meetings |
| GET | `/api/meetings/:id` | Get meeting details |
| PUT | `/api/meetings/:id` | Update a meeting |
| DELETE | `/api/meetings/:id` | Delete a meeting |
| POST | `/api/meetings/:id/process` | Transcribe and analyze meeting |
| POST | `/api/workspaces` | Create workspace |
| GET | `/api/workspaces` | Get all workspaces |
| GET | `/api/workspaces/:id` | Get workspace details |
| PUT | `/api/workspaces/:id` | Update workspace |
| DELETE | `/api/workspaces/:id` | Delete workspace |
| GET | `/api/workspaces/:id/meetings` | Get workspace meetings |
| POST | `/api/workspaces/:id/chat` | Workspace chat placeholder |
| PATCH | `/api/meetings/:id/workspace` | Assign or move a meeting |

## Current Development Status

### Implemented
- React-based dashboard.
- Meeting CRUD operations.
- Workspace management.
- Audio upload functionality.
- MongoDB integration.
- Local Faster-Whisper transcription.
- Ollama-based meeting analysis.
- Automated extraction of meeting insights.
- Saving transcripts and generated results.

### In Progress / Planned
- Workspace-specific AI chat integration.
- Long-term memory and semantic search.
- Physical meeting-device integration.
- Fully connected analytics and notifications.
- Additional automated API testing.

Some dashboard sections currently contain sample data or demonstration functionality.

## Future Enhancements

- Real-time meeting transcription.
- Live meeting recording integration.
- Improved speaker identification.
- Workspace-specific AI assistant.
- Retrieval-Augmented Generation (RAG) for meeting memory.
- Advanced meeting analytics.
- Cloud deployment and production integration.

## Testing

Frontend checks:

```bash
npm run lint
npm run build
```

Backend tests:

```bash
npm test
```

Run these commands from their respective frontend and backend directories.

Backend tests use mocked provider responses rather than requiring a live Ollama session.

---

## Author

**Ankit Rawat**

B.Tech – Electronics and Communication Engineering

GitHub: https://github.com/ankitrawat221

---

**ConvoIQ — Making Every Meeting More Productive.**
