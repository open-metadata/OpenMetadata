# GCS Folder-Only Ingestion Feature

## Overview

The GCS connector now supports folder-only ingestion mode, which allows users to ingest and visualize the complete folder hierarchy without listing or ingesting individual files. This is particularly useful for governance, discovery, and understanding storage structure without the overhead of tracking millions of files.

## Configuration

Add the `foldersOnly` boolean field to your metadata entry in either:
- Container metadata config (for single-bucket configurations)
- Manifest metadata config (for multi-bucket configurations)

### Schema Definition

```json
{
  "foldersOnly": {
    "title": "Folders Only",
    "description": "When true, ingests only the folder hierarchy without listing or ingesting files. Useful for visualizing storage structure without file-level metadata.",
    "type": "boolean",
    "default": false
  }
}
```

## Usage Examples

### 1. Basic Folder-Only Ingestion

**Manifest Example:**
```json
{
  "entries": [
    {
      "containerName": "my-data-bucket",
      "dataPath": "project-data/",
      "foldersOnly": true
    }
  ]
}
```

**Result:** Ingests all folder paths under `gs://my-data-bucket/project-data/` without creating containers for files.

### 2. Folder-Only with Depth Parameter

**Manifest Example:**
```json
{
  "entries": [
    {
      "containerName": "my-data-bucket",
      "dataPath": "logs/",
      "structureFormat": "json",
      "depth": 3,
      "foldersOnly": true
    }
  ]
}
```

**Result:** Creates folder containers at depth level 3 under the logs path, without ingesting individual files.

### 3. Mixed Mode Configuration

```json
{
  "entries": [
    {
      "containerName": "my-data-bucket",
      "dataPath": "archive/",
      "foldersOnly": true
    },
    {
      "containerName": "my-data-bucket",
      "dataPath": "current/",
      "unstructuredFormats": ["*"]
    }
  ]
}
```

**Result:**
- Archive folders: Only folder hierarchy (no files)
- Current folders: Full ingestion with folders and files

## Behavior

### When `foldersOnly: true`

1. **With `structureFormat` and `depth`:**
   - Uses `_generate_structured_containers_by_depth_folders_only()`
   - Creates containers at specified depth level
   - No schema inference or file scanning
   - No data model attached to containers

2. **With `unstructuredFormats` or default:**
   - Uses `_yield_folder_hierarchy()`
   - Extracts unique folder paths from all objects
   - Creates parent containers for all intermediate folders
   - No leaf (file) containers created

### When `foldersOnly: false` (default)

- Normal ingestion behavior
- Files are listed and ingested as containers
- Schema inference happens for structured formats
- Full metadata extraction

## Use Cases

### 1. Governance and Discovery
- Visualize data lake organization without file clutter
- Document folder naming conventions
- Audit storage hierarchy compliance
- Understand data distribution across folders

### 2. Performance Optimization
For buckets with millions of files:
- Reduce ingestion time (no file enumeration needed)
- Lower GCP API costs (fewer list operations)
- Minimize metadata storage requirements
- Focus on high-level organization

### 3. Hybrid Data Management
- Use `foldersOnly: true` for archive/historical data
- Use `foldersOnly: false` for active data requiring file tracking
- Apply different strategies per data tier
- Balance between visibility and performance

## Limitations and Considerations

### Current Limitations

1. **Pagination Limit**: Current implementation uses `max_results=1000` for blob listings
   - For paths with more than 1000 objects, some folders might be missed
   - This is a known limitation shared with existing depth-based ingestion
   - Future enhancement: Implement pagination to handle very large buckets

2. **Snapshot-Based**: Folder structure reflects the state at ingestion time
   - New folders created after ingestion won't appear until next run
   - Deleted folders may still show until manual cleanup

3. **No Aggregated Metrics**: Folder-only mode does not provide:
   - File count per folder
   - Size aggregation per folder
   - File type distribution

### Best Practices

- For buckets with >1000 objects in a single prefix, consider using more specific `dataPath` values
- Run periodic ingestion to keep folder structure up-to-date
- Combine with selective file ingestion for critical data paths

## Testing

Unit tests added in `test_gcs_folders_only.py`:
- `test_folders_only_extracts_hierarchy`: Verifies folder extraction without files
- `test_folders_only_false_includes_files`: Ensures default behavior unchanged
- `test_folders_only_with_depth`: Tests folder-only mode with depth parameter
