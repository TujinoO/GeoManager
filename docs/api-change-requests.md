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

- Status: BackendReady
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/catalog/resources/`, `POST /api/catalog/import/commit/`
- Change type: response fields | request body | status code | mock data
- OpenAPI change: Adds optional `DataResource.domainType`, `GET /api/catalog/resources/?domainType=` filtering, and a `400 ErrorResponse` for invalid domain type codes. Import commit payload documentation now includes `domainType`, which is saved on newly imported table/vector resources.
- Mock examples: `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: The top workspace navigation needs typed geo/non-geo dropdown choices that can synchronize with the left data panel without hand-written DTOs or hidden backend fields.
- Backend implementation notes: Add `DataResource.domain_type`, serialize it as `domainType`, filter resources by valid domain codes, reject invalid codes, store import payload domain types, and default raster catalog sync to `remote_sensing` and scanned gene files to `genome`.
- Verification: run OpenAPI lint, regenerate API types, rebuild Prism mock, run frontend typecheck, Django check, and focused backend domain filter tests.
- Result: Backend and frontend type-level verification passed. Broader catalog tests still hit existing Windows file-lock cleanup failures on GeoPackage/SQLite files, so the domain filter was verified with a focused test class that does not touch those files.
