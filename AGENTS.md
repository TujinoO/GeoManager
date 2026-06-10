# huyang_system Agent Guide

Central Asia Poplar Forest Ecosystem Protection Data Sharing Platform (中亚胡杨林生态系统保护数据共享平台).

This guide tells coding agents how to work in this repository. It summarizes the project architecture, non-negotiable implementation constraints, and the workflow expected for safe multi-agent development.

## 1. Project Context

The platform is a browser-based data sharing and visualization system for poplar forest ecosystem protection in Central Asia. It manages multi-source ecological, spatial, monitoring, raster, vector, document, and result data, then exposes that data through authenticated web workflows, map visualization, catalog search, and administrative management.

Read `docs/design-docs.md` before writing code. It is the primary functional and architectural specification, including page structure, feature scope, data model expectations, performance targets, and acceptance criteria.

### Core product shape

- Users enter through one unified login page.
- The main web application contains both user-facing workflows and permission-gated admin features.
- Backend admin is a login-after feature controlled by permissions, not a separate public entry point.
- The UI should be Chinese-facing unless a task explicitly requires otherwise.
- Normal users, researchers, data admins, and system admins have different functional and data-access permissions.

### Primary references

| Document | Purpose |
| --- | --- |
| `docs/design-docs.md` | Full functional spec, architecture, data model, and acceptance criteria |
| `docs/openapi.yaml` | Authoritative OpenAPI 3.1.0 contract |
| `docs/openapi-standards.md` | Mandatory API specification rules |
| `docs/developer-guide.md` | Human-readable API and developer documentation |
| `docs/implementation-notes.md` | Shared implementation decisions and development memory |
| `docs/testing.md` | Testing notes and verification guidance |

> **Important:** When a decision affects future implementation, summarize it in `docs/`. Do not leave architectural decisions only in code comments, chat history, or commit messages.

## 2. System Architecture

### Technology stack

- **Frontend:** React, Vite, Ant Design, Mapbox GL JS
- **Backend:** Python, Django, GeoPandas, GDAL, Rasterio
- **Business data:** SQLite and application-managed metadata
- **Spatial/vector data:** GeoPackage `.gpkg`
- **Raster data:** Raw raster files, backend-generated PNG/XYZ output, PNG cache
- **Configuration:** TOML for data roots, cache policy, raster symbolization interface, and runtime paths

### Storage boundaries

Program code, business data, and research data must live in separate directory trees.

- Program paths belong to the repository and deployment code tree.
- Business-data root is configured in TOML.
- Research-data root is configured in TOML.
- Subdirectory layout under the data roots is fixed by convention, not configurable per item.
- Never hardcode business-data or research-data roots in application code.

> **Pitfall:** Data path shortcuts are easy to introduce during tests or imports. Keep roots TOML-driven and make tests provide explicit temporary config.

### Backend components

Use Django built-in auth, admin, sessions, groups, and permissions where possible. Do not reinvent user, role, session, or permission systems from scratch.

Backend app boundaries:

- `backend/apps/core/`: configuration, auth integration, permissions, system settings
- `backend/apps/catalog/`: data catalog, resources, vector query, imports, exports
- `backend/apps/raster/`: raster import, preprocessing, symbolization, tiles, async jobs
- `backend/apps/audit/`: operation logs and traceability

Sensitive operations require backend permission checks. Frontend route or button gating is not a substitute for server-side authorization.

### Frontend components

Ant Design is the primary UI library for non-map interfaces. Mapbox GL JS handles map rendering.

Preferred frontend boundaries:

- Map workspace: `frontend/src/pages/MapPage.tsx`, `frontend/src/components/MapCanvas.tsx`, `frontend/src/map/`
- Layer state: `frontend/src/hooks/LayerContext.tsx`, `frontend/src/hooks/useLayerGroups.ts`, `frontend/src/utils/layerFactory.ts`
- Data panel and query/import flows: `frontend/src/components/DataPanel.tsx`
- Admin pages: `frontend/src/admin/`
- API client: `frontend/src/api/client.ts`, using generated OpenAPI types

Do not use an array index as a React `key`. Do not use `!important` in CSS.

### Raster and map rendering

Raster files are never symbolized in the browser.

- Backend Python scripts generate PNG/XYZ output.
- The frontend only loads rendered imagery or tile services.
- Each raster type may have its own symbolization script.
- Raster symbolization scripts must be invoked through the unified stdin/stdout interface.
- PNG cache keys must include raster file identity, symbolization rules, and output size.
- Cache size cap and cleanup policy come from TOML config.

