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
| API-20260618-001 | Blocked | Non-geographic analytics workspace | endpoint design paused | Removed | Demo only | N/A | Pending | Non-geographic backend contract is not finalized; `/nongeo` remains frontend demo only |
| API-20260619-001 | Implementing | POST /api/catalog/import/commit/; GET /api/admin/data/resources/; POST /api/admin/data/resources/{id}/ | request body, response fields, permission behavior, mock data | Done | Updating | Implementing | Pending | Uploaded data visibility scope |
| API-20260619-002 | Verified | Multiple mock example endpoints | mock data consistency | N/A | Done | N/A | Done | Align representative auth, vector, raster, and non-geographic mock data |
| API-20260619-003 | BackendReady | POST /api/catalog/import/preview/; POST /api/catalog/import/validate/; POST /api/catalog/import/commit/ | request body, response semantics, mock data | Done | Done | Done | Done | Import storage IDs unique; duplicate detection uses display name |
| API-20260620-001 | BackendReady | GET /api/admin/system-logs/ | new endpoint, response fields, permission behavior, mock data | Done | Done | Done | Pending | System log file selector for admin logs page |
| API-20260620-002 | BackendReady | Data/workspace CRUD endpoints | permission behavior, response fields, new endpoint, request body | Done | N/A | Done | Done | Fine-grained CRUD permissions for data and workspace scenes |
| API-20260620-003 | BackendReady | GET /api/admin/operation-logs/ | response fields, query parameters | Done | N/A | Done | Done | Structured audit target fields for data and workspace scenes |
| API-20260620-004 | BackendReady | GET/POST /api/admin/workspaces/ | new endpoints, request body, response fields, permission behavior, mock data | Done | Done | Done | Pending | Shared management UI for 工程、专题 |
| API-20260620-005 | BackendReady | POST /api/admin/profile/avatar/; GET /api/users/{userId}/avatar/ | contract coverage | Done | N/A | Done | Pending | Existing avatar endpoints added to OpenAPI and generated SDK |
| API-20260620-006 | BackendReady | Multiple catalog/auth endpoints | removed endpoints, response fields, permission behavior | Done | Done | Done | Pending | Remove previous temporary GeoPackage resources and broad maintenance flag |
| API-20260620-007 | BackendReady | POST /api/users/{userId}/permissions/; POST /api/catalog/export/; POST /api/catalog/export/async/ | request body, response fields, permission behavior | Done | Done | Done | Pending | User permission close overrides and vector export format selection |
| API-20260620-008 | BackendReady | GET /api/admin/dashboard/ | response fields | Done | N/A | Done | Pending | Split data overview into own uploads and visible resources |
| API-20260620-009 | BackendReady | GET /api/admin/data/resources/; GET /api/admin/data/resources/export/; POST /api/admin/data/resources/{id}/; GET /api/layers/; GET /api/catalog/directories/ | permission behavior | Done | N/A | Done | Done | Admin inventory and catalog object visibility scope |
| API-20260620-010 | BackendReady | Auth/admin principal endpoints and operation logs | response fields, permission behavior | Done | N/A | Done | Done | Hide superadmin principals from non-superadmin users and always allow own operation logs |
| API-20260621-001 | Verified | Auth/admin dashboard mock endpoints | mock data | N/A | Done | N/A | Done | Align Prism examples with existing OpenAPI-required fields |
| API-20260621-002 | Verified | GET /api/users/; GET /api/groups/; GET /api/admin/data/resources/ | mock data | N/A | Done | N/A | Done | Exercise non-superadmin admin responses without superadmin principals |
| API-20260621-003 | BackendReady | GET /api/admin/data/resources/; POST /api/admin/data/resources/{id}/; POST /api/catalog/import/commit/ | permission behavior | Done | N/A | Done | Done | Hide superadmin from configurable access-role choices for every user |
| API-20260621-004 | BackendReady | POST /api/auth/guest-login/ | permission behavior | Done | N/A | Done | Done | Clarify that guest starts with no default function permissions |
| API-20260622-001 | BackendReady | POST /api/raster/import/; GET /api/raster/jobs/{job_id}/ | request body, mock data | Done | Done | Done | Pending | Browser raster upload starts async preprocessing, exposes progress, and keeps display names separate from storage IDs |
| API-20260622-002 | BackendReady | GET /api/raster/tiles/{dataset_id}/{style_hash}/{z}/{x}/{y}.png | status code | Done | N/A | Done | Pending | Raster tiles outside dataset extent return 204 and frontend constrains Mapbox requests with source bounds |
| API-20260622-003 | BackendReady | GET /api/auth/me/; admin user/profile auth responses | response fields, permission behavior, mock data | Done | Done | Done | Pending | Add independent data backup permission, defaulting to superadmin only |
| API-20260622-004 | BackendReady | GET /api/auth/me/ | response fields, permission behavior, mock data | Done | Done | Done | Pending | Gate AI interpretation with a new feature permission and map PNG export with existing data export permission |
| API-20260623-001 | BackendReady | GET /api/admin/dashboard/ | response fields, permission behavior | Done | N/A | Done | Done | Own upload dashboard overview no longer requires data overview permission |

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

