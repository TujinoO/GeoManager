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
| API-20260623-001 | Verified | `POST /api/raster/import/`, bootstrap/settings limits | validation/config behavior | Updated | N/A | Implemented | Passed | Raster uploads now enforce configured size and configured pixel side limits |
| API-20260623-002 | Verified | `POST /api/raster/import/` | documentation clarification | Updated | N/A | Implemented | Passed | Raster upload storage names are unique identifiers without original filenames |
| API-20260628-001 | Verified | `GET /api/data-schema/summary/`, `GET /api/germplasm/accessions/` | new endpoint | Updated | Added | Implemented | Passed | Adds 甲方数据分类数据库架子 and seed query surface |
| API-20260629-001 | BackendReady | `GET /api/catalog/resources/`, `POST /api/catalog/import/commit/` | field/query addition | Updated | Added | Implemented | Focused passed | Adds DataResource.domainType so workspace navigation can filter by confirmed geo/non-geo data types |
| API-20260630-001 | Verified | `GET/POST /api/groups/`, `POST /api/groups/{groupId}/` | permission behavior | Updated | Updated | Implemented | Focused passed | Adds platform/research built-in roles, narrows normal-user defaults, and documents protected-role behavior |
| API-20260701-001 | ContractReady | `GET /api/layers/`, admin data-resource visualization payloads | response/request schema clarification | Updated | Added | Pending | Pending | Documents vector unique-value symbolization, alias merge classes, and germplasm DNA sex default template without adding new endpoints |
| API-20260701-002 | BackendReady | `GET /api/map/thumbnail-tiles/{z}/{x}/{y}.png` | new endpoint | Updated | N/A | Implemented | Focused passed | Adds same-origin thumbnail tile proxy/cache so new client machines do not depend on direct third-party tile access |
| API-20260703-001 | Verified | `GET/POST /api/admin/backups/*` | new endpoint | Updated | Added | Implemented | Focused passed | Adds superadmin-only local/cloud data backup configuration, task execution, history, and target test APIs |
| API-20260703-002 | Verified | `POST /api/catalog/resources/{id}/query/` | response fields | Updated | Updated | Implemented | Focused passed | Adds spatial-query-workbench summary fields for truncation, returned bounds, and backend elapsed time |
| API-20260703-003 | Verified | `GET /api/layers/`, admin data-resource visualization payloads | schema clarification | Updated | Added | N/A | Passed | Adds vector graduated numeric symbolization under existing symbolization renderer without new endpoints |

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

