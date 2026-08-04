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
| API-20260618-001 | Superseded | Non-geographic analytics workspace | endpoint design paused | Superseded | Demo only | N/A | N/A | Replaced by finalized real-data contract API-20260730-003 |
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
| API-20260704-001 | Verified | `GET /api/data-schema/summary/`, `GET /api/catalog/resources/`, `POST /api/catalog/import/commit/` | enum addition | Updated | Updated | Implemented | Focused passed | Adds `other` business data type across schema summary, resource filtering, and import commit |
| API-20260704-002 | Verified | `POST /api/catalog/export/`, `POST /api/catalog/export/async/`, export download | archive content behavior | Updated | N/A | Implemented | Focused passed | Adds per-vector `*-attributes.csv` files to export ZIP packages |
| API-20260710-001 | Verified | `GET /api/layers/`, admin data-resource visualization payloads | schema clarification | Updated | Updated | N/A | Passed | Adds manual graduated numeric classes under existing vector symbolization renderer |
| API-20260710-002 | Verified | `GET /api/admin/dashboard/` | response fields | Updated | Updated | Implemented | Focused passed | Adds permission-scoped data overview spatial summary for coverage map, heatmap, and coverage ranking |
| API-20260710-003 | Verified | `GET /api/catalog/resources/{id}/visualization-summary/` | response fields | Updated | Updated | Implemented | Focused passed | Adds recommended symbolization templates for five coordinate-bearing business table types |
| API-20260713-001 | Verified | `POST /api/catalog/vector-import/*`, schema summary and resource domain enum | new endpoints / enum addition | Updated | Added | Implemented | Focused passed | Adds vector source-file preview, validation, GeoPackage import, metadata registration, and the vector business domain type |
| API-20260713-002 | Verified | `POST /api/raster/import/preview/`, raster import/jobs/tiles | new endpoint / multipart and response fields | Updated | Added | Implemented | Passed | Adds GDAL-backed raster packages, DAT+HDR, persistent jobs/styles, configurable bands and stable tile caching |
| API-20260714-001 | Verified | `GET /api/admin/dashboard/` | statistics behavior clarification | Updated | Updated | Implemented | Focused passed | Separates authenticated activity from successful login events and fixes cross-midnight session undercounting |
| API-20260714-002 | Verified | `GET /api/catalog/resources/` | query parameter / response field | Updated | Updated | Implemented | Focused passed | Adds explicit spatial/non-spatial resource classification so map and non-geo workspaces receive isolated lists |
| API-20260713-003 | Verified | `GET /api/admin/data/resources/` | response field / grouping semantics | Updated | Updated | Implemented | Focused passed | Adds business type data for automatic inventory system groups while preserving custom groups |
| API-20260715-001 | Verified | `GET /api/admin/data/resources/` | response fields / aggregate semantics | Updated | Updated | Implemented | Focused passed | Separates full filtered statistics and group totals from paginated resource details |
| API-20260714-003 | Verified | `/api/catalog/map-compositions/*` | new endpoints / models / permissions / multipart export | Updated | Added | Implemented | Passed | Adds persisted map layouts, immutable output versions, PNG/JPG/PDF artifacts and publish workflow |
| API-20260714-004 | Verified | `GET/POST /api/catalog/workspaces/*`, `GET/POST /api/admin/workspaces/*` | visibility behavior / request and response fields | Updated | Updated | Implemented | Focused passed | Makes superadmin visibility unconditional, exposes shared active workspaces in the map, and adds uploader-managed access scopes |
| API-20260714-005 | Verified | `POST /api/auth/register/`, `GET/POST /api/admin/role-applications/*`, `POST /api/users/` | request validation / new endpoints / role workflow | Updated | Updated | Verified | Passed | Requires normalized unique email, fixed ordinary-user registration, research-role application review and transitional password recovery guidance |
| API-20260722-001 | Verified | data schema, catalog resources, all import commits, admin data resources | hierarchical classification / response and request fields | Updated | N/A | Implemented | Passed | Replaces geo/non-geo navigation taxonomy with the four confirmed client business categories while retaining technical compatibility fields |
| API-20260722-002 | Verified | `GET/POST /api/catalog/results/`, result file delivery | new endpoint / multipart and permission behavior | Updated | N/A | Implemented | Passed | Adds platform-analysis and direct-import result artifacts with draft/published visibility, preview and download |
| API-20260723-001 | Verified | `GET /api/admin/dashboard/` | response fields / aggregate semantics | Updated | Updated | Implemented | Passed | Separates physical format statistics from the four-major/fifteen-minor authoritative business taxonomy distribution |
| API-20260723-002 | Verified | `/api/catalog/results/*`, authenticated user permissions | permission/schema/management endpoint | Updated | Added | Implemented | Passed | Adds dedicated result permissions, direct-publication imports and unified result management |
| API-20260724-001 | Verified | `GET /api/login/overview/` | response value semantics / mock data | Updated | Updated | Implemented | Passed | Aligns the English name, abbreviation and edition with the current global platform identity |
| API-20260729-001 | Verified | guest login and permission-scoped catalog reads | permission behavior / documentation clarification | Updated | N/A | Implemented | Focused passed | Treats the guest audience as public so every authenticated role inherits publicly shared objects |
| API-20260729-002 | Verified | authenticated user permissions and login overview | permission/value semantics | Updated | Updated | Implemented | Passed | Hides operations admin from data-only roles and replaces hard-coded login statistics/service nodes with live platform values |
| API-20260730-001 | Verified | `POST /api/admin/data/resources/{resourceId}/` | request field / rename behavior | Updated | N/A | Implemented | Passed | Adds display-name-only data resource rename without changing stable identifiers, storage or default layer names |
| API-20260730-002 | Verified | `GET /api/bootstrap/`, `GET/POST /api/admin/settings/`, `GET /api/login/overview/` | response/request value normalization | Updated | N/A | Implemented | Passed | Normalizes known legacy Central Asia platform names to the confirmed global brand while preserving custom deployment names |
| API-20260730-003 | Verified | `GET /api/catalog/resources/{id}/nongeo-analysis/`, `POST /api/catalog/resources/{id}/nongeo-query/` | new endpoint / response and request schemas | Updated | N/A | Implemented | Passed | Replaces non-geographic demo statistics with permission-scoped real table/gene analysis and paginated querying |
| API-20260730-004 | Verified | `POST /api/catalog/scan/`, `POST /api/raster/scan/` | permission and concurrency behavior | Updated | N/A | Implemented | Passed | Documents maintenance-only scan permissions, catalog 409 conflicts and raster active-job reuse |
| API-20260730-005 | Verified | `POST /api/catalog/results/`, `GET /api/catalog/results/{resultId}/file/` | validation / permission / response headers | Updated | N/A | Implemented | Passed | Verifies real file formats, emits trusted MIME and hardens preview/download responses |
| API-20260730-006 | Verified | `/api/groups/*`, `/api/users/*` | permission and protected-principal behavior | Updated | N/A | Implemented | Passed | Enforces feature-permission second authorization plus guest and platform-admin protections |
| API-20260730-007 | Verified | generated browser SDK operations | client transport metadata / CSP compatibility | Updated | N/A | N/A | Passed | Defaults generated clients to the same-origin platform entry instead of hard-coded localhost |
| API-20260730-008 | Verified | vector query and catalog export endpoints | 413/503 status and resource-bound behavior | Updated | N/A | Implemented | Passed | Adds bounded query concurrency/body sizes and disk-streamed exports for OOM prevention |
| API-20260731-001 | BackendReady | `POST /api/admin/settings/` | validation / persistence / error response | Updated | N/A | Implemented | Focused passed | Bounds editable runtime limits and requires writable `/config` directory mounting for atomic saves |
| API-20260801-001 | Verified | `GET /api/bootstrap/`, `GET/POST /api/admin/settings/` | response/request field | Updated | Updated | Implemented | Passed | Adds an optional browser-safe Tianditu Key while keeping legacy TOML files valid |
| API-20260801-002 | Verified | `POST /api/raster/render/`, completed raster render jobs | response fields / tile delivery semantics | Updated | Updated | Implemented | Passed | Adds native zoom and sampling metadata; categorical styles become atomically published nearest-neighbor tile pyramids |
| API-20260802-001 | Verified | bootstrap/admin settings and upload endpoints | validation / deployment safety | Updated | N/A | Implemented | Passed | Raises the disk-backed upload ceiling to 1024 MB while retaining parser-specific memory limits |

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