## API-20260623-001 - Dashboard Own Upload Overview Permission Split

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/admin/dashboard/`
- Change type: response fields, permission behavior
- OpenAPI change: `AdminDashboardDataOverviewCard` now only requires `ownUploads`; `visibleResources`, compatibility top-level totals, and `uploaders` are optional permission-gated fields.
- Mock examples: N/A; existing dashboard mock keeps the authorized shape with both overview tabs.
- Frontend reason: 数据概览需要拆成“我上传的”和“我可见的”两个标签页，其中“我上传的”不应依赖 `core.view_data_overview`。
- Backend implementation notes: Always return `dataOverview.ownUploads` for authenticated dashboard requests. Only add `visibleResources`, top-level system totals, and superadmin uploader statistics when `core.view_data_overview` is granted.
- Verification: Run backend dashboard API tests, regenerate/check frontend API types, and run frontend dashboard tests.
- Result: Backend and frontend implementation included in this change; verification recorded in completion report.

## API-20260622-001 - Browser Raster Upload With Async Preprocessing

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `POST /api/raster/import/`, `GET /api/raster/jobs/{job_id}/`
- Change type: request body, mock data
- OpenAPI change: `POST /api/raster/import/` now accepts `multipart/form-data` with binary `file` and optional `name` in addition to the existing JSON `sourcePath` request. Successful browser uploads return the existing `AsyncJobResponse` with `kind=import`; progress remains available from the existing job polling endpoint. `name` is the frontend display name and must not include backend storage IDs such as uploaded-file UUID prefixes.
- Mock examples: `mock/prism/examples/40-raster.json`
- Frontend reason: The data import page needs direct raster file selection, automatic backend preprocessing, and realtime progress display without putting raster processing in React.
- Backend implementation notes: Save uploaded source files under the TOML-driven `raster/original/uploaded/` directory, validate raster extensions, start the existing import job, and keep permission checks on `raster.manage_raster_dataset`. Use UUID-prefixed filenames only for storage paths and stable resource codes; keep `RasterDataset.name`, `DataResource.name`, and `MapLayer.name` as the user-facing data name.
- Verification: run backend raster API tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`.
- Result: Backend endpoint, frontend upload UI, and browser test are included in this change; full verification pending.

## API-20260622-002 - Raster Tile Extent Boundaries

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/raster/tiles/{dataset_id}/{style_hash}/{z}/{x}/{y}.png`
- Change type: status code
- OpenAPI change: Tile requests outside the raster dataset extent now return `204 No Content`; successful in-range tiles still return `200 image/png`, and invalid or expired styles still return `404`.
- Mock examples: N/A
- Frontend reason: Mapbox must not flood the backend with viewport-wide tile requests for small raster extents, and any unavoidable outside-extent request should be cheap and explicit.
- Backend implementation notes: Check dataset Web Mercator bounds before opening the raster file; map outside-extent requests to `204`.
- Verification: run backend raster tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`.
- Result: Backend status handling and frontend source `bounds` are included in this change; full verification pending.

