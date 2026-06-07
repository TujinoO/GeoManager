# huyang_system

Central Asia Poplar Forest Ecosystem Protection Data Sharing Platform (中亚胡杨林生态系统保护数据共享平台).

## Attention

- Summarise the details into documents (docs/) for reference during the coding process.
- format code before commiting git.
- **API doc sync**: Whenever a backend API endpoint is added, removed, or modified (URL, request params, response format, permissions, etc.), update `docs/developer-guide.md` accordingly.
- **OpenAPI specification**: All API endpoints MUST be defined in `docs/openapi.yaml` following OpenAPI 3.1.0 specification. See `docs/openapi-standards.md` for mandatory standards.

## Key reference

- **Design doc**: `./desgin-docs.md` — full functional spec, tech stack, data model, and acceptance criteria. Read it before writing any code.

## Planned tech stack (from design doc)

- **Frontend**: React + Vite + Ant Design + Mapbox GL JS
- **Backend**: Python + Django + GeoPandas + GDAL + Rasterio
- **Data**: SQLite (business), GeoPackage `.gpkg` (vector), raw raster files, PNG cache
- **Config**: TOML — defines business-data root dir, research-data root dir, cache limits, raster symbolization interface

## Architecture principles (must-follow)

- Program code, business data, and research data must be stored in separate directory trees.
- Business-data root and research-data root are set in the TOML config file, not hardcoded.
- Subdirectory layout under the two data roots is fixed by convention, not configurable per-item.
- Raster files are never symbolized in the browser. Backend Python scripts generate PNG; frontend loads the PNG.
- Each raster type can have its own symbolization script, invoked through a unified interface with stdin/stdout contract.
- PNG cache is keyed by (raster file + rules + output size). Cache has a size cap and cleanup policy from TOML config.
- Roles: normal user, researcher, data admin, system admin. Backend admin is a login后 feature gated by permission, not a separate entry point.

## Conventions to follow when code lands

- Use Django built-in auth, admin, session, and permission systems where possible. Don't reinvent user/role/permission from scratch.
- Ant Design is the primary UI component library for all non-map interfaces.
- Mapbox GL JS handles all map rendering. Do not put raster symbolization logic in the frontend.
- Design doc specifies performance targets: map ≥20fps, layer ops ≤500ms, query ≤1s for ≤30k rows.

## Environment setup

- **Node.js**: Use `pnpm` as the package manager for frontend dependencies.
- **Python**: Use `eval "$(mamba shell hook --shell zsh)" && mamba activate geomanager` to activate the Python environment before running any backend commands.

## Format code

### frontend
refer to pnpm scripts:

```
"format": "biome format . --write",
"lint": "biome lint .",
"check": "biome check .",
"fix": "biome check . --write"
```

### backend

activate python and run `ruff format .`

## Version management

The project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format.

### Quick commands

```bash
# View available commands
make help

# Bump patch version (0.1.0 -> 0.1.1)
make version-patch

# Bump minor version (0.1.0 -> 0.2.0)
make version-minor

# Bump major version (0.1.0 -> 1.0.0)
make version-major

# Generate changelog
make changelog

# Create git tag
make tag
```

### Version files

- **Frontend**: `frontend/package.json` - version field
- **Backend**: `backend/pyproject.toml` - version field
- **Changelog**: `CHANGELOG.md` - project root

### Release workflow

1. Update CHANGELOG.md with new version changes
2. Bump version using `make version-patch/minor/major`
3. Create git tag using `make tag` or `git tag -a v{version} -m "Version {version}"`
4. Push changes and tags: `git push && git push --tags`

## OpenAPI Specification

All backend API endpoints MUST be defined using OpenAPI 3.1.0 specification.

### Key Files

- **OpenAPI Definition**: `docs/openapi.yaml` — the authoritative API definition
- **Standards Document**: `docs/openapi-standards.md` — mandatory standards and guidelines
- **API Documentation**: `docs/developer-guide.md` — human-readable API documentation (must stay in sync with openapi.yaml)

### Requirements

1. All new API endpoints MUST be added to `docs/openapi.yaml` before implementation
2. All API changes MUST update both `docs/openapi.yaml` and `docs/developer-guide.md`
3. Every operation MUST have a unique `operationId` using camelCase
4. All parameters and schemas MUST have complete `description` fields
5. Error responses MUST use the standard `ErrorResponse` schema with `detail` field
6. Authentication MUST be declared using `securitySchemes` in components

### Validation

Before committing API changes, validate the OpenAPI document:

```bash
# Install swagger-cli (if not installed)
npm install -g @apidevtools/swagger-cli

# Validate OpenAPI document
swagger-cli validate docs/openapi.yaml
```

## Other instructions:

- Avoid the use of the !important style.
- Avoid using the index of an array as key property in an element.