## API-20260801-001 - Optional Tianditu browser access token

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/bootstrap/`, `GET/POST /api/admin/settings/`
- Change type: response field | request field | runtime configuration
- OpenAPI change: Adds optional string field `map.tiandituAccessToken` to `MapConfig`; the backend returns an empty string when the optional `application.map.tianditu_access_token` TOML key is absent. Keeping the contract field optional avoids forcing legacy generated clients to provide it immediately. The existing admin settings POST accepts the same field for partial map-setting updates.
- Mock examples: `mock/prism/examples/00-public-auth.json`, `mock/prism/examples/10-admin-auth.json`
- Frontend reason: The basemap selector needs a browser-safe Tianditu Key without replacing or weakening the existing Mapbox default path.
- Backend implementation notes: Load the optional TOML value with an empty-string default, expose it through Bootstrap and admin settings, persist trimmed administrator updates, and never seed a real Key in repository configuration or examples.
- Validation notes: Administrator writes accept only Mapbox `pk.*` public tokens and 32-character alphanumeric Tianditu browser keys. Formal default basemaps are `satellite`, `mapbox-streets`, and `tianditu-vector`; historical `osm` input is normalized to `satellite` on save.
- Verification: Focused Bootstrap/config/admin-setting Django tests; regenerated API types; `check:api`; `api:changes:check`; `api:lint`; `api:docs`; `mock:build`; frontend `typecheck`.
- Result: Passed. The focused backend run completed with 10 passed tests (101 deselected), followed by all 111 tests in `backend/tests/integration/core/test_api.py`; generated API files match the OpenAPI contract; change tracking, OpenAPI validation, documentation generation, Prism bundle generation, and TypeScript checks all passed. OpenAPI lint retains only the six pre-existing unused-component warnings.

## API-20260801-002 - LUCC native zoom and nearest-neighbor tile delivery

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/raster/render/`, `POST /api/raster/render/async/`, `GET /api/raster/jobs/{jobId}/`
- Change type: response fields | tile delivery semantics | mock data
- OpenAPI change: `RasterRenderResult` now requires `minZoom`, `maxZoom`, and `tileSampling`. `maxZoom` is derived from the processed Web Mercator pixel size, and `tileSampling` explicitly tells the client to use `nearest` for categorical rasters or `linear` for continuous imagery.
- Mock examples: `mock/prism/examples/40-raster.json`
- Frontend reason: Mapbox otherwise assumes tiles exist through z22 and can keep overscaled parent tiles visible while higher levels load. An explicit native maximum and first-frame sampling rule are required to prevent LUCC interpolation colors during zoom transitions.
- Backend implementation notes: Build a complete content-addressed MBTiles pyramid for every categorical style, publish it atomically only after all levels are present, and keep render jobs non-ready until publication completes. Existing categorical COGs without the current nearest-neighbor preprocessing marker must be rebuilt during scan.
- Verification: Regenerate/check OpenAPI clients and Prism examples; run focused frontend raster-source tests, the Mapbox nearest-raster patch verifier, all raster backend tests, TypeScript checks, and a production build. Validate a real LUCC pyramid at every zoom for palette-only opaque pixels plus fully transparent NoData.
- Result: Backend raster tests pass (161 tests). A real `hjyt_tile_r1_c1` z0–16 pyramid built 2,575 tiles in 10.0 seconds (10.9 MiB); all levels contained zero partial-alpha pixels and zero colors outside the six-class palette plus transparent NoData. Focused frontend tests, TypeScript, the Mapbox nearest/mipmap/anisotropy verifier and production build all pass.

## API-20260730-001 - Data resource display-name rename

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/admin/data/resources/{resourceId}/`
- Change type: request field | rename behavior
- OpenAPI change: Adds optional `name` to `AdminDataResourceUpdateRequest` for `action=update`, with a trimmed length of 1–160 characters.
- Mock examples: N/A; response schemas and Prism examples are unchanged.
- Frontend reason: The inventory configuration drawer previously exposed only the default map-layer name, so operators could not rename the data resource shown in inventory, catalog and search views.
- Backend implementation notes: Update only `DataResource.name`; preserve `code`, `storage_path`, physical files/tables, `MapLayer.name` and the default visualization layer name. Continue requiring `catalog.change_dataresource` and record the rename in the operation log.
- Verification: regenerate/check OpenAPI types, run API lint/change tracking, focused Django rename and validation tests, the focused Chromium inventory rename flow, TypeScript checks and production build.
- Result: Verified with the focused backend/frontend tests and API/build checks listed above.

## API-20260730-002 - Canonical global platform brand

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/bootstrap/`, `GET/POST /api/admin/settings/`, `GET /api/login/overview/`
- Change type: request/response value normalization | frontend metadata
- OpenAPI change: Documents that known legacy “Central Asia Populus euphratica” platform names are upgraded to `全球胡杨林生态系统保护数据共享平台`; unrelated custom deployment names remain supported.
- Mock examples: Existing bootstrap and login-overview examples already use the canonical global brand.
- Frontend reason: A legacy runtime TOML value could overwrite the correct static HTML title after bootstrap, causing browser tabs and a few runtime-driven labels to regress to the old name.
- Backend implementation notes: Centralize canonical Chinese/English names, abbreviation and edition; normalize known legacy names in bootstrap, login overview, admin settings and backup manifests; persist the canonical value when a legacy name is submitted through system settings.
- Verification: run the brand drift guard, backend bootstrap/settings tests, frontend normalization and Chromium tab-title tests, OpenAPI checks, TypeScript checks and production build.
- Result: Verified with the focused backend/frontend tests and consistency/build checks listed above.