## API-20260622-003 - Data Backup Permission

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/auth/me/`, admin user/profile auth responses
- Change type: response fields, permission behavior, mock data
- OpenAPI change: `UserPermissions` adds `canManageDataBackup`, backed by `core.manage_data_backup`.
- Mock examples: `mock/prism/examples/00-public-auth.json`, `mock/prism/examples/10-admin-auth.json`
- Frontend reason: The new backend data backup page must be gated by an independent permission instead of system settings permission.
- Backend implementation notes: Register `core.manage_data_backup` as a feature permission, lock it into the superadmin group, and do not add it to default ordinary or guest roles.
- Verification: run backend core permission/auth tests and frontend API generation/checks.
- Result: Permission registry, default-role behavior, frontend route guard, and UI menu gating are included in this change; full verification pending.

## API-20260620-007 - User Permission Disable Overrides And Export Format

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `POST /api/users/{userId}/permissions/`, `POST /api/catalog/export/`, `POST /api/catalog/export/async/`
- Change type: request body, response fields, permission behavior
- OpenAPI change: `UserInfo` now returns `disabledPermissions`, and the user permission update request accepts `disabledPermissions` so admins can close role-inherited or directly granted permissions per user. Export requests now accept `format=geojson|shapefile` for vector layers; downloads remain ZIP responses and export request parsing is not constrained by Django upload-memory limits.
- Mock examples: `mock/prism/examples/10-admin-auth.json`
- Frontend reason: The permission UI needs inherited role permissions to be individually closable, and data download must let users choose Shapefile or GeoJSON.
- Backend implementation notes: Store closed permissions on `UserProfile.disabled_permissions`, filter them against granted permissions, preserve server-side permission checks, and package Shapefile component files into the ZIP when requested.
- Verification: run backend core/catalog export tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`.
- Result: Backend and frontend implementation included in this change; full verification pending.

## API-20260620-009 - Admin Inventory Object Visibility Scope

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/admin/data/resources/`, `GET /api/admin/data/resources/export/`, `POST /api/admin/data/resources/{id}/`, `GET /api/layers/`, `GET /api/catalog/directories/`
- Change type: permission behavior
- OpenAPI change: Admin inventory list, export, and single-resource actions now apply data object visibility: non-superadmin users only see or operate resources visible to their groups or uploaded by themselves; inaccessible resources are treated as not found for single-resource actions. Catalog layer lists also hide layers whose associated data resource is not visible, and catalog directory resources are trimmed to the current user's data visibility. Superadmin visibility remains unrestricted.
- Mock examples: N/A
- Frontend reason: The backend inventory page, layer panel, and catalog tree must not reveal data that the current user cannot load or access in catalog workflows.
- Backend implementation notes: Apply `filter_accessible` to admin inventory list/export querysets and check `user_can_access` before action-specific permissions in single-resource updates. Use combined MapLayer and related DataResource access filtering for layer lists; trim directory resource arrays by `user_can_access`.
- Verification: run focused backend admin data resource tests and frontend API contract checks.
- Result: Backend behavior and regression tests included in this change.

## API-20260620-010 - Principal Visibility And Own Operation Logs

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/auth/me/`, `GET /api/users/`, `POST /api/users/{userId}/`, `POST /api/users/{userId}/groups/`, `POST /api/users/{userId}/permissions/`, `GET /api/groups/`, `POST /api/groups/{groupId}/`, `GET /api/admin/operation-logs/`, `GET /api/admin/system-logs/`, admin data/workspace access-group responses
- Change type: response fields, permission behavior
- OpenAPI change: `UserPermissions` adds `canViewSystemLogs`; non-superadmin subjects no longer receive superadmin users, groups, access groups, or logs; operation logs are available to every authenticated user for their own records; system logs are controlled by `core.view_system_logs`.
- Mock examples: N/A
- Frontend reason: Ordinary users must not be able to infer that a superadmin account or role exists, while still being able to audit their own actions.
- Backend implementation notes: Centralize principal visibility through backend queryset helpers, apply it to user/group/log/access-group responses, and keep forced superadmin access in storage/permission internals.
- Verification: run backend core/catalog API tests and frontend API generation/type checks.
- Result: Backend and frontend implementation included in this change.

## API-20260621-001 - Prism Mock Schema Alignment

