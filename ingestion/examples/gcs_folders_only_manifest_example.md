# Example Manifest for Folder-Only Ingestion

This example demonstrates how to use the `foldersOnly` feature to ingest only the folder hierarchy without listing or ingesting files.

## Example 1: Basic Folder-Only Ingestion

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

This will ingest all folders under `gs://my-data-bucket/project-data/` without creating containers for individual files.

## Example 2: Folder-Only with Depth

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

This will create folder containers at depth level 3 under `gs://my-data-bucket/logs/` without ingesting files.

## Example 3: Mixed Mode - Some Folders Only, Some With Files

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
      "unstructuredFormats": ["*"],
      "foldersOnly": false
    }
  ]
}
```

This configuration:
- Ingests only the folder hierarchy for `archive/` (no files)
- Ingests both folders and files for `current/`

## Use Cases

### Governance and Discovery
When you need to understand storage structure without the overhead of tracking individual files:
- Visualize data lake organization
- Document folder naming conventions
- Audit storage hierarchy compliance

### Performance Optimization
For buckets with millions of files:
- Reduce ingestion time by skipping file enumeration
- Lower API costs by minimizing list operations
- Focus on high-level organization rather than file details

### Hybrid Approaches
Combine with other metadata entries:
- Use `foldersOnly: true` for historical/archive folders
- Use `foldersOnly: false` for active data folders
- Apply different ingestion strategies per data tier