## API-20260729-002 - Permission-scoped admin entry and live login overview

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/auth/me/`, `GET /api/login/overview/`
- Change type: permission behavior | response value semantics | mock data
- OpenAPI change: Clarifies that `canAccessAdmin` is true only when the current account has at least one operations-admin capability; the login overview continues using the existing schema but now drives the real login UI.
- Mock examples: `mock/prism/examples/05-login-overview.json`
- Frontend reason: Ordinary/research users must not enter an empty or sensitive operations dashboard, and public login statistics must not be hard-coded demo values.
- Backend implementation notes: Compute admin access from existing fine-grained permissions; keep the personal profile route available; count service-status nodes from the actual service list.
- Verification: Run focused auth/login overview tests, frontend typecheck, login/browser route checks and OpenAPI generation checks.
- Result: Verified with 481 backend tests, 197 frontend unit tests, 96 Chromium browser tests, frontend TypeScript checks, a production build, OpenAPI generation/consistency checks, API change tracking, Prism mock injection, and real local guest-route regression.

## API-20260722-001 - Four-Category Data Taxonomy V1

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/data-schema/summary/`, `GET /api/catalog/resources/`, `POST /api/catalog/import/commit/`, `POST /api/catalog/vector-import/commit/`, `POST /api/raster/import/`, `GET/POST /api/admin/data/resources/*`
- Change type: response fields | request fields | query parameters | classification behavior
- OpenAPI change: Adds taxonomy version, hierarchical category nodes, category paths, classification status, available views, descendant-aware category filtering and category selection for imports and inventory updates. Keeps `domainType`, `dataType`, `spatialClass` and the legacy `category` query parameter during the compatibility release.
- Mock examples: N/A; the canonical OpenAPI contract, generated client and live schema/catalog responses carry the confirmed category codes.
- Frontend reason: The client has confirmed four authoritative business categories; map/non-map distinctions must become presentation capabilities rather than top-level data categories.
- Backend implementation notes: Extend `DictionaryItem` with parent/selectable fields, keep `DataResource.category` as the single primary category, seed the fixed tree, backfill only unambiguous legacy resources, and never move or delete research files during classification.
- Verification: Rehearse migrations on a copied `meta.db`; verify archived compositions and all resource/layer counts do not decrease; run OpenAPI generation/lint/change checks, focused Django catalog/import/admin tests, frontend taxonomy/import/inventory tests and typecheck.
- Result: Verified on a copied database before the formal migration, then re-audited on the formal database with all 20 resources, 19 layers, 4 topics and 4 topic versions preserved. The two legacy archived topics retain their records, versions, snapshots and artifacts with status mapped to `completed`; 8 unambiguous resources were classified and 12 remain pending for manual review. Django system and migration checks, 13 focused taxonomy/import/archive/backup tests, OpenAPI lint and API change tracking, frontend typecheck, 191 frontend unit tests, targeted lint/format checks, production build, and signed-in browser checks for the four-category catalog, descendant filters, map-context handoff and inventory classification editor passed. The broader backend suite completed with 446 passing and 19 known baseline failures caused by existing Windows TOML/path/file-lock assumptions, an existing duplicate built-in-role fixture and one unrelated coordinate-format expectation.

## API-20260714-005 - Registration Email And Research Role Application

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/auth/register/`, `GET /api/admin/role-applications/`, `POST /api/admin/role-applications/{applicationId}/review/`, `POST /api/users/`
- Change type: request body | validation behavior | new endpoints | permission behavior | mock data
- OpenAPI change: Makes registration and administrator-created account email mandatory, defines lowercase non-empty email uniqueness, adds `accountPurpose` and conditional research-application fields, returns the submitted application, and adds permission-gated list/review endpoints.
- Mock examples: `mock/prism/examples/00-public-auth.json`, `mock/prism/examples/10-admin-auth.json`
- Frontend reason: Self-registration must map safely to the existing built-in roles without allowing users to grant themselves elevated permissions, while the current no-mail transition still requires reliable contact data and a clear administrator-assisted password reset path.
- Backend implementation notes: Keep every self-registered account in the ordinary-user group, persist a separate pending research-role application, normalize and reserve unique email identities, approve by replacing the ordinary role with the research role while retaining custom roles, reject without changing permissions, and record review operations.
- Verification: Run OpenAPI lint/generation/change checks, Prism example injection, Django migration/system checks, focused registration/email/review tests, frontend registration/admin tests, typecheck and production build.
- Result: Verified with OpenAPI lint and regenerated client types, bundled YAML/HTML documentation, Prism example injection, API change tracking, Django system and migration checks, 13 focused registration/email/role-review permission tests, frontend typecheck, 185 frontend unit tests, production build, and targeted system-Chrome browser tests for research registration and administrator approval. The repository-wide browser command still requires its configured Playwright Chromium download; the broader existing core suite retains unrelated Windows TOML/path/encoding failures.

## API-20260714-003 - Formal Map Composition And Thematic Product Workflow

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET/POST /api/catalog/map-compositions/`, `GET/POST /api/catalog/map-compositions/{compositionId}/`, `POST /api/catalog/map-compositions/{compositionId}/versions/`, `GET /api/catalog/map-compositions/{compositionId}/versions/{versionNumber}/file/`
- Change type: new endpoint | new models | request/response schemas | multipart upload | permission behavior | binary download | mock data
- OpenAPI change: Adds typed map composition drafts linked to project workspaces, lightweight layout JSON, immutable exported versions, status transitions, PNG/JPG/PDF metadata, preview/download URLs, and six composition permission flags in the current-user response.
- Mock examples: `mock/prism/examples/50-map-compositions.json`
- Frontend reason: The geographic workspace needs a complete project-to-layout-to-thematic-product workflow with paper settings, map frames, legends, north arrows, scale bars, overview maps, grids, sources, notes, preview, versioning and export.
- Backend implementation notes: Persist composition metadata in the application database, store generated artifacts only under the TOML-driven business exports directory, reject embedded source data/Data URLs in layout JSON, validate uploaded PNG dimensions, convert the client-rendered master image to the selected output format, enforce Django permissions and record audit targets.
- Verification: Run OpenAPI lint/generation/check, Prism bundle/example injection, Django migrations/system checks, focused map-composition API/model/export tests, frontend typecheck/tests/build, and a signed-in browser workflow covering create, edit, version generation, preview, download and publish.
- Result: Verified with focused map-composition/workspace/auth Django tests, OpenAPI lint and regenerated types, API change tracking, Prism example injection, 179 frontend unit tests, frontend typecheck, production build and targeted lint. A signed-in real-browser workflow completed project creation, composition editing, geographic and Web Mercator grids, overview map, legend/source/note rendering, draft save, PNG V1 generation and preview, publish, unpublish and archive. The repository browser-test command remains unavailable because its configured Playwright Chromium executable is not installed.