- Status: Verified
- Owner: Frontend
- Endpoints: `POST /api/auth/login/`, `POST /api/auth/register/`, `GET /api/auth/me/`, admin auth user/profile endpoints, `GET /api/admin/dashboard/`, `GET /api/admin/data/resources/`
- Change type: mock data
- OpenAPI change: None. At the time of this mock alignment, schemas required `UserPermissions.canViewSystemLogs`, `AdminDashboardDataOverviewCard.ownUploads`, `AdminDashboardDataOverviewCard.visibleResources`, and structured `DictionaryItem` category values. `API-20260623-001` later made `visibleResources` permission-gated and optional.
- Mock examples: `mock/prism/examples/00-public-auth.json`, `mock/prism/examples/10-admin-auth.json`, `mock/prism/examples/20-admin-dashboard-data.json`, `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: Prism-backed browser and performance checks should run without response validation errors from stale mock fixtures.
- Backend implementation notes: No backend implementation required; real backend contract is unchanged.
- Verification: run `cd frontend && pnpm run mock:build && pnpm run api:changes:check && pnpm test -- src/test/mockExamples.test.ts && pnpm run perf:mock -- --label codex-e2e-check`.
- Result: Mock fixtures updated to match the current OpenAPI contract; verification completed in this change.

## API-20260621-002 - Non-Superadmin Principal Mock Isolation

- Status: Verified
- Owner: Frontend
- Endpoints: `GET /api/users/`, `GET /api/groups/`, `GET /api/admin/data/resources/`
- Change type: mock data
- OpenAPI change: None. Existing schemas already allow filtered user, role, uploader, maintainer, and access-role responses.
- Mock examples: `mock/prism/examples/10-admin-auth.json`, `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: Browser and Prism-backed permission checks need default admin-auth/data examples that represent a non-superadmin manager and therefore contain no superadmin user, role, log-role, uploader, or access-role principals.
- Backend implementation notes: No backend implementation required; real backend filtering is implemented by principal visibility helpers.
- Verification: run `cd frontend && pnpm run mock:build && pnpm run api:changes:check`.
- Result: Mock fixtures demonstrate non-superadmin responses with superadmin principals omitted before frontend rendering.

