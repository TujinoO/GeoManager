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
| API-20260616-001 | Implementing | Multiple catalog/admin/auth endpoints | new endpoints, response fields, permission behavior | Done | Updating | Implementing | Pending | Layer workspace snapshots, upload duplicate detection, data overview stats |
| API-20260617-001 | BackendReady | POST /api/auth/guest-login/ | new endpoint, permission behavior | Done | N/A | Done | Done | Dedicated guest login account and group |
| API-20260617-002 | BackendReady | POST /api/catalog/workspaces/; POST /api/catalog/workspaces/{workspaceId}/ | request body, status code | Done | N/A | Done | Done | Workspace snapshots store references, not raw data |
| API-20260618-001 | ContractReady | GET /api/catalog/resources/{id}/nongeo-analytics/; POST /api/catalog/resources/{id}/table-query/ | new endpoint, response fields, permission behavior, mock data | Done | Done | Pending | Pending | Non-geographic table analytics workspace |
| API-20260619-001 | Implementing | POST /api/catalog/import/commit/; GET /api/admin/data/resources/; POST /api/admin/data/resources/{id}/ | request body, response fields, permission behavior, mock data | Done | Updating | Implementing | Pending | Uploaded data visibility scope |
| API-20260619-002 | Verified | Multiple mock example endpoints | mock data consistency | N/A | Done | N/A | Done | Align representative auth, vector, raster, and non-geographic mock data |
| API-20260619-003 | BackendReady | POST /api/catalog/import/preview/; POST /api/catalog/import/validate/; POST /api/catalog/import/commit/ | request body, response semantics, mock data | Done | Done | Done | Done | Import storage IDs unique; duplicate detection uses display name |
| API-20260620-001 | BackendReady | GET /api/admin/system-logs/ | new endpoint, response fields, permission behavior, mock data | Done | Done | Done | Pending | System log file selector for admin logs page |
| API-20260620-002 | ContractReady | GET/POST /api/admin/workspaces/; GET/POST /api/admin/achievements/ | new endpoints, request body, response fields, permission behavior, mock data | Done | Done | Pending | Pending | Shared management UI for 工程、专题 and 成果 |

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

## API-20260616-001 - Workspace Snapshots, Upload Stats, and Data Overview

- Status: Implementing
- Owner: Frontend / Backend
- Endpoints: `GET/POST /api/catalog/workspaces/`, `GET/POST /api/catalog/workspaces/{workspaceId}/`, `POST /api/catalog/import/preview/`, `POST /api/catalog/import/validate/`, `POST /api/catalog/import/commit/`, `GET /api/auth/me/`, `GET /api/users/`, `GET /api/admin/dashboard/`, `GET /api/admin/data/resources/`
- Change type: new endpoint, response fields, request body, permission behavior, mock data
- OpenAPI change: Adds private workspace scene APIs for `project` and `topic`; import preview/validate responses include duplicate target metadata; import endpoints accept `core.upload_data` or `catalog.maintain_dataresource`; user permissions include `canUploadData`, `canViewDataOverview`, and `groupPermissions`; Dashboard may include `dataOverview`; data resources include `sizeBytes`, `itemCount`, and structured `uploader`.
- Mock examples: `mock/prism/examples/10-admin-auth.json`, `mock/prism/examples/20-admin-dashboard-data.json`, `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: Support one-step query-and-load, blocking duplicate upload warnings, local layer autosave with explicit server save as 工程/专题, Dashboard data overview, and clearer inherited-vs-direct permission display.
- Backend implementation notes: Add `WorkspaceScene`; persist `DataResource.size_bytes` and `item_count`; treat `DataResource.maintainer` as uploader; enforce workspace ownership; reject duplicate import targets when duplicate names are not confirmed; initialize default `普通用户` group with upload/load/query permissions.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`, plus backend workspace/import/dashboard/auth tests.
- Result: Backend and frontend implementation in progress.

## API-20260619-001 - Uploaded Data Visibility Scope