## API-20260714-004 - Shared Workspace Visibility And Superadmin Invariant

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET/POST /api/catalog/workspaces/`, `GET/POST /api/catalog/workspaces/{workspaceId}/`, `GET /api/admin/workspaces/`, `POST /api/admin/workspaces/{workspaceId}/`
- Change type: permission behavior | response fields | request body | mock data | data migration
- OpenAPI change: Changes the normal workspace list/detail from owner-only to owner-or-role-visible active objects with a superadmin all-object bypass; adds access groups and per-object owner/edit/delete flags, returns selectable access groups, and accepts `accessGroupIds` on create/update while keeping the superadmin group server-controlled.
- Mock examples: `mock/prism/examples/30-catalog-vector.json`, `mock/prism/examples/25-admin-managed-assets.json`
- Frontend reason: Superadmins and explicitly shared users must be able to discover and load engineering/topic snapshots saved by other uploaders, while owners need to set visibility during save and shared viewers must not receive edit/delete controls.
- Backend implementation notes: Centralize workspace visibility filtering, force the protected superadmin group onto new and historical workspaces, keep normal updates owner-only, exclude the superadmin group from selectable scopes, and preserve inactive objects only in the admin management surface.
- Verification: Run migration checks, focused workspace API tests, OpenAPI generation/lint/change checks, frontend typecheck and focused workspace/admin tests, then verify list counts, shared loading, owner-only editing and admin map loading in a signed-in browser.
- Result: Verified with OpenAPI lint and generated types, Prism bundle/example injection, API change request validation, Django system/migration checks, focused map-composition/workspace/auth tests, frontend typecheck, 179 unit tests and production build. Browser workflow verification is tracked separately because it requires a running signed-in local stack with map tile access.

## API-20260714-001 - Reliable Active Account And Login Statistics

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/admin/dashboard/`
- Change type: statistics behavior clarification | mock data | documentation clarification
- OpenAPI change: Keeps the existing response shape but redefines `activeUsers.count` and `series[].count` as authenticated API activity metrics, while `loginCount` and `ranking[].loginCount` remain successful session-creation metrics. Successful authentication includes password login, guest login, and registration auto-login.
- Mock examples: `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: A session that remains signed in across midnight was shown as zero active users even while the account was actively querying and importing data, because the previous implementation treated login events as activity.
- Backend implementation notes: Record at most one activity row per user and local-time hour, backfill historical successful operation logs, identify authentication events with stable event codes instead of Chinese display text, preserve principal visibility rules, and keep login totals separate from activity counts.
- Verification: run the audit migration check, focused dashboard/auth tests, OpenAPI generation/checks, frontend route tests, typecheck, and formatting checks.
- Result: Verified by focused backend tests covering carried sessions, stable login events, daily series, and existing dashboard permissions, plus OpenAPI/frontend checks.

## API-20260714-002 - Geographic And Non-Geographic Resource Isolation

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/catalog/resources/`
- Change type: query parameter | response field | filtering behavior | mock data
- OpenAPI change: Adds `spatialClass=spatial|non_spatial` and `DataResource.spatialClass`; documents that vector/raster resources are spatial while table/gene/document/image resources are non-spatial, independently of `domainType`.
- Mock examples: `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: Plain Excel/CSV imports without usable longitude/latitude columns must disappear from the map resource list and appear immediately in the non-geographic workspace resource list, including after manual refresh.
- Backend implementation notes: Derive the resource classification from `DataResource.data_type`, validate the query value, preserve existing permission and business-domain filters, and return the classification in serialized resources.
- Verification: run OpenAPI lint/generation, API change request check, focused catalog list/import tests, frontend typecheck and focused workspace tests, then validate both workspaces in the local browser.
- Result: Verified with OpenAPI lint and generated types, Prism bundle/example injection, API change request validation, focused Django resource/import tests, frontend typecheck and unit tests, and a real signed-in Chrome check confirming the imported SQLite table appears and refreshes in `/nongeo` while remaining absent from `/map`. The repository browser-test command remains unavailable because its configured Playwright Chromium binary is not installed.

## API-20260713-001 - Vector Source Import And Business Domain

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/catalog/vector-import/preview/`, `POST /api/catalog/vector-import/validate/`, `POST /api/catalog/vector-import/commit/`, `GET /api/data-schema/summary/`, `GET /api/catalog/resources/`
- Change type: new endpoint | request body | response fields | enum addition | mock data | backend model
- OpenAPI change: Adds typed vector source preview, validation, and commit responses for Shapefile ZIP, GeoJSON, and GeoPackage; extends `DataDomainType` with `vector`; documents CRS, encoding, geometry quality, duplicate-name, access-group, and permission behavior.
- Mock examples: `mock/prism/examples/30-catalog-vector.json`, `mock/prism/examples/45-domain-schema.json`
- Frontend reason: The admin import page must replace the previous “vector import not yet supported” result with a complete typed workflow that previews source layers, allows encoding/CRS and geometry-quality decisions, and registers the imported resource for immediate use in the geographic workspace.
- Backend implementation notes: Add `VectorDataset`, retain original uploads under the configured research vector directory, normalize valid geometries to EPSG:4326 in the shared GeoPackage, create `DataResource`/`MapLayer`/`ResourceDomain`/`SourceDataset`, reuse existing access groups and audit logging, and keep existing Excel/CSV import endpoints unchanged.
- Verification: run OpenAPI lint/generation, API change request check, Prism mock build, Django migration/system checks, focused vector import integration tests, frontend API client tests, frontend typecheck, formatting checks, and production build.
- Result: Verified with OpenAPI lint and generated types, Prism bundle/example injection, API change request validation, Django system and focused migration checks, vector import/domain/schema integration tests, actual GB18030 Shapefile preview, frontend typecheck, targeted lint/format checks, mock example tests, and production build. Browser-mode API tests remain blocked because the configured Playwright Chromium executable is not installed; the broader legacy import suite still contains existing Windows GeoPackage/SQLite file-lock failures and one unrelated coordinate-format expectation failure.

## API-20260710-002 - Data Overview Spatial Summary

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/admin/dashboard/`
- Change type: response fields | mock data | documentation clarification
- OpenAPI change: Extends `AdminDashboardDataOverviewScope` with required `spatialSummary`, plus typed `AdminDashboardSpatialSummary`, `AdminDashboardResourceExtent`, and `AdminDashboardSpatialHeatmapCell` schemas. The field is returned separately under `ownUploads` and permission-gated `visibleResources`; legacy top-level system total fields remain unchanged.
- Mock examples: `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: The data management overview needs first-stage visualizations for spatial coverage, heatmap distribution, data type composition, coverage ranking, and uploader contribution without fetching full resource geometry or bypassing permission scope.
- Backend implementation notes: Compute `spatialSummary` only after the relevant queryset has been scoped to the current user (`maintainer=current user` for `ownUploads`, `filter_accessible(...)` for `visibleResources`). Use registered resource/layer/raster bbox metadata only; do not scan raw feature data in the dashboard request. Ordinary users must never receive all-platform spatial summaries or uploader rankings.
- Verification: run OpenAPI generation, Prism mock build, focused dashboard backend tests, frontend typecheck, and route/browser checks for the data overview page. Do not run scripts containing bulk delete commands.
- Result: Verified with OpenAPI lint/generation, Prism bundle/example injection, API change request check, focused dashboard backend tests, Django system check, frontend typecheck, targeted lint/format checks for touched frontend files, and Vite production build. Browser route test could not run because the local Playwright Chromium executable is not installed.