> **Important:** Any raster feature that moves color ramps, classification, resampling, or PNG generation into React violates the architecture. Keep raster computation behind backend services or configured symbolization scripts.

### Performance targets

Use the targets in `docs/design-docs.md` as acceptance constraints:

- Map interaction: at least 20fps where feasible
- Layer operations: no more than 500ms
- Query response: no more than 1s for up to 30k rows
- Layer management: support at least 15 concurrent loaded layers

When changing query, rendering, cache, or layer-state logic, consider these targets during design and verification.

## 3. API Contract Rules

All backend API endpoints must be defined in `docs/openapi.yaml` using OpenAPI 3.1.0. `docs/openapi.yaml` is the authoritative contract.

Whenever an API endpoint is added, removed, or modified, including URL, method, parameters, request body, response shape, status codes, permissions, or authentication behavior:

1. Update `docs/openapi.yaml`.
2. Update `docs/developer-guide.md`.
3. Regenerate/check frontend API types when applicable.
4. Implement backend behavior and tests.
5. Implement frontend usage and tests.

### OpenAPI requirements

- Every operation must have a unique camelCase `operationId`.
- All parameters, request bodies, response schemas, and error cases need complete `description` fields.
- Error responses must use the standard `ErrorResponse` schema with a `detail` field.
- Authentication must be declared through `components.securitySchemes`.
- Public endpoints must explicitly declare `security: []`.
- Authenticated endpoints must declare session-based security.
- Permission behavior must be documented in both `docs/openapi.yaml` and `docs/developer-guide.md`.
- Frontend DTO types must come from `frontend/src/api/schema.d.ts`; do not hand-write duplicate backend DTO types.

### API verification

After changing OpenAPI, run:

```bash
cd frontend
pnpm run generate:api
pnpm run check:api
pnpm run api:docs
pnpm run api:lint
```

> **Pitfall:** API changes are high-conflict in multi-agent work. Prefer landing contract changes first, then backend implementation, then frontend usage.

## 4. Development Environment

### Package managers and environments

- Use `pnpm` for all frontend dependency and script commands.
- Do not use `npm`.
- Activate the backend Python environment before backend commands:

```bash
eval "$(mamba shell hook --shell zsh)" && mamba activate geomanager
```

### Formatting and checks

Frontend scripts are defined in `frontend/package.json`:

```bash
cd frontend
pnpm run format
pnpm run lint
pnpm run check
pnpm run fix
pnpm run typecheck
pnpm test
```

Backend formatting:

```bash
cd backend
eval "$(mamba shell hook --shell zsh)" && mamba activate geomanager
ruff format .
python -m pytest
```

Run the smallest reliable verification set for the changed area. For merge-ready work, prefer the full relevant set.

## 5. Implementation Guardrails

### General rules

- No legacy fallback paths.
- Read existing code and tests before editing.
- Follow local patterns instead of introducing parallel architecture.
- Keep changes small, focused, and reviewable.
- Do not refactor unrelated files while implementing a feature.
- Do not revert or overwrite changes made by another agent unless explicitly instructed.
- Clarify uncertain behavior through tests and documentation rather than hidden compatibility branches.
- Format code before committing.

### Permissions and security

- Use Django permissions and groups where possible.
- Enforce permissions in backend views/services for menus, data resources, queries, exports, admin features, and configuration changes.
- Treat frontend permission gates as usability only; never rely on them as the security boundary.
- Log key operations in the audit app where the action affects data, permissions, configuration, imports, exports, or raster jobs.

### Data and import behavior

- Keep business-data and research-data roots configurable only through TOML.
- Validate imported data structure, field types, coordinate fields, and spatial bounds before accepting it.
- Return structured validation errors that help users correct data.
- Keep catalog classification based on topic, time, space, and source consistent with the design document.

### Frontend behavior

- Use Ant Design for forms, tables, menus, modals, panels, and admin interfaces.
- Use Mapbox GL JS for map rendering and map interaction.
- Keep raster symbolization out of frontend code.
- Keep UI state and generated API DTOs separate; do not hand-write API response duplicates in `frontend/src/types.ts`.
- Preserve responsiveness and avoid UI text overflow in panels, buttons, and tables.

## 6. Multi-Agent Collaboration

This repository is expected to be developed by multiple people operating coding agents. Each task should have a narrow boundary, explicit contract, and concrete verification commands.

### Task contract

Every task prompt should define:

- Background: why the change is needed
- Scope: files or modules the agent may modify
- Out of scope: files or behavior the agent must not modify
- API contract: endpoints affected, or confirmation that no API changes are expected
- Verification: exact commands to run before completion
- Completion report: changes made, commands run, and remaining risks

Recommended prompt shape:

```text
You are working in /Users/gx/Documents/Source/huyang_system.
Follow AGENTS.md: use pnpm, not npm; no legacy fallback; keep OpenAPI and developer docs synchronized for API changes.

Task:
<one sentence goal>

Scope:
- Allowed:
  - <files or directories>
- Do not modify:
  - <files or directories>

Context:
- Design: docs/design-docs.md
- Implementation notes: docs/implementation-notes.md
- Testing: docs/testing.md

Verification:
- <command 1>
- <command 2>

Completion report:
- What changed
- Which verification commands ran
- Remaining risks
```

### Recommended agent roles

- **Coordinator Agent:** task breakdown, merge order, API conflict tracking
- **Contract Agent:** `docs/openapi.yaml`, `docs/developer-guide.md`, API examples, generated frontend API types
- **Backend Agent:** Django features by app boundary
- **Frontend Agent:** React features by UI/state boundary
- **Testing Agent:** verification, failure reproduction, missing tests
- **Documentation Agent:** implementation notes, testing notes, changelog entries, developer explanations

### Branch model

Use one branch per task:

```text
codex/<area>-<short-task>
```

Examples:

```text
codex/catalog-query-filters
codex/raster-unique-values
codex/admin-user-groups
codex/map-layer-reorder
```

### Conflict-prone files

Avoid concurrent edits to these files unless the task explicitly owns them:

| File | Default owner | Reason |
| --- | --- | --- |
| `docs/openapi.yaml` | Contract Agent | Authoritative API contract |
| `frontend/src/api/schema.d.ts` | Contract Agent | Generated API types; never hand-edit |
| `frontend/src/types.ts` | Frontend architecture owner | Separates UI types from API DTOs |
| `backend/apps/core/permissions.py` | Permission owner | Central permission registry |
| `frontend/src/App.tsx` | Frontend architecture owner | Routing and auth gate entry |
| `docs/implementation-notes.md` | Documentation Agent | Shared implementation memory |
| `CHANGELOG.md` | Release owner | Release-level summary |

If multiple tasks need one of these files, merge the contract or foundation change first, then rebase dependent branches.

### Merge order for API changes

1. Contract change: `docs/openapi.yaml`, `docs/developer-guide.md`, generated `schema.d.ts`
2. Backend implementation: endpoint, permissions, service behavior, tests
3. Frontend implementation: API usage, UI behavior, frontend tests
4. Documentation and release notes: implementation notes, testing notes, `CHANGELOG.md`

Small tasks may combine these in one PR, but commits should still follow this order where practical.

## 7. Verification Checklist

Use the checklist that matches the touched area.

### Backend

```bash
cd backend
eval "$(mamba shell hook --shell zsh)" && mamba activate geomanager
python -m pytest
ruff format .
```

### Frontend

```bash
cd frontend
pnpm run check:api
pnpm test
pnpm run check
pnpm run typecheck
```

### API docs

```bash
cd frontend
pnpm run api:lint
pnpm run api:docs
```

### Pull request questions

- Did this change an API? If yes, were `docs/openapi.yaml`, `docs/developer-guide.md`, and `frontend/src/api/schema.d.ts` updated?
- Did this change permissions? If yes, were backend permission tests and frontend route/menu gate tests updated?
- Did this change data paths? If yes, are business-data and research-data roots still read only from TOML config?
- Did this touch raster rendering? If yes, does the backend still generate PNG/XYZ output while the frontend only loads rendered imagery?
- Which verification commands ran?
- Are there remaining performance, migration, data compatibility, or deployment risks?

## 8. Versioning and Releases

The project uses Semantic Versioning and Keep a Changelog format.

Version files:

- Frontend: `frontend/package.json`
- Backend: `backend/pyproject.toml`
- Changelog: `CHANGELOG.md`

Release workflow:

1. Update `CHANGELOG.md` with the new version changes.
2. Bump version using `make version-patch`, `make version-minor`, or `make version-major`.
3. Create a tag using `make tag` or `git tag -a v{version} -m "Version {version}"`.
4. Push changes and tags with `git push && git push --tags`.

Useful commands:

```bash
make help
make version-patch
make version-minor
make version-major
make changelog
make tag
```