- Status: Implementing
- Owner: Frontend / Backend
- Endpoints: `POST /api/catalog/import/commit/`, `GET /api/admin/data/resources/`, `POST /api/admin/data/resources/{id}/`
- Change type: request body, response fields, permission behavior, mock data
- OpenAPI change: Import commit payload may include `accessGroupIds`; admin data resources return access group metadata with `isGuest`/`isSuperadmin` and per-resource `canManageAccess`; admin resource update allows uploaders to execute `updateAccess` for their own resources while other maintenance actions still require `catalog.maintain_dataresource`.
- Mock examples: `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: Upload and inventory flows must let users choose data visibility: uploader always visible, superadmin always visible, optional user groups, with an explicit warning when the guest group is selected.
- Backend implementation notes: Store visibility in `DataResource.access_groups`, force-add the `超级管理员` group, treat `DataResource.maintainer` as uploader ownership, and keep historical resources with no maintainer and no access groups public.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`, plus backend catalog/admin permission tests.
- Result: Implementation in progress.

## API-20260619-002 - Mock Example Business Consistency

- Status: Verified
- Owner: Frontend
- Endpoints: `POST /api/auth/register/`, `GET /api/catalog/resources/`, `POST /api/catalog/scan/`, `GET /api/catalog/resources/{id}/profile/`, `POST /api/catalog/resources/{id}/query/`, `GET /api/layers/`, `GET /api/layers/{layer_name}/features/`, `GET /api/layers/{layer_name}/profile/`, `POST /api/layers/{layer_name}/query/`, `GET /api/catalog/resources/{id}/nongeo-analytics/`, `POST /api/catalog/resources/{id}/table-query/`
- Change type: mock data
- OpenAPI change: None; endpoint shapes, status codes, permissions, and generated frontend API types are unchanged.
- Mock examples: `mock/prism/examples/00-public-auth.json`, `mock/prism/examples/30-catalog-vector.json`, `mock/prism/examples/35-catalog-nongeo.json`
- Frontend reason: Representative Prism data must use one coherent business scenario so tests and local UI development can exercise realistic interactions across login, resource listing, vector querying, raster layer references, and non-geographic table analysis.
- Backend implementation notes: No backend implementation required. Existing backend behavior already controls real data; this entry only documents mock fixture corrections.
- Verification: run `cd frontend && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build && pnpm test`, plus the mock consistency test in `frontend/src/test/mockExamples.test.ts`.
- Result: Mock examples aligned and verified by automated consistency checks.

## API-20260619-003 - Import Display Name Duplicate Detection

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `POST /api/catalog/import/preview/`, `POST /api/catalog/import/validate/`, `POST /api/catalog/import/commit/`
- Change type: request body, response semantics, mock data
- OpenAPI change: `ImportDuplicateTarget.targetType` now reports `data_resource_name`; preview duplicate detection uses `suggestedName`; validate and commit use payload `name`; `suggestedTableName` is documented as a backend storage identifier suggestion that is unique per precheck and may be rewritten by the backend at commit time.
- Mock examples: `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: The UI display name is what users perceive as “same data”. Backend storage IDs must not be reused across uploads, and duplicate warnings must not be based on hidden table/layer IDs.
- Backend implementation notes: Generate a new storage table/layer identifier for every preview/commit; if a submitted storage identifier collides, rewrite it to a unique one. Always create a new `DataResource` on import. Reject same display name at commit unless the user confirmed the duplicate name during validation and submit includes `duplicateConfirmed=true`; never overwrite existing backend data.
- Verification: run backend catalog import tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`.
- Result: Backend implementation and focused tests completed in this change.