## API-20260710-001 - Vector Manual Graduated Symbolization

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/layers/`, `POST /api/admin/data/resources/{id}/`
- Change type: response fields | request body | mock data | documentation clarification
- OpenAPI change: Extends `GraduatedRenderer.method` with `manual`. Manual graduated symbolization continues to use existing `classes[].min/max/color/iconImage/size/visible` fields, with no new endpoint or backend model.
- Mock examples: `mock/prism/examples/30-catalog-vector.json` changes the elevation graduated vector example to `method="manual"` with custom range labels and custom min/max boundaries.
- Frontend reason: Users need to define non-equal, domain-specific numeric ranges for fields such as elevation, NDVI, and salinity, while still editing colors, icons, sizes, and visibility per class.
- Backend implementation notes: Existing JSONField storage and serializers should pass the documented `symbolization` object through unchanged. Permission behavior remains the same as other custom symbolization edits.
- Verification: run OpenAPI type generation, Prism mock build, API change request check, focused frontend symbolization tests, frontend typecheck, backend Django check, and production build.
- Result: Verified with OpenAPI type generation, Prism mock bundle injection, Redocly lint, API change request check, focused frontend symbolization tests, frontend TypeScript checks, Django system check, and Vite production build. Redocly still reports two pre-existing unused schema warnings unrelated to this change.

## API-20260704-001 - Other Business Data Type

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/data-schema/summary/`, `GET /api/catalog/resources/`, `POST /api/catalog/import/commit/`
- Change type: enum addition | response fields | request body | mock data | backend model choices
- OpenAPI change: Extends `DataDomainType` with `other`, documents that the data schema summary and resource filter support other-type resources, and keeps existing missing/invalid `domainType` error behavior unchanged.
- Mock examples: `mock/prism/examples/45-domain-schema.json`, `mock/prism/examples/30-catalog-vector.json`
- Frontend reason: The data import page needs a typed catch-all business classification for files that do not clearly match germplasm, community, survey, remote sensing, molecular, genome, or other specialized domains.
- Backend implementation notes: Add `other` to standards and catalog domain choices, expose it in `GET /api/data-schema/summary/`, allow resource filtering by `domainType=other`, and save it during Excel/CSV import commits without adding new permissions.
- Verification: run OpenAPI lint/generation, rebuild Prism mock, run API change request check, focused backend schema/resource/import tests, and focused frontend import tests/typecheck.
- Result: Verified with OpenAPI lint, generated API types, Prism mock rebuild, API docs rebuild, API change request check, Django system check, focused backend schema/resource/import tests, frontend TypeScript checks, import value unit test, and mock example tests. Browser route test could not run because the local Playwright Chromium executable is not installed.

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

- Status: Verified
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

- Status: Superseded
- Owner: Frontend
- Endpoints: historical proposal only; replaced by API-20260730-003
- Change type: endpoint design paused
- OpenAPI change: The former `/nongeo-analytics/` and `/table-query/` proposal was removed; the finalized contract now uses `/nongeo-analysis/` and `/nongeo-query/` under API-20260730-003.
- Mock examples: Frontend demo only; no backend mock contract.
- Frontend reason: This entry recorded the earlier decision to defer field profiling, statistics and pagination until product semantics were confirmed.
- Backend implementation notes: No implementation is attached to the historical paths; use the permission-scoped real-data endpoints documented by API-20260730-003.
- Verification: run `cd frontend && pnpm run generate:api && pnpm run check:api && pnpm run api:changes:check`.
- Result: Superseded by the implemented and verified API-20260730-003 contract.

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

- Status: Verified
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

## API-20260704-002 - Vector Export Attribute Table Packaging

- Status: BackendReady
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/catalog/export/`, `POST /api/catalog/export/async/`, `GET /api/catalog/export/jobs/{job_id}/download/`
- Change type: documentation clarification | archive content behavior
- OpenAPI change: Clarifies that vector export ZIP files include the requested spatial file plus a same-name `*-attributes.csv` file generated from `GeoJSONFeatureCollection.features[].properties`; request and response schemas are unchanged.
- Mock examples: N/A; binary ZIP response schema is unchanged.
- Frontend reason: The spatial query result export should provide a directly usable attribute table instead of only a GeoJSON file.
- Backend implementation notes: While packaging each vector item, keep existing GeoJSON/Shapefile output and add a UTF-8 BOM CSV attribute table with one row per feature and stable property-column order.
- Verification: run OpenAPI lint, regenerate API types, rebuild Prism mock, run frontend typecheck, and run focused backend export tests.
- Result: Verified with direct OpenAPI lint, OpenAPI type generation, API change request check, Prism mock bundle injection, frontend TypeScript checks, backend export unit tests, and backend export API integration tests.

## API-20260710-003 - Recommended Vector Symbolization Templates

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/catalog/resources/{id}/visualization-summary/`
- Change type: response fields | schema fields | mock data | documentation clarification
- OpenAPI change: Adds required `recommendedSymbolizations` to `ResourceVisualizationSummaryResponse`, defines `RecommendedSymbolizationTemplate`, and documents `GraduatedRenderer.templateId/businessType` so unique-value and graduated recommended templates share the same metadata contract.
- Mock examples: `mock/prism/examples/30-catalog-vector.json` includes field-survey habitat and importance recommended symbolization examples under the visualization summary response.
- Frontend reason: The symbolization panel needs typed recommended default templates for germplasm, individual, population, community, and field-survey vector resources, while still allowing users to customize the applied style.
- Backend implementation notes: Generate recommendations from the existing visualization summary read path using resource `domainType`, field alias matching, category counts, numeric distributions, and the platform `gm-*` icon whitelist. No new write endpoint or database migration is required.
- Verification: run OpenAPI lint, regenerate API types, run frontend TypeScript checks, run focused frontend symbolization tests, run backend template unit tests, and compile the touched backend modules.
- Result: Verified with direct Redocly lint, direct OpenAPI type generation, frontend TypeScript checks, `src/symbolization.test.ts`, `backend/tests/unit/catalog/test_symbolization_templates.py`, and Python module compilation. `pnpm run check:api` was not run because the script contains `rm -rf`, which conflicts with the workspace deletion policy.

## API-20260713-002 - Raster Package Import And Persistent Jobs