## API-20260621-003 - Configurable Access Role Options Exclude Superadmin

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/admin/data/resources/`, `POST /api/admin/data/resources/{id}/`, `POST /api/catalog/import/commit/`
- Change type: permission behavior
- OpenAPI change: `availableAccessGroups` and `accessGroupIds` descriptions now state that the superadmin role is never a manually selectable access role. The backend still force-adds the superadmin role internally.
- Mock examples: N/A
- Frontend reason: The data import page already shows “我自己可见”; showing “超级管理员” to a superadmin user duplicates their own visibility and makes the forced internal rule look user-configurable.
- Backend implementation notes: Use a dedicated selectable-access-role helper for access-scope option lists and request validation. Do not change auth role management visibility.
- Verification: run focused catalog import/admin data resource tests plus frontend API generation/checks.
- Result: Backend behavior and generated frontend API descriptions included in this change.

## API-20260621-004 - Guest Login Default Permission Clarification

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `POST /api/auth/guest-login/`
- Change type: permission behavior
- OpenAPI change: Corrects the guest-login description to state that the dedicated `游客` role starts without function permissions; administrators may grant guest role permissions later.
- Mock examples: N/A
- Frontend reason: Login and authorization UI should not assume public visitors can browse, query, or load layers until the administrator grants those permissions.
- Backend implementation notes: Existing initialization keeps `guest_permissions=()` and preserves later role permission customization; backend auth tests now assert the no-default-permissions behavior.
- Verification: run focused backend auth tests plus `cd frontend && pnpm run check:api && pnpm run api:changes:check`.
- Result: Backend behavior already matches the clarified contract; tests updated to prevent drift.

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
- OpenAPI change: Adds private workspace scene APIs for `project` and `topic`; import preview/validate responses include duplicate target metadata; import endpoints use current CRUD permissions; user permissions include `canUploadData`, `canViewDataOverview`, and `groupPermissions`; Dashboard may include `dataOverview`; data resources include `sizeBytes`, `itemCount`, and structured `uploader`.
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
- OpenAPI change: Import commit payload may include `accessGroupIds`; admin data resources return access group metadata with `isGuest`/`isSuperadmin` and per-resource `canManageAccess`; admin resource update allows uploaders to execute `updateAccess` for their own resources while other maintenance actions require current CRUD permissions.
- Mock examples: `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: Upload and inventory flows must let users choose data visibility: uploader always visible, superadmin always visible, optional user groups, with an explicit warning when the guest group is selected.
- Backend implementation notes: Store visibility in `DataResource.access_groups`, force-add the `超级管理员` group, and treat `DataResource.maintainer` as uploader ownership.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`, plus backend catalog/admin permission tests.
- Result: Implementation in progress.

## API-20260619-002 - Mock Example Business Consistency

- Status: Verified
- Owner: Frontend
- Endpoints: `POST /api/auth/register/`, `GET /api/catalog/resources/`, `POST /api/catalog/scan/`, `GET /api/catalog/resources/{id}/profile/`, `POST /api/catalog/resources/{id}/query/`, `GET /api/layers/`
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

## API-20260620-002 - Fine-Grained CRUD Permissions

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/auth/me/`, `GET /api/admin/data/resources/`, `POST /api/admin/data/resources/{id}/`, `POST /api/catalog/import/preview/`, `POST /api/catalog/import/validate/`, `POST /api/catalog/import/commit/`, `GET/POST /api/catalog/workspaces/`, `GET/POST /api/catalog/workspaces/{workspaceId}/`
- Change type: permission behavior, response fields, new endpoint, request body
- OpenAPI change: Replaces coarse data maintenance checks with `catalog.add/view/change/delete_dataresource`, adds `catalog.add/view/change/delete_workspacescene` checks for project/topic snapshots, adds workspace scene create/detail/update/delete permission fields in `UserPermissions`.
- Mock examples: N/A
- Frontend reason: UI needs separate add, view, edit, and delete capability checks for data and project/topic workspace snapshots instead of one broad maintenance permission.
- Backend implementation notes: Keep object-level access groups and workspace ownership checks; allow uploaders to update only their own data visibility; continue writing operation logs for user-triggered create/update/delete actions.
- Verification: run backend catalog/core permission tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`.
- Result: Backend implementation and focused tests completed in this change.

## API-20260620-003 - Structured Audit Targets

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/admin/operation-logs/`
- Change type: response fields, query parameters
- OpenAPI change: `AdminOperationLog` now returns `targetType`, `targetId`, `targetCode`, and `targetName`; the operation log list accepts `targetType` and `targetId` query filters, and keyword search includes target fields.
- Mock examples: N/A
- Frontend reason: Audit log UI must trace create/read/update/delete operations to a specific data resource, project/topic workspace scene, by backend ID instead of relying on mutable names inside summary text.
- Backend implementation notes: Store structured target fields on `OperationLog`; write `data_resource`, `workspace_scene`, targets from the relevant backend views, preserving target ID/name before delete.
- Verification: run backend audit, catalog, and core operation-log tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`.
- Result: Backend implementation and focused tests completed in this change.

## API-20260620-008 - Dashboard Data Overview Scopes

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/admin/dashboard/`
- Change type: response fields
- OpenAPI change: Adds `dataOverview.ownUploads` and `dataOverview.visibleResources`, each with resource totals, active counts, total size, item counts, and type breakdown. Existing top-level `dataOverview` totals remain for compatibility.
- Mock examples: N/A; dashboard examples are not currently split into Prism fixtures.
- Frontend reason: The data overview page must present “我上传的” and “我可见的” separately instead of a single total.
- Backend implementation notes: Use `DataResource.maintainer=current_user` for `ownUploads`; use the existing catalog access filter for `visibleResources` so the backend keeps enforcing visibility rules. Do not expose or require the forced superadmin access group in frontend permission selectors.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`, focused backend dashboard tests, and frontend checks/tests.
- Result: Implemented in this change.

## API-20260620-004 - Managed Workspaces

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/admin/workspaces/`, `POST /api/admin/workspaces/{workspaceId}/`
- Change type: new endpoint, request body, response fields, permission behavior, mock data
- OpenAPI change: Adds admin management responses for 工程/专题 with pagination, status, owner, access groups, `canManageAccess`, and update actions for `update`, `setStatus`, `updateAccess`, and `delete`.
- Mock examples: `mock/prism/examples/25-admin-managed-assets.json`
- Frontend reason: The resource management area now needs 工程、专题 management pages with the same interaction model as 存量数据: list, filter, status control, information editing, visibility group configuration, and deletion confirmation.
- Backend implementation notes: Implement Django admin APIs that reuse `WorkspaceScene` ownership rules. Use `catalog.view/change/delete_workspacescene` for 工程/专题 list, update, and delete behavior,. Owners may update access scope on their own 工程/专题 when `canManageAccess=true`. Enforce object-level access group filtering for normal browse/search/load endpoints and write all user-triggered changes to `OperationLog` with Chinese module/action text.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build`, plus backend API tests for list filtering, update actions, owner-only access updates, permission denial, deletion confirmation, and audit log creation.
- Result: Backend implementation and focused tests are covered by the current consistency repair; frontend verification still pending.

## API-20260620-005 - Avatar Endpoint Contract Coverage

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `POST /api/admin/profile/avatar/`, `GET /api/users/{userId}/avatar/`
- Change type: contract coverage, response fields
- OpenAPI change: Adds the existing avatar upload endpoint and avatar image endpoint to the canonical contract. Upload accepts multipart `avatar` and returns `AdminProfileResponse`; image fetch returns `image/jpeg` or standard JSON errors.
- Mock examples: N/A
- Frontend reason: Existing backend avatar APIs must be represented in generated SDK/types instead of remaining private hand-written fetch targets.
- Backend implementation notes: Existing Django views already validate JPG/PNG, cap upload size, compress to JPEG, store image bytes on `UserProfile`, and return `/api/users/{userId}/avatar/` through profile serialization.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`, plus backend core avatar tests if this behavior changes.
- Result: Contract added for existing backend behavior.