## API-20260703-001 - Superadmin Data Backup

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/admin/backups/overview/`, `GET/POST /api/admin/backups/settings/`, `POST /api/admin/backups/targets/test/`, `GET/POST /api/admin/backups/runs/`, `GET /api/admin/backups/runs/{runId}/`, `GET /api/admin/backups/runs/{runId}/download/`
- Change type: new endpoint | request body | response fields | permission behavior | mock data | backend model
- OpenAPI change: Adds typed backup plans, local and S3-compatible object-storage target settings, target connection testing, manual backup task creation, task polling, history pagination, and local archive download. All endpoints require an authenticated built-in `超级管理员` subject; ordinary users remain forbidden even if mistakenly granted `core.manage_data_backup`.
- Mock examples: `mock/prism/examples/22-admin-backup.json`
- Frontend reason: The admin backup page needs a real typed workflow for configuring local/cloud targets, testing cloud parameters entered by superadmin users, starting backups, polling progress, and reviewing history without hand-written DTOs.
- Backend implementation notes: Add a persistent backup run model, TOML-backed backup configuration, local archive target, S3-compatible object-storage target, a lightweight scheduler/management command for automatic runs, operation-log writes for user-triggered configuration and backup actions, and strict response conformance to the new schemas.
- Verification: run OpenAPI lint/generation, Prism mock build, API change request check, focused backend backup API/service tests, frontend typecheck, and focused admin backup page tests.
- Result: OpenAPI lint, generated client typecheck, focused backend backup tests, Django check, mock example validation, and admin backup page lint/type checks passed. Browser rendering test remains dependent on the local Playwright Chromium binary.

## API-20260703-002 - Spatial Query Workbench Summary

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/catalog/resources/{id}/query/`
- Change type: response fields | mock data | documentation clarification
- OpenAPI change: Extends `QueryResponse` with `limitExceeded`, `bounds`, and `elapsedMs` so the bottom spatial query workbench can display a real query status, hit summary, returned result extent, truncation warning, and backend timing without inventing frontend-only fields. The endpoint permission remains unchanged: authenticated users must have both `core.query_data` and `core.load_vector_layer`, and must be allowed to access the target resource.
- Mock examples: `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: The new bottom spatial query workbench separates spatial-range querying from the left attribute query panel and needs typed result-summary fields before a temporary result is loaded into the layer tree.
- Backend implementation notes: Measure `vector_store.query_resource` elapsed time, set `limitExceeded` when filtered hits exceed the returned limit, compute `bounds` from returned valid GeoJSON features, and preserve the existing `totalCount`, `returnedCount`, `fields`, `geojson`, and `warnings` behavior.
- Verification: run OpenAPI lint/generation, Prism mock build, frontend typecheck, focused backend catalog query tests, and targeted frontend tests where practical.
- Result: OpenAPI lint, generated API client, Prism mock build, API change request check, frontend typecheck, focused backend query summary tests, and Django system check passed. Running the entire catalog query unit file still hits existing Windows GeoPackage file-lock cleanup failures in unrelated metadata tests.

## API-20260703-003 - Vector Graduated Numeric Symbolization Contract

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/layers/`, `POST /api/admin/data/resources/{id}/`
- Change type: response fields | request body | mock data | documentation clarification
- OpenAPI change: Extends `VectorRenderer` with `GraduatedRenderer` and `GraduatedSymbolClass` for existing `symbolization.renderer.type="graduated"`. The schema documents numeric field classification, `equalInterval` and `quantile` methods, class count, precision, color ramps, `classes[].min/max`, no-data default class, visibility, `gm-*` icon IDs, and existing `additionalProperties` compatibility.
- Mock examples: `mock/prism/examples/30-catalog-vector.json` adds a vector point layer whose `symbolization.renderer` classifies `海拔` into five equal-interval ranges using `gm-tree` and a green ramp.
- Frontend reason: The symbolization editor needs a typed continuous-field workflow for elevation, NDVI, salinity, and similar attributes that matches the existing unique-value editing model while preserving generated API contracts.
- Backend implementation notes: No new endpoint, permission, database migration, or server-side classifier is required. Existing JSONField storage, layer serialization, and admin default-visualization save behavior should pass this JSON object through unchanged and keep current permission behavior.
- Verification: run OpenAPI lint/generation, rebuild Prism mock, run focused frontend symbolization tests, frontend typecheck, backend Django check, and production build.
- Result: Verified with OpenAPI type generation, Prism mock bundle injection, Redocly lint, API change request check, focused frontend symbolization tests, frontend TypeScript checks, Django system check, and Vite production build. Redocly continues to report two pre-existing unused schema warnings unrelated to this change.

## API-20260701-002 - Same-Origin Map Thumbnail Tiles

- Status: BackendReady
- Owner: Backend implementer
- Endpoints: `GET /api/map/thumbnail-tiles/{z}/{x}/{y}.png`
- Change type: new endpoint
- OpenAPI change: Adds a public binary image endpoint for right-side map thumbnail tiles with `z/x/y` path parameters, `image/png`, `image/jpeg`, `image/webp`, `image/avif`, and `image/svg+xml` success responses, and standard error responses.
- Mock examples: N/A; binary tile responses are not represented in Prism examples.
- Frontend reason: Remote client browsers must not depend on direct access to third-party tile domains or stale browser cache for the main workspace thumbnail.
- Backend implementation notes: Proxy Mapbox/OSM according to `application.map`, cache successful tiles under the app data media directory while preserving the real image MIME type, and return a generated local Web Mercator 2D world map tile when the external source is unavailable and cache is empty.
- Verification: run focused frontend thumbnail tests, backend core thumbnail API tests, frontend typecheck, and production build.
- Result: Backend implementation and focused tests are complete; real deployment should verify that browser Network requests for the thumbnail use `/api/map/thumbnail-tiles/...`.

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