## API-20260620-001 - Admin System Log Viewer

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/admin/system-logs/`
- Change type: new endpoint, response fields, permission behavior, mock data
- OpenAPI change: Adds a read-only admin system log endpoint that returns available backend log files and tail content for a selected file. The endpoint requires `core.view_operation_logs`, accepts `file` and `lines`, and restricts file access to configured appdata `logs/` entries.
- Mock examples: `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: The existing backend logs page only shows operation audit records; system administrators need to inspect backend application, Django, and security logs from the same logs area.
- Backend implementation notes: Read only `.log` and rotated `.log.N` files from `app_path("logs")`, never return absolute paths, cap returned tail lines, and reject unknown file names.
- Verification: run backend core API tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`.
- Result: Contract and implementation completed; full verification pending current change validation.

## API-20260620-002 - Managed Workspaces and Achievements

- Status: ContractReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/admin/workspaces/`, `POST /api/admin/workspaces/{workspaceId}/`, `GET /api/admin/achievements/`, `POST /api/admin/achievements/{achievementId}/`
- Change type: new endpoint, request body, response fields, permission behavior, mock data
- OpenAPI change: Adds admin management responses for 工程/专题 and 成果 with pagination, status, owner, access groups, `canManageAccess`, and update actions for `update`, `setStatus`, `updateAccess`, and `delete`.
- Mock examples: `mock/prism/examples/25-admin-managed-assets.json`
- Frontend reason: The resource management area now needs 工程、专题 and 成果 management pages with the same interaction model as 存量数据: list, filter, status control, information editing, visibility group configuration, and deletion confirmation.
- Backend implementation notes: Implement Django admin APIs that reuse `WorkspaceScene` ownership rules and the achievements model/service. `catalog.maintain_dataresource` can maintain all records; owners may update access scope on their own 工程/专题 when `canManageAccess=true`. Enforce object-level access group filtering for normal browse/search/load endpoints and write all user-triggered changes to `OperationLog` with Chinese module/action text.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`, plus backend API tests for list filtering, update actions, owner-only access updates, permission denial, deletion confirmation, and audit log creation.
- Result: Frontend contract and mock are ready; backend implementation pending.

## API-20260617-002 - Workspace Snapshot Raw Data Guard

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `POST /api/catalog/workspaces/`, `POST /api/catalog/workspaces/{workspaceId}/`
- Change type: request body, status code
- OpenAPI change: Clarifies that `WorkspaceSceneSnapshot` is a lightweight snapshot containing layer structure, query conditions, spatial ranges, resource references, symbolization, raster rendering references, and view state; raw GeoJSON feature collections, table rows, and query result data bodies are not allowed. Oversized workspace save requests return 413.
- Mock examples: N/A; behavior is covered by backend integration tests rather than Prism examples.
- Frontend reason: Saving 工程/专题 must persist how to reproduce the current workspace, not duplicate source/query data into `WorkspaceScene.snapshot`.
- Backend implementation notes: Reject snapshots containing `geojson` or `FeatureCollection.features`; check workspace save body size before reading `request.body` to avoid `RequestDataTooBig` security log tracebacks.
- Verification: run backend workspace API tests and `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`.
- Result: Backend guard and frontend lightweight snapshot serialization implemented.

## API-20260617-001 - Dedicated Guest Login

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `POST /api/auth/guest-login/`
- Change type: new endpoint, permission behavior
- OpenAPI change: Adds public CSRF-protected guest login endpoint returning the existing `LoginResponse`; documents dedicated `guest` account and separate `游客` group permissions.
- Mock examples: N/A
- Frontend reason: Login page needs a no-password visitor entry while keeping visitor permissions distinct from registered normal users.
- Backend implementation notes: Create or repair the `guest` account with unusable password, active state, display name “游客”, and only the `游客` group. Protect the account from delete, disable, password reset, group changes, and direct permission updates.
- Verification: run backend auth/admin tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`.
- Result: Implemented in backend and ready for frontend verification.

## API-20260618-001 - Non-Geographic Table Analytics

- Status: ContractReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/catalog/resources/{id}/nongeo-analytics/`, `POST /api/catalog/resources/{id}/table-query/`
- Change type: new endpoint, response fields, permission behavior, mock data
- OpenAPI change: Adds a non-geographic resource analytics response for table/gene resources, including resource summary, field profiles, categorical distributions, numeric distributions, correlation matrix, table preview, and short insights. Adds a table query endpoint returning rows rather than GeoJSON, with attribute filters, sorting, limit, and offset.
- Mock examples: `mock/prism/examples/35-catalog-nongeo.json`; `mock/prism/examples/30-catalog-vector.json` now includes a representative table resource in the resource list.
- Frontend reason: `/nongeo` needs a rich analysis workspace for ecological table data without reusing vector GeoJSON query semantics or adding backend-specific assumptions in React.
- Backend implementation notes: Implement read-only Django endpoints under catalog. `nongeo-analytics` should support `table` and `gene` DataResource records visible to the current user, derive stats from the SQLite table or relevant non-geographic storage, cap expensive distinct/top-N/correlation work, and return `400` for unsupported spatial-only resource types. `table-query` should apply the same attribute operators as `AttributeFilter`, support deterministic pagination/sorting, and never include geometry. Enforce `core.browse_data` for analytics and `core.query_data` for row query; continue applying DataResource `access_groups`.
- Verification: run backend catalog API tests for table/gene resources, permission denial tests, Prism mock build, and frontend API generation/type checks.
- Result: Backend implementation pending; frontend can develop against the contract and Prism mock without modifying backend code.