- Status: BackendReady
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/raster/import/preview/`, `POST /api/raster/import/`, `GET /api/raster/jobs/{job_id}/`, `POST /api/raster/render/`, `GET /api/raster/tiles/{dataset_id}/{style_hash}/{z}/{x}/{y}.png`
- Change type: new endpoint | multipart request | response fields | persistence | permission behavior | mock data
- OpenAPI change: Adds server-side raster package preview, multi-file `files + payload` import, DAT/BSQ/BIL/BIP + HDR and VRT dependency semantics, persistent job `stage`, source package metadata, raster kind, resampling, access groups, and display rules.
- Mock examples: `mock/prism/examples/40-raster.json`
- Frontend reason: IMG/VRT/ENVI files must not be parsed as GeoTIFF in the browser; users need GDAL-backed package validation, companion-file upload, RGB band selection, resampling, permissions, and refresh-safe job status.
- Backend implementation notes: Preserve the legacy single-file field, store new packages under UUID directories with a manifest and SHA256, persist sparse task checkpoints and raster styles in the metadata database, publish catalog records in a short transaction, and restrict server-path imports to `raster/original`.
- Verification: regenerate OpenAPI types, rebuild Prism examples, run frontend typecheck/browser tests, Django checks, raster unit/integration tests, and a real GeoTIFF preview/import smoke test.
- Result: Verified with OpenAPI lint and generated types, bundled YAML/HTML API documentation, Prism example rebuild, API change-request validation, Django system check, the applied raster database migration, 113 raster unit/integration tests, frontend TypeScript checks, 162 frontend tests, and a Vite production build. The provided `Tarim_worldview_1.tif` sample was preflighted as GTiff, 512 x 512, 8 bands, EPSG:32645, with the WorldView natural-color 5/3/2 preset. Browser-mode tests could not start because the configured Playwright Chromium executable is not installed. `makemigrations --check` also reports an unrelated pre-existing `core.BackupRun` index-name drift; no raster migration drift was reported.

## API-20260713-003 - Inventory Business Type Groups

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/admin/data/resources/`
- Change type: response field | mock data | documentation clarification
- OpenAPI change: Adds nullable `AdminDataResource.domainType` and clarifies that `inventoryGroups` / `inventoryGroupId` represent user-created custom groups, while “全部数据” and the ten business-type groups are derived system groups.
- Mock examples: `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: The inventory page needs stable automatic grouping by the ten import business types without duplicating those types as manually maintained database groups.
- Backend implementation notes: Serialize `DataResource.domain_type` as `domainType`; no model or migration change is required. Historical blank values remain null and are displayed under “其他类型”.
- Verification: run OpenAPI lint/type generation, API change-request validation, focused backend admin-resource tests, frontend inventory browser tests, and frontend typecheck.
- Result: OpenAPI lint and generated types passed; the API change request and Prism example injection passed; all 17 admin data-resource backend tests passed; frontend formatting, full TypeScript checking, and the production build passed. The browser test could not start because the configured Playwright Chromium executable is not installed.

## API-20260715-001 - Inventory Full Statistics And Group Summaries

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/admin/data/resources/`
- Change type: response fields | aggregate semantics | mock data | documentation clarification
- OpenAPI change: Adds required `summary` and `groupSummaries` to the admin data-resource list response. Both are calculated over the complete filtered and permission-scoped queryset, while `items` remains paginated.
- Mock examples: `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: The inventory page currently compares the full `total` with active/inactive counts derived from only the current page, and business/custom groups are sized from paginated items, making existing data appear missing.
- Backend implementation notes: Aggregate total, status, restricted-access, size, item-count, business-type groups, and custom groups before applying pagination. Keep permissions and filtering identical to the item queryset.
- Verification: run OpenAPI lint/type generation, API change-request validation, focused admin data-resource aggregation tests, frontend typecheck/build, and inventory browser tests when Chromium is available.
- Result: OpenAPI lint and generated types passed; API change-request validation, generated API documentation, and Prism example injection passed; all 19 admin data-resource backend tests passed; frontend TypeScript checking and the production build passed. The inventory browser test could not start because the configured Playwright Chromium executable is not installed.

## API-20260722-002 - Result Artifact Registration And Delivery

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET/POST /api/catalog/results/`, `GET /api/catalog/results/{resultId}/file/`
- Change type: new endpoint | multipart request | permission behavior | binary response
- OpenAPI change: Adds typed result source, result type and draft/published status enums; defines multipart `file + payload` registration, permission-scoped listing, preview and download variants.
- Mock examples: N/A; the page aggregates authenticated live results and retains an explicit empty state.
- Frontend reason: The data import page needs an independent “成果文件” target, and the成果展示 page must combine platform map compositions, platform analysis results and directly imported results without converting files into data resources.
- Backend implementation notes: Store files under `app_data/exports/results/{uuid}/`; allow PNG/JPG/PDF preview, allow CSV/XLSX download only, reuse data-upload permission for registration and专题成果发布 permission for direct publication, and enforce role visibility.
- Verification: OpenAPI generated client updated; five backend integration tests cover draft upload, publish permission, audience visibility, preview/download and invalid category/extension/size; frontend typecheck and browser navigation/import tests are included.
- Result: Backend integration tests and frontend TypeScript checks pass. Browser tests use installed system Chrome when the matching Playwright browser bundle is unavailable.

## API-20260723-001 - Dashboard Business Taxonomy Distribution

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/admin/dashboard/`
- Change type: response fields | aggregate semantics | UI statistics
- OpenAPI change: Extends `AdminDashboardDataOverviewScope` with required `categoryBreakdown` and `unclassifiedCount`, plus typed big-category and leaf-category aggregate schemas.
- Mock examples: `mock/prism/examples/20-admin-dashboard-data.json`
- Frontend reason: The data overview needs to distinguish physical resource formats from the authoritative four-major/fifteen-minor business classification system and display both distributions without mixing their meanings.
- Backend implementation notes: Aggregate the taxonomy over the same permission-scoped queryset used by each “我可见”/“我上传” scope. Return every active taxonomy root and leaf in configured order, including zero-count nodes, while keeping unclassified resources explicit.
- Verification: run OpenAPI lint/type generation, API change-request validation, focused dashboard integration tests, frontend typecheck/tests, and production build.
- Result: Verified with generated OpenAPI types, focused backend dashboard tests, frontend TypeScript checks, browser component tests, and production build.

## API-20260723-002 - Unified Result Permissions And Management

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET/POST /api/catalog/results/`, `GET/POST /api/catalog/results/{resultId}/`, `GET /api/catalog/results/{resultId}/file/`, authenticated user permission responses
- Change type: permission behavior | request schema | response fields | new management endpoint | destructive action | mock data
- OpenAPI change: Replaces borrowed data-resource/map-composition permissions with dedicated result view/import/download/publish/delete permissions; requires imported results to publish immediately with at least one audience role; adds result publish, unpublish and permanent delete actions; returns per-object capabilities, publisher and selectable access groups.
- Mock examples: `mock/prism/examples/55-results.json`
- Frontend reason: Result import must not create drafts without a release path, and the former topic-management page must manage both workbench map compositions and imported result artifacts without conflating their permissions.
- Backend implementation notes: Keep `draft` only as the state for historical or deliberately unpublished artifacts; reject new draft imports; allow owners and platform management subjects to publish/unpublish/delete when their dedicated permission allows it; remove only the explicitly addressed result file during delete and write an operation log.
- Verification: run OpenAPI lint/type generation, API change-request validation, Prism mock build, result artifact and core permission backend tests, result import/management browser tests, frontend typecheck, and production build.
- Result: Verified with OpenAPI lint and generated clients, tracked API change validation, Prism mock injection, Django migration/system checks, 37 focused permission/result backend tests, 33 frontend browser tests, frontend typecheck, and production build. The broader existing core API suite retained 11 unrelated Windows TOML/path separator failures while 83 tests and 2 subtests passed.

