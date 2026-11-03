# ConvoIQ — AI Meeting Assistant

A responsive React and Vite frontend for the ConvoIQ meeting management experience. The interface uses a light lavender glass design and includes a dashboard plus meeting, task, decision, memory, chat, analytics, and settings views.

## Run locally

```sh
npm install
npm run dev
```

Build and lint checks:

```sh
npm run build
npm run lint
```

## Demo behavior

- Meeting records are local sample data. Tasks and decisions are saved in browser local storage.
- Audio uploads are selected from the local device and previewed in the browser; they are not sent to a service.
- Recording controls and the ESP32-S3 device panel are simulations. No hardware connection is configured.
- The AI chat and summary preview use clearly labeled sample responses. No AI service is configured.
- Search covers meeting, task, and decision titles. Use **Ctrl+K** to focus the search field.
