# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Added role-scoped thematic publishing with immutable published versions, audience groups, object-level capabilities and restore-to-project workflow
- Added workspace snapshots, resource manifests and SHA-256 checksums to thematic output versions for reproducible project restoration
- Added project-to-thematic-map composition workflow with persisted layouts, immutable versions, PNG/JPG/PDF artifacts, preview, publish and archive actions
- Added A4/A3 layouts, overview maps, geographic/Web Mercator grids, automatic legends, north arrows, scale bars, data sources and cartographic notes
- Version management system with bump scripts for frontend and backend
- Makefile for unified version management commands
- CHANGELOG.md to track project changes

### Fixed

- Route thematic map basemaps through the platform tile proxy/cache, wait for complete tiles, retry transient failures and cancel stale auto-preview renders instead of exporting partial black maps
- Unified thematic inventory around `MapComposition`; removed the duplicate legacy `WorkspaceScene(topic)` creation and display flow
- Kept draft and unpublished thematic maps private to their owners, platform administrators and super administrators
- Preserve unsaved map-composition edits when the live map view or source summary changes
- Recommend usable geographic and Web Mercator grid intervals for both local and regional extents

## [0.1.0] - 2026-05-28

### Added
- Initial project setup with frontend (React + Vite + Ant Design + Mapbox GL JS) and backend (Python + Django)
- Unified feature permissions system
- Layer export functionality
- Workspace panel layout for map interface
- User authentication and authorization system
- Data management capabilities
- Raster data processing and visualization
- Vector data display with GeoPackage support
- Configuration management via TOML files
- Docker deployment support

### Changed
- Refactored codebase for better organization
- Renamed files and directories for consistency
- Adjusted workspace panel layout for improved user experience
- Formatted code according to project standards

### Fixed
- UI fixes for better visual consistency
- Resolved issues with raster image loading
- Fixed various bugs and minor issues

### Removed
- Removed full raster image loading for performance optimization
