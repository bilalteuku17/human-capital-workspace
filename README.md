# HUMAN CAPITAL WORKSPACE

AI Virtual Office — CEO Workspace.

## Current milestone

- 3D isometric office prototype hosted on GitHub Pages.
- Eight selectable AI Employee placeholders.
- CEO task register currently stores tasks in the browser's local storage.
- AI execution backend source is prepared in `worker/index.js`; it is not live until deployed and configured in Cloudflare.

## Milestone 3 — AI Execution Engine setup

The Worker source is in `worker/index.js`. It exposes:
- `GET /health` — service health check.
- `POST /api/execute` — runs a task using a Cloudflare Workers AI binding.

Required Cloudflare Worker configuration:
1. Create a Worker and paste the contents of `worker/index.js`.
2. Add a Workers AI binding named `AI`.
3. Add a Worker secret named `HCW_API_TOKEN` with a strong, unique value.
4. Deploy the Worker and test `/health`.
5. Keep the token private. Never commit it to this repository or share it in screenshots/chat.

The browser UI is not yet connected to this Worker. Task execution is not active until the backend is deployed and a secure connection flow is added.

## Important data note

Until a server database is configured, task records remain in the local browser profile where they were created. Clearing browser site data or switching devices may remove or hide those records.
