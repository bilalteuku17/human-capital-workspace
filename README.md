# HUMAN CAPITAL WORKSPACE

GitHub Pages preview mirror for the canonical project repository.

- **Live preview:** https://bilalteuku17.github.io/human-capital-workspace/
- **Canonical source repository:** https://github.com/bilalteuku17/bilal-ai-content-studio
- **Frontend:** `index.html` is mirrored from the canonical repository.
- **Production backend:** Cloudflare Worker `human-capital-workspace-ai`, deployed from `worker/` in the canonical repository.
- **Database:** Cloudflare D1 `human-capital-workspace-db`.

## Current status (19 November 2026)

The canonical repository has the newer Task Register integration. The UI can use browser-local storage or connect to the authenticated D1 task API. Each PIC has a defined HC role; AI task execution uses a matching role-specific prompt. The backend exposes:

- `GET /health` — public read-only Worker, D1, and AI-binding status.
- `GET /api/tasks` — list tasks.
- `POST /api/tasks` — create a task.
- `GET /api/tasks/{id}` — read one task.
- `POST /api/tasks/{id}/run` — request an AI draft.

Protected endpoints require the `x-hcw-key` header. The latest recorded Worker deployment succeeded on 18 November 2026; its workflow verified D1 as connected and the Workers AI binding as available. However, the `HCW_API_KEY` repository secret was absent, so authenticated API testing was skipped. Model inference has not yet been smoke-tested. Do not treat the API-connected UI path as verified until an authenticated task has been created, executed, and read back from D1.

The eight office avatars now have defined HC functional roles and role-specific task prompts. A task assigned to one PIC uses that role's prompt; selecting the whole team uses one cross-functional coordinator prompt. This is still request-driven single-model execution, not eight autonomous agents or background workers.

## Activation and security

1. Generate a strong random secret for `HCW_API_KEY`.
2. Add it under **Settings → Secrets and variables → Actions** in the canonical repository.
3. Run the **Deploy HUMAN CAPITAL WORKSPACE API** workflow so the secret is synchronized to the Cloudflare Worker.
4. On a trusted private device, use **Hubungkan Task API** in the preview and enter the same key.

Do not commit the secret or paste it into chat. The browser currently holds the entered key in `sessionStorage` for the current tab; this is a temporary single-owner MVP bridge, not production multi-user authentication.

Tasks created before connecting remain in that browser's local storage and are not automatically migrated to D1.

## Source of truth

The Cloudflare Worker deployment workflow and D1 migrations are maintained in the canonical repository. The `worker/index.js` file in this preview repository is a reference mirror only; GitHub Pages does not deploy it.
