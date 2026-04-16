# Metadata

Storage Service Metadata Pipeline Configuration.

## Configuration

$$section

### Container Filter Pattern $(id="containerFilterPattern")

Container filter patterns are used to control whether to include Containers as part of metadata ingestion.

**Include**: Explicitly include Containers by adding a list of regular expressions to the `Include` field. OpenMetadata will include all Containers with names matching one or more of the supplied regular expressions. All other Containers will be excluded.

For example, to include only those Containers whose name starts with the word `demo`, add the regex pattern in the include field as `^demo.*`.

**Exclude**: Explicitly exclude Containers by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all Containers with names matching one or more of the supplied regular expressions. All other Containers will be included.

For example, to exclude all Containers with the name containing the word `demo`, add regex pattern in the exclude field as `.*demo.*`.

Checkout <a href="https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/database#database-filter-pattern" target="_blank">this</a> document for further examples on filter patterns.
$$

$$section
### Enable Debug Logs $(id="enableDebugLog")

Set the `Enable Debug Log` toggle to set the logging level of the process to debug. You can check these logs in the Ingestion tab of the service and dig deeper into any errors you might find.
$$

$$section
### Manifest $(id="manifest")

Inline manifest entries for auto-discovering data in object storage. Each entry defines a glob-style `pathPattern` that matches files in the bucket; OpenMetadata groups matched files into logical containers and infers their schema.

Use this instead of the external `openmetadata.json` manifest file (listed under "Storage Metadata Configuration Source" — deprecated). A single manifest entry with `data/**/*.parquet` can replace dozens of manually-listed paths, and new tables appear automatically as data lands in the bucket.

Click **+** to add a manifest entry. Each entry supports:

- **Path Pattern**: the glob to match files (required)
- **Unstructured Data**: toggle for non-tabular files (images, docs, PDFs)
- **Structure Format**: override the file format, or leave blank to auto-detect from the extension
- **Separator**: CSV delimiter when applicable
- **Auto Partition Detection**: detect Hive-style `key=value` partitions from directory names
- **Exclude Paths / Exclude Patterns**: skip internal or temp folders
- **Partition Columns**: explicitly declare partition columns for non-Hive layouts

Add multiple entries to discover different formats or paths from the same bucket — for example one entry for Parquet data lake files and another for CSV exports.
$$

$$section
### Path Pattern $(id="pathPattern")

Glob-style path pattern relative to the bucket root. OpenMetadata lists objects under this pattern and groups matching files into logical containers.

**Wildcards**:

- `*` matches a single path level (no slashes) — e.g. `data/*/events.parquet` matches `data/us/events.parquet` but not `data/us/2025/events.parquet`.
- `**` matches any depth — e.g. `data/**/*.parquet` matches every Parquet file under `data/`, at any depth.
- `?` matches a single character.

**Examples**:

- `data/**/*.parquet` — all Parquet files anywhere under `data/`
- `logs/year=*/month=*/day=*/*.json` — partitioned JSON logs
- `exports/*.csv` — CSVs directly under `exports/`

**Tip**: the longest non-wildcard prefix (e.g. `data/` in `data/**/*.parquet`) is used to optimize the S3 listing — keep the static prefix as long as possible for large buckets.
$$

$$section
### Unstructured Data $(id="unstructuredData")

When enabled, files matching the path pattern are cataloged as individual containers **without schema extraction**. Use this for images, documents, videos, PDFs, and other non-tabular files.

When enabled, `Structure Format`, `Separator`, `Auto Partition Detection`, and `Partition Columns` are ignored.

**Example** — catalog all PNG images in a bucket:

```
pathPattern: images/**/*.png
unstructuredData: true
```
$$

$$section
### Structure Format $(id="structureFormat")

Expected file format for schema inference. Leave blank (default: **Auto-detect from extension**) to let OpenMetadata infer the format from the file extension.

Supported formats: `parquet`, `csv`, `tsv`, `avro`, `json`, `jsonl`.

Set this explicitly only when:

- The file extension doesn't match the actual format (e.g., CSV files saved as `.txt`).
- Multiple formats share an extension and you want to force one.

**Ignored when Unstructured Data is enabled.**
$$

$$section
### Separator $(id="separator")

For delimited text files (CSV / TSV), the separator character. Defaults to `,` for CSV and `\t` for TSV when blank.

Only applies when `Structure Format` is `csv` or `tsv`.
$$

$$section
### Auto Partition Detection $(id="autoPartitionDetection")

When enabled, OpenMetadata automatically detects Hive-style partition columns from directory names like `year=2024/month=01/day=15/`.

**How it works**: after matching files with `Path Pattern`, OpenMetadata inspects the path segments. Segments shaped like `key=value` are treated as partition columns. Column types are inferred from the values:

- `year=2024` → `INT`
- `date=2024-01-15` → `DATE`
- `region=us-west` → `VARCHAR`

Disable this toggle if your partitions are not Hive-style (e.g., date-prefixed folders like `20240115/`) and instead declare them explicitly under **Partition Columns**.
$$

$$section
### Exclude Paths $(id="excludePaths")

Path segments to skip during discovery. Any file whose path contains one of these segments is ignored.

Defaults to common internal paths: `_delta_log`, `_temporary`, `_spark_metadata`, `.tmp`, `_SUCCESS`.

Add segments here to skip folders like `archive/`, `backup/`, or `_checkpoint/`.
$$

$$section
### Exclude Patterns $(id="excludePatterns")

Glob patterns to exclude from discovery. Any file whose path matches one of these globs is skipped.

Use this when you need wildcard-based exclusion (stronger than `Exclude Paths`). Examples:

- `data/archive/**` — skip everything under `data/archive`
- `data/tmp_*/**` — skip any folder starting with `tmp_`
$$

$$section
### Partition Columns $(id="partitionColumns")

Explicit partition column definitions. **Overrides auto-detection** when provided.

Use this when `Auto Partition Detection` cannot determine the partition structure — typically when partitions are non-Hive (e.g., directories named `20240115/` instead of `date=2024-01-15/`).

Each entry requires:

- **Name**: partition column name (e.g. `event_date`)
- **Data Type**: the column data type (e.g. `INT`, `DATE`, `VARCHAR`)
- **Data Type Display** *(optional)*: friendly display name
- **Description** *(optional)*: human-readable description

**Leave empty** to rely on auto-detection, which covers standard Hive-style layouts.
$$

$$section
### Override Metadata $(id="overrideMetadata")

Set the `Override Metadata` toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source.

If the toggle is `enabled`, the metadata fetched from the source will override and replace the existing metadata in the OpenMetadata.

If the toggle is `disabled`, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. In this case the metadata will only get updated for fields that has no value added in OpenMetadata.

This is applicable for fields like description, tags, owner and displayName

$$

$$section
### Number of Retries $(id="retries")

Times to retry the workflow in case it ends with a failure.
$$

$$section
### Raise on Error $(id="raiseOnError")

Mark the workflow as failed or avoid raising exceptions.
$$