## API-20260622-004 - AI Interpretation Permission

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/auth/me/`
- Change type: response field, permission behavior
- OpenAPI change: Adds `UserPermissions.canUseAiInterpretation`, backed by the new `core.ai_interpretation` feature permission. `UserPermissions.canExportData` now explicitly also gates current-view map PNG export because it reuses the existing export capability.
- Mock examples: `mock/prism/examples/10-admin-auth.json`
- Frontend reason: The map workspace bottom-panel `AI智能解译` and `地图导出` tabs must be permission-gated instead of always visible.
- Backend implementation notes: Register `core.ai_interpretation` in feature permission metadata and Django model permissions; grant it to the default 普通用户 role alongside existing data permissions. Existing `catalog.export_dataresource` remains the authority for map PNG export.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`, frontend checks/tests, and backend core tests.
- Result: Implemented in backend contract metadata and frontend gating.

## API-20260620-006 - Remove Previous Catalog Compatibility Surface

- Status: BackendReady
- Owner: Frontend / Backend
- Endpoints: `GET /api/auth/me/`, `GET /api/catalog/resources/`, `POST /api/catalog/scan/`, `GET /api/catalog/resources/{id}/profile/`, `POST /api/catalog/resources/{id}/query/`, `GET /api/layers/`
- Change type: removed endpoint, response fields, permission behavior, mock data
- OpenAPI change: Removes the previous string-ID GeoPackage layer endpoints, removes the previous temporary resource schema, narrows `ResourceListItem` to `DataResource`, removes the broad maintenance flag from `UserPermissions`, and removes the old broad data-maintenance feature permission from current permission metadata.
- Mock examples: `mock/prism/examples/00-public-auth.json`, `mock/prism/examples/10-admin-auth.json`, `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: Fresh deployments should only support current registered data resources and fine-grained CRUD permissions. The UI no longer needs string-ID temporary resources or broad maintenance compatibility flags.
- Backend implementation notes: Resource listing/search/profile/query must operate only on `DataResource`; `/api/layers/` returns registered `MapLayer` records only; scanned and raster-imported resources must receive explicit access groups instead of relying on empty access-group public behavior.
- Verification: run backend catalog/core tests plus `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check && pnpm run mock:build && pnpm test`.
- Result: Backend and frontend implementation completed in this change; full verification pending.

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