## API-20260724-001 - Platform Brand Naming Alignment

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/login/overview/`
- Change type: response value semantics | mock data | documentation clarification
- OpenAPI change: Keeps the existing `LoginOverviewPlatform` schema unchanged while updating the documented English name, abbreviation and edition examples to the approved global platform identity.
- Mock examples: `mock/prism/examples/05-login-overview.json`
- Frontend reason: The former `CAPFED` abbreviation reflected the earlier Central Asia naming and no longer matched the current global Chinese and English platform name shown in the navigation and login interface.
- Backend implementation notes: Return `Global Populus euphratica Forest Ecosystem Conservation Data Sharing Platform`, `GPEDSP` and `GPEDSP · WebGIS Research Edition` from the public login overview without changing authentication, response fields or caching behavior.
- Verification: regenerate/check OpenAPI types, rebuild Prism examples, run API lint and change-request validation, run the focused backend login-overview test, frontend typecheck/browser test and production build.
- Result: Verified with OpenAPI lint and generated clients, Prism bundle/example injection, API change-request validation, the focused Django login-overview test, the focused frontend browser test, TypeScript checks, production build, responsive browser inspection at 1280 px and 1024 px, and a 14-page PDF render review.

## API-20260729-001 - Public Guest Audience Inheritance

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: guest login; catalog resources, layers, workspaces, map compositions and result artifacts read endpoints
- Change type: permission behavior | documentation clarification
- OpenAPI change: Clarifies that selecting the built-in `游客` access role marks an object as public: it remains available through a guest session and is also inherited by every authenticated role.
- Mock examples: N/A; response schemas and example payloads are unchanged.
- Frontend reason: Logging in as a normal or research user must not hide content that is already visible to a guest.
- Backend implementation notes: Resolve the guest group as an additional effective audience for authenticated users across the shared access-filter helpers and the workspace/result/composition querysets. Keep owner and administrator bypass rules unchanged.
- Verification: run OpenAPI lint/type generation and API change-request validation; run focused concurrent guest-session and public-resource inheritance integration tests; verify resource loading through real browser sessions for guest, ordinary, research, platform-admin and superadmin roles.
- Result: Verified with focused backend and frontend browser tests plus real local role-based UI regression.

## API-20260730-003 - Real Non-Geographic Analysis And Query

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/catalog/resources/{id}/nongeo-analysis/`, `POST /api/catalog/resources/{id}/nongeo-query/`
- Change type: new endpoint | request body | response fields | permission behavior
- OpenAPI change: Adds typed field profiles, real row summaries, categorical/numeric distributions, correlation matrices, table previews and paginated/sorted table-query schemas; documents 10,000-row analysis sampling, 1–500 query limits and standard 400/401/403/404 responses.
- Mock examples: N/A; the non-geographic workspace consumes authenticated live resources and has explicit loading/error/empty states.
- Frontend reason: Selecting different table or gene resources must show each resource's own records and statistics instead of shared demo values, with stable pagination and safe sorting for the table view.
- Backend implementation notes: Read SQLite platform tables or supported CSV/TSV/Excel/FASTA/FASTQ/VCF/GFF/GenBank files; require `core.query_data` plus object access; cap direct-file analysis at the smaller of the runtime upload limit and 64 MB; validate SQLite sort fields against the real column allowlist.
- Verification: run OpenAPI lint/type generation and API change tracking; run focused non-geographic integration tests for resource-specific statistics, pagination/sort injection rejection, access permissions and FASTA parsing; run the role-based non-geographic browser flow.
- Result: Verified against the implemented real-data endpoints and focused backend/frontend role-flow tests.

## API-20260730-004 - Maintenance Scan Permission Boundaries

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/catalog/scan/`, `POST /api/raster/scan/`
- Change type: permission behavior | status code | concurrency semantics
- OpenAPI change: Documents `catalog.add_dataresource` for catalog scans, `raster.manage_raster_dataset OR catalog.change_dataresource` for raster scans, catalog 409 conflicts and raster active-job reuse; explicitly excludes ordinary browsing users and guests.
- Mock examples: N/A; maintenance scans are authenticated live operations and do not need deterministic Prism payloads.
- Frontend reason: Scan controls must follow the actual import/inventory operator roles and must not be exposed as ordinary resource refresh actions to users who cannot maintain storage.
- Backend implementation notes: Keep catalog scans single-flight with a 409 conflict; reuse an existing queued/running raster scan job in the same process; enforce permissions before scheduling any filesystem discovery.
- Verification: run OpenAPI checks and focused catalog/raster permission and concurrent-scan tests; verify scan actions stay hidden or disabled in guest and ordinary-user browser sessions.
- Result: Verified against the implemented permission guards and concurrency behavior.

## API-20260730-005 - Result File Authenticity And Safe Delivery

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/catalog/results/`, `GET /api/catalog/results/{resultId}/file/`
- Change type: validation | permission behavior | binary response headers
- OpenAPI change: Adds the required view permission to direct-publication imports; documents true-content validation for PNG/JPG/JPEG/PDF/CSV/XLSX, trusted server MIME assignment, `nosniff` on all successful file responses and preview-only sandbox CSP/referrer protection.
- Mock examples: N/A; multipart file authenticity and binary security headers are covered by backend integration tests rather than JSON mocks.
- Frontend reason: Renaming an arbitrary file to an allowed extension must not create a published artifact, and browser previews must not execute or leak content under attacker-controlled MIME metadata.
- Backend implementation notes: Decode image content with Pillow, verify PDF boundaries, restrict CSV encodings/NUL content, validate XLSX ZIP structure and expansion limits, then derive MIME server-side; allow previews only for PNG/JPG/JPEG/PDF and require `catalog.download_resultartifact` for artifacts.
- Verification: run OpenAPI generation/checks and focused result-artifact tests for disguised files, corrupt PDF/XLSX/CSV, trusted MIME, nosniff, CSP/referrer headers and preview/download permission separation.
- Result: Verified against the hardened upload and file-delivery implementation and integration coverage.

