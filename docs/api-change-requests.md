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
| API-20260618-001 | Blocked | Non-geographic analytics workspace | endpoint design paused | Removed | Demo only | N/A | Pending | Non-geographic backend contract is not finalized; `/nongeo` remains frontend demo only |

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

## API-20260618-001 - Non-Geographic Table Analytics

- Status: Blocked
- Owner: Frontend
- Endpoints: none currently declared
- Change type: endpoint design paused
- OpenAPI change: Removes the previously proposed `/api/catalog/resources/{id}/nongeo-analytics/` and `/api/catalog/resources/{id}/table-query/` paths from the canonical contract while retaining frontend-side demo types for local UI exploration.
- Mock examples: Frontend demo only; no backend mock contract.
- Frontend reason: Non-geographic analysis design is not finalized, so backend implementation would lock in premature field profiling, statistics, filtering, and pagination semantics.
- Backend implementation notes: Do not implement non-geographic analytics/query endpoints until the product contract is reintroduced through `docs/openapi.yaml` and a new backend handoff.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`.
- Result: Deferred by product/design decision; `/nongeo` remains a front-end demo.
