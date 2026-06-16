# API Change Requests

This document is the frontend-to-backend handoff queue for API contract changes.

Frontend owns `docs/openapi.yaml` and `mock/prism/examples/*.json`. Whenever frontend changes an endpoint, response field, request body, status code, permission behavior, or mock example that requires backend implementation, add or update one API change entry here. Backend uses these entries to update Django behavior and tests.

## Status Definitions

- `Proposed`: Frontend has identified a requirement, but the contract or mock example may still be incomplete.
- `ContractReady`: `docs/openapi.yaml`, generated API types, and mock examples are ready for backend implementation.
- `Implementing`: Backend is implementing the contract.
- `BackendReady`: Backend implementation and backend tests are complete.
- `Verified`: Frontend has verified the real backend against the contract.
- `Blocked`: Contract, implementation, data, or permission behavior needs a decision before continuing.
- `Superseded`: Replaced by a later API change request.

## API Change Status Matrix

| ID | Status | Endpoint | Change Type | OpenAPI | Mock | Backend | Tests | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| API-20260615-001 | ContractReady | Multiple API endpoints | mock separation and JSON errors | Done | Done | Pending | Pending | Initial frontend/backend split contract |
| API-20260615-002 | ContractReady | GET /api/login/overview/ | new endpoint | Done | Done | Pending | Pending | Login page public overview contract |

## Entry Template

```markdown
## API-YYYYMMDD-001 - Short Change Title

- Status: Proposed | ContractReady | Implementing | BackendReady | Verified | Blocked | Superseded
- Owner: Frontend requester / backend implementer
- Endpoints: `METHOD /api/...`
- Change type: response fields | request body | status code | permission behavior | mock data | new endpoint | removed endpoint
- OpenAPI change: concise summary of schema/status/permission changes
- Mock examples: `mock/prism/examples/...json`
- Frontend reason: UI workflow or data requirement
- Backend implementation notes: expected service/view/test work
- Verification: commands or response checks required before marking implemented
- Result: current backend/frontend verification result
```

## API-20260615-001 - Initial Mock Separation Contract

- Status: ContractReady
- Owner: Frontend / Backend
- Endpoints: multiple endpoints in `docs/openapi.yaml`
- Change type: mock data, status code, permission behavior
- OpenAPI change: APIs must return JSON error bodies for unauthenticated and CSRF failures; response examples define representative auth, admin, catalog, vector, and raster data.
- Mock examples: `mock/prism/examples/*.json`
- Frontend reason: support frontend development against Prism without a running backend.
- Backend implementation notes: ensure real Django responses conform to `docs/openapi.yaml`, especially `401 {"detail":"请先登录"}` and `403 {"detail":"CSRF 验证失败"}` for API requests.
- Verification: run backend API tests plus `cd frontend && pnpm run check:api && pnpm run mock:build`.
- Result: backend implementation pending final owner verification.
## API-20260615-002 - Login Page Public Overview

- Status: ContractReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/login/overview/`
- Change type: new endpoint, response fields, mock data
- OpenAPI change: Adds a public login overview response containing platform brand text, hero copy, capability tags, four metric cards, service status summary, node legend, and footer statistics notice.
- Mock examples: `mock/prism/examples/05-login-overview.json`
- Frontend reason: The rebuilt login page currently preserves the approved visual design with static display values, but the data structure must be contract-ready so future frontend work can replace static values with generated OpenAPI types after backend implementation.
- Backend implementation notes: Implement a no-auth Django API endpoint that returns only public overview data. Do not expose internal paths, user records, permission group details, server resource internals, or private data inventory. Recommended cache TTL is 60 seconds to 5 minutes.
- Verification: run backend API tests for `GET /api/login/overview/`, then run `cd frontend && pnpm run check:api && pnpm run mock:build`.
- Result: Backend implementation pending; frontend login UI remains visually unchanged and does not directly modify backend code.