## API-20260623-001 - Raster Upload Size And Pixel Limits

- Status: Verified
- Owner: Frontend requester / backend implementer
- Endpoints: `POST /api/raster/import/`, `GET /api/bootstrap/`, `GET/POST /api/admin/settings/`
- Change type: status code | response fields | request body
- OpenAPI change: Documents upload validation for `application.limits.upload_max_mb` and `application.limits.max_raster_side_pixels`; adds `SystemLimits.maxRasterSidePixels` to bootstrap and admin settings payloads; validation failures continue to use the existing `400 ErrorResponse`.
- Mock examples: N/A; existing response schema is unchanged and the behavior is covered by frontend and backend tests.
- Frontend reason: Prevent unsupported large rasters from entering upload/preprocessing and surface immediate Chinese-facing validation feedback.
- Backend implementation notes: Uploaded files must be rejected before job creation when file size exceeds the configured limit or GDAL metadata reports width/height above the configured `max_raster_side_pixels`; `sourcePath` import and scan paths reuse the pixel-size limit.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`; run focused frontend import tests and backend raster API tests.
- Result: Verified with `pnpm run generate:api`, `pnpm run check:api`, `pnpm run api:changes:check`, focused frontend raster upload tests, and backend raster API tests.

## API-20260623-002 - Raster Upload Storage Name Clarification

- Status: Verified
- Owner: Backend implementer
- Endpoints: `POST /api/raster/import/`
- Change type: request body
- OpenAPI change: Clarifies `name` descriptions so frontend display names are separate from backend unique storage filenames; request and response shapes are unchanged.
- Mock examples: N/A
- Frontend reason: Avoid showing or depending on backend storage names that no longer include original uploaded filenames.
- Backend implementation notes: Browser-uploaded rasters are stored as `uploaded/<uuid><suffix>` while `RasterDataset.name`, `DataResource.name`, and `MapLayer.name` continue to use the submitted display name or original upload stem.
- Verification: run `cd frontend && pnpm run api:changes:check`; run backend raster import tests.
- Result: Backend tests verify uploaded storage filenames do not include original upload names.

## API-20260628-001 - Domain Schema And Germplasm Database Scaffold

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/data-schema/summary/`, `GET /api/germplasm/accessions/`
- Change type: new endpoint | response fields | permission behavior | mock data
- OpenAPI change: Adds read-only schema summary response for the confirmed customer data categories and a paginated germplasm accession list response. Both endpoints require an authenticated session and `core.browse_data`; errors use the standard `ErrorResponse`.
- Mock examples: `mock/prism/examples/45-domain-schema.json`
- Frontend reason: Data management needs a stable typed source for the new data classification/catalog skeleton and a first query surface for germplasm resources without hand-written DTOs.
- Backend implementation notes: Add scaffold models for standards/ecology/omics domains, include apps in Django settings, expose read-only summary/accession views, and keep existing `DataResource`, import, raster, and catalog behavior unchanged.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`; run backend model/API tests for the new endpoints and existing catalog smoke tests.
- Result: Verified with direct OpenAPI lint, OpenAPI type generation, API change request check, Prism mock bundle injection, Django check, focused backend endpoint tests, frontend TypeScript checks, and Vite build. `pnpm run check:api` was not run directly because the script contains `rm -rf`; existing catalog smoke coverage was sampled separately, with catalog startup/layer tests passing and `test_data_query.py` failing only during Windows temporary GeoPackage cleanup due locked files.

## API-20260629-001 - Catalog Resource Domain Type Filtering

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/catalog/resources/`, `POST /api/catalog/import/commit/`
- Change type: response fields | request body | status code | mock data
- OpenAPI change: Adds optional `DataResource.domainType`, `GET /api/catalog/resources/?domainType=` filtering, and `400 ImportErrorResponse` examples for missing or invalid import `domainType`. Import commit payload documentation now treats `domainType` as required business classification input and saves it on newly imported table/vector resources.
- Mock examples: `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: The top workspace navigation needs typed geo/non-geo dropdown choices that can synchronize with the left data panel without hand-written DTOs or hidden backend fields.
- Backend implementation notes: Add `DataResource.domain_type`, serialize it as `domainType`, filter resources by valid domain codes, reject missing or invalid import domain codes, store import payload domain types, and default raster catalog sync to `remote_sensing` and scanned gene files to `genome`.
- Verification: run OpenAPI lint, regenerate API types, rebuild Prism mock, run frontend typecheck, Django check, and focused backend domain filter tests.
- Result: Backend and frontend type-level verification passed. Broader catalog tests still hit existing Windows file-lock cleanup failures on GeoPackage/SQLite files, so the domain filter was verified with a focused test class that does not touch those files.

## API-20260630-001 - Built-In Role Permission Baseline

- Status: BackendReady
- Owner: Frontend/backend implementer
- Endpoints: `GET/POST /api/groups/`, `POST /api/groups/{groupId}/`
- Change type: permission behavior | mock data | documentation clarification
- OpenAPI change: Documents the five built-in roles (`超级管理员`, `平台管理员`, `科研用户`, `普通用户`, `游客`), protected-role delete/rename restrictions, superadmin-only locked permissions, and the `400 ErrorResponse` cases for protected role changes.
- Mock examples: `mock/prism/examples/10-admin-auth.json`
- Frontend reason: The authorization page needs a simpler operational role model where platform administration and data/system administration are merged, while normal users can still upload and view allowed data.
- Backend implementation notes: Create platform-admin and research-user built-in groups, migrate untouched legacy normal-user defaults to the narrower baseline, protect all built-in role names from delete/rename, keep superadmin permissions fully locked, and preserve manually customized role permissions.
- Verification: run OpenAPI lint, regenerate API types, run API change request check, frontend typecheck, Django check, and focused core permission/API tests.
- Result: Verified with direct OpenAPI lint, OpenAPI type generation, API change request check, Prism mock bundle injection, frontend TypeScript checks, Django system check, and focused core permission/API tests. The broader `test_api.py` file still contains unrelated Windows TOML/path compatibility failures when run as a whole.

## API-20260701-001 - Vector Symbolization Unique Value Contract

- Status: ContractReady
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/layers/`, `POST /api/admin/data/resources/{id}/`
- Change type: response fields | request body | mock data | documentation clarification
- OpenAPI change: Defines `VectorSymbolization`, `VectorRenderer`, `UniqueValueRenderer`, and `UniqueValueSymbolClass` for the existing `symbolization` field while keeping `additionalProperties` compatibility with legacy loose style JSON. The schema documents category value merging through `classes[].values`, `gm-*` platform icon IDs, and the `germplasm.dna-sex-tree.v1` default template metadata.
- Mock examples: `mock/prism/examples/30-catalog-vector.json` adds a germplasm DNA point layer whose `symbolization.renderer` classifies `性别` into female, male, and other categories with tree icons.
- Frontend reason: The map symbolization editor needs typed, documented unique-value rules so business default templates and user edits share one contract instead of ad hoc frontend-only objects.
- Backend implementation notes: No new endpoint or database migration is required; existing JSONField storage and serializers should pass the documented `symbolization` object through unchanged. Admin save-visualization payloads should continue to accept this JSON shape under the existing `core.custom_symbolization` UI permission and existing resource-management permissions.
- Verification: run OpenAPI lint, regenerate API types, rebuild Prism mock, run focused frontend symbolization tests, frontend typecheck, and backend catalog layer serialization tests.
- Result: Pending implementation and verification.