## API-20260730-006 - Role Second Authorization And Protected Principals

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET/POST /api/groups/`, `POST /api/groups/{groupId}/`, `POST /api/users/`, `POST /api/users/{userId}/*`
- Change type: permission behavior | validation | protected-account semantics
- OpenAPI change: Documents that creating roles and any role update containing `permissions` require `core.manage_feature_permissions` in addition to `core.manage_auth`; records immutable built-in names, locked/hidden superadmin behavior, guest-only role ownership and platform-admin target protection.
- Mock examples: N/A; response shapes are unchanged and the restrictions depend on the authenticated principal.
- Frontend reason: Authentication administrators who can maintain membership must not automatically gain authority to broaden feature permissions, and protected system/management accounts must not expose actions that the backend will reject.
- Backend implementation notes: Reject `permissions` writes without the second authorization; keep all five built-in roles non-deletable/non-renamable; reserve the guest role and account; restrict platform-admin assignment and all mutations of platform-admin targets to superadmins.
- Verification: run OpenAPI and API-change checks, focused core authorization tests, and real browser role flows for superadmin, platform admin, research user, ordinary user and guest.
- Result: Verified against focused backend authorization coverage and the completed 49-case role-based browser regression.

## API-20260730-007 - Same-Origin Default SDK Endpoint

- Status: Verified
- Owner: Frontend implementer
- Endpoints: all generated browser SDK operations
- Change type: client transport metadata | CSP compatibility | deployment safety
- OpenAPI change: Makes `/` the first server entry so generated clients default to the platform origin; keeps the direct local backend and external API server entries as explicit override targets.
- Mock examples: N/A; request and response payloads are unchanged.
- Frontend reason: Regenerating the SDK previously restored `http://localhost:8000` as its default base URL. During browser hot reload, requests could then bypass the platform proxy and be blocked by `connect-src 'self'`, breaking resource, workspace and composition loading.
- Backend implementation notes: No endpoint behavior changes. Browser calls continue through the same-origin `/api` reverse proxy; standalone clients may explicitly select another documented server URL.
- Verification: regenerate and compare the SDK, run API change validation and frontend type checks, then load catalog/workspace requests in a fresh browser session and confirm no CSP violations.
- Result: Verified with a generated client that has no hard-coded localhost base URL and a fresh same-origin browser regression.

## API-20260730-008 - Memory-Safe Query And Export Boundaries

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/catalog/resources/{id}/query/`, `POST /api/catalog/export/`, `POST /api/catalog/export/async/`
- Change type: status code | request-size validation | concurrency behavior | binary delivery behavior
- OpenAPI change: Documents 413 for oversized query/export JSON, 503 plus `Retry-After` when the per-process vector-query slot is unavailable, and the 10 MiB export request limit. Successful response schemas remain unchanged.
- Mock examples: N/A; saturation, bounded stream reads and file-response cleanup require backend tests rather than deterministic mock payloads.
- Frontend reason: A stalled 30,000-feature query or large embedded export request previously created several simultaneous GeoDataFrame/JSON/ZIP copies and could exhaust a 4 GB server; clients need explicit backoff and size-limit semantics.
- Backend implementation notes: Limit the production query result count to 5,000; read spatial candidates in fixed chunks; validate geometry in one pass; serialize exports to a temporary path; stream ZIP responses; bound request reads even without `Content-Length`; preserve the existing in-memory export helper only as a compatibility wrapper outside production endpoints.
- Verification: run OpenAPI lint/generation/change checks, focused catalog query/export/body-limit tests, the complete backend suite, frontend typecheck/tests/build and Docker entrypoint/image checks.
- Result: OpenAPI lint/generation/change checks, focused query/export/request-limit tests, complete raster regression, complete frontend tests/typecheck/build and Django system check passed. The complete backend run exposed only three compatibility-message assertions; the original message was restored and the affected parameterized endpoints passed on rerun.

## API-20260731-001 - Bounded And Persistable Admin Runtime Limits

- Status: BackendReady
- Owner: Frontend/backend implementer
- Endpoints: `POST /api/admin/settings/`
- Change type: request validation | error response | deployment safety
- OpenAPI change: Adds partial update schemas and server-enforced ranges for upload size, query results, raster side length and raster task timeout; documents JSON 500 when the source TOML cannot be atomically replaced.
- Mock examples: N/A; validation boundaries and filesystem replacement failures are covered by focused backend and frontend tests.
- Frontend reason: Editable descriptions submit only the active field, so the page must merge it with current settings before saving and must not advertise values that the server or small-memory deployment cannot safely support.
- Backend implementation notes: Enforce 1–120 MB, 100–10,000 results, 1–12,000 pixels and 10–600 seconds before touching the TOML; keep atomic replacement and require a writable directory mounted at `/config` instead of a single-file bind mount.
- Verification: Run OpenAPI generation/lint/change checks, focused core admin-settings tests, frontend settings tests, typecheck and build.
- Result: Pending final verification.

## API-20260802-001 - One-GiB Disk-Backed Upload Ceiling

- Status: Verified
- Owner: Frontend/backend implementer
- Endpoints: `GET /api/bootstrap/`, `GET /api/admin/settings/`, `POST /api/admin/settings/`, raster/vector/table/result/map-composition upload endpoints
- Change type: request validation | response constraint | deployment safety
- OpenAPI change: Raises the server-enforced `uploadMaxMb` maximum from 120 to 1024 MB and documents lower workflow-specific memory-safety limits; response shapes and status codes are unchanged.
- Mock examples: N/A; numeric boundaries, invalid hot-edited upload-limit fallback and disk-backed server limits are covered by focused tests.
- Frontend reason: Large GeoTIFF interpretation results can exceed 120 MB, while the small-memory production server must not expose GeoPandas or table parsers to 1 GiB in-memory workloads. The browser rejects table and vector files above their 16 MB and 120 MB parser-specific limits before upload.
- Backend implementation notes: Reuse one 1–1024 MB constant in startup config, runtime TOML reads and admin validation; give Waitress a 1152 MiB multipart ceiling and 720-second channel timeout; retain Django 10 MiB request/2 MiB file-memory thresholds; cap vector imports at `min(uploadMaxMb, 120)`, keep the existing 16 MB table parser limit, and preserve the former global protection for in-memory map-composition decoding with an independent 128 MB PNG ceiling. Deployment samples remain at the safe 64 MB default, and the mounted production TOML must be changed explicitly after the new image passes health checks.
- Verification: Run OpenAPI lint/generation/change checks, focused config/admin/vector/entrypoint tests, the admin browser regression, frontend typecheck and production build.
- Result: Passed. All 583 backend tests, all 305 frontend unit tests and all 43 admin browser tests passed; OpenAPI generation/lint/change tracking, generated-client comparison, API documentation and Prism bundle generation passed; TypeScript, focused frontend lint/format and the production build passed. OpenAPI lint retains only six pre-existing unused-component warnings. The repository-wide frontend format check still reports 139 pre-existing files outside this change, including untracked `.playwright-cli` records; the three edited frontend files pass focused formatting and lint checks.
