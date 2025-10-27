# Metadata

Drive Service Metadata Pipeline Configuration.

## Configuration

$$section
### Directory Filter Pattern $(id="directoryFilterPattern")

Directory filter patterns are used to control whether to include specific directories as part of metadata ingestion.

**Include**: Explicitly include directories by adding a list of regular expressions to the `Include` field. OpenMetadata will include all directories with names matching one or more of the supplied regular expressions. All other directories will be excluded.

For example, to include only those directories whose name starts with the word `project`, add the regex pattern in the include field as `^project.*`.

**Exclude**: Explicitly exclude directories by adding a list of regular expressions to the `Exclude` field. OpenMetadata will exclude all directories with names matching one or more of the supplied regular expressions. All other directories will be included.

For example, to exclude all directories with the name containing the word `archive`, add regex pattern in the exclude field as `.*archive.*`.

Checkout [this](https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns) document for further examples on filter patterns.
$$

$$section
### File Filter Pattern $(id="fileFilterPattern")

File filter patterns allow you to control which files are included in the metadata extraction based on their names or extensions.

**Include**: Add regular expressions to include specific file types. For example:
- `.*\.xlsx?$` - Include Excel files
- `.*\.csv$` - Include CSV files
- `.*\.pdf$` - Include PDF documents
- `.*\.docx?$` - Include Word documents
**Exclude**: Add regular expressions to exclude specific file types. For example:
- `~\$.*` - Exclude temporary files
- `\.tmp$` - Exclude files with .tmp extension
- `^\..*` - Exclude hidden files
$$

$$section
### Spreadsheet Filter Pattern $(id="spreadsheetFilterPattern")

Spreadsheet filter patterns control which spreadsheet files (like Google Sheets or Excel files) are included in metadata extraction.

**Include**: Add regular expressions to include specific spreadsheets based on their names.

**Exclude**: Add regular expressions to exclude specific spreadsheets.

This is particularly useful when you want to process only certain spreadsheets as data sources while ignoring others.
$$

$$section
### Worksheet Filter Pattern $(id="worksheetFilterPattern")

Worksheet filter patterns allow you to control which worksheets within spreadsheets are included in the metadata extraction.

**Include**: Add regular expressions to include specific worksheets based on their names. For example:
- `^data_.*` - Include worksheets starting with "data_"
- `.*_final$` - Include worksheets ending with "_final"

**Exclude**: Add regular expressions to exclude specific worksheets. For example:
- `^temp_.*` - Exclude temporary worksheets
- `.*_draft$` - Exclude draft worksheets
$$

$$section
### Include Directories $(id="includeDirectories")

Optional configuration to turn on/off fetching metadata for directories.

When enabled (default: true), the connector will extract metadata for directories including:
- Directory structure and hierarchy
- Directory permissions and ownership
- Directory metadata like creation date, modification date
Disable this if you only want to extract file-level metadata without directory information.
$$

$$section
### Include Files $(id="includeFiles")

Optional configuration to turn on/off fetching metadata for files.

When enabled (default: true), the connector will extract metadata for all types of files including:
- Documents (PDF, Word, etc.)
- Images
- Videos
- Other file types
Disable this if you only want to extract directory or spreadsheet metadata.
$$

$$section
### Include Spreadsheets $(id="includeSpreadsheets")

Optional configuration to turn on/off fetching metadata for spreadsheets.

When enabled (default: true), the connector will process spreadsheet files (Google Sheets, Excel) as structured data sources, extracting:
- Spreadsheet structure
- Sheet names and relationships
- Basic schema information
Disable this if you don't want to process spreadsheets as data sources.
$$

$$section
### Include Worksheets $(id="includeWorksheets")

Optional configuration to turn on/off fetching metadata for individual worksheets within spreadsheets.

When enabled (default: true), the connector will extract detailed metadata for each worksheet including:
- Column headers and data types
- Row counts
- Worksheet-specific metadata
Disable this if you only want spreadsheet-level metadata without worksheet details.
$$

$$section
### Include Tags $(id="includeTags")

Optional configuration to toggle the tags ingestion.

When enabled (default: true), the connector will extract and apply tags from the source drive system to the ingested entities in OpenMetadata.
$$

$$section
### Include Owners $(id="includeOwners")

Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OpenMetadata server as part of metadata ingestion.

If the ingested entity already exists and has an owner, the owner will not be overwritten.

Default: false
$$

$$section
### Mark Deleted Directories $(id="markDeletedDirectories")

Optional configuration to soft delete directories in OpenMetadata if the source directories are deleted.

When enabled (default: true), if a directory is deleted in the source:
- The directory will be marked as deleted in OpenMetadata
- All associated entities (files, spreadsheets, worksheets, lineage) will also be deleted

Disable this to preserve directory metadata in OpenMetadata even when deleted from the source.
$$

$$section
### Mark Deleted Files $(id="markDeletedFiles")

Optional configuration to soft delete files in OpenMetadata if the source files are deleted.

When enabled (default: true), if a file is deleted in the source:
- The file will be marked as deleted in OpenMetadata
- All associated entities (lineage, relationships) will also be deleted

Disable this to preserve file metadata in OpenMetadata even when deleted from the source.
$$

$$section
### Mark Deleted Spreadsheets $(id="markDeletedSpreadsheets")

Optional configuration to soft delete spreadsheets in OpenMetadata if the source spreadsheets are deleted.

When enabled (default: true), if a spreadsheet is deleted in the source:
- The spreadsheet will be marked as deleted in OpenMetadata
- All associated worksheets and lineage will also be deleted

Disable this to preserve spreadsheet metadata in OpenMetadata even when deleted from the source.
$$

$$section
### Mark Deleted Worksheets $(id="markDeletedWorksheets")

Optional configuration to soft delete worksheets in OpenMetadata if the source worksheets are deleted.

When enabled (default: true), if a worksheet is deleted in the source:
- The worksheet will be marked as deleted in OpenMetadata
- All associated lineage will also be deleted

Disable this to preserve worksheet metadata in OpenMetadata even when deleted from the source.
$$

$$section
### Use FQN For Filtering $(id="useFqnForFiltering")

When enabled, regex patterns will be applied on the fully qualified name (FQN) instead of just the raw name.

For example:
- FQN: `service_name.directory_name.file_name`
- Raw name: `file_name`

This is useful when you want to filter based on the complete path or hierarchy rather than just the item name.

Default: false
$$

$$section
### Override Metadata $(id="overrideMetadata")

Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source.

If the toggle is `enabled`, the metadata fetched from the source will override and replace the existing metadata in OpenMetadata.

If the toggle is `disabled`, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. In this case, the metadata will only get updated for fields that have no value added in OpenMetadata.

This is applicable for fields like description, tags, owner, and displayName.

Default: false
$$

$$section
### Number of Threads $(id="threads")

Number of threads to use in order to parallelize Drive ingestion.

Increasing the number of threads can improve ingestion performance for large drive structures, but may also increase resource consumption and API rate limit pressure.

Recommended values:
- 1 thread: Safe default for small to medium drives
- 2-4 threads: Medium to large drives with good network bandwidth
- 5+ threads: Very large drives with enterprise API limits
Default: 1
$$