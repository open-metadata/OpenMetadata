---
title: driveServiceMetadataPipeline
slug: /main-concepts/metadata-standard/schemas/metadataingestion/driveservicemetadatapipeline
---

# DriveServiceMetadataPipeline

*DriveService Metadata Pipeline Configuration.*

## Properties

- **`type`**: Pipeline type. Refer to *#/definitions/driveMetadataConfigType*. Default: `DriveMetadata`.
- **`markDeletedDirectories`** *(boolean)*: Optional configuration to soft delete directories in OpenMetadata if the source directories are deleted. Also, if the directory is deleted, all the associated entities like files, spreadsheets, worksheets, lineage, etc., with that directory will be deleted. Default: `True`.
- **`markDeletedFiles`** *(boolean)*: Optional configuration to soft delete files in OpenMetadata if the source files are deleted. Also, if the file is deleted, all the associated entities like lineage, etc., with that file will be deleted. Default: `True`.
- **`markDeletedSpreadsheets`** *(boolean)*: Optional configuration to soft delete spreadsheets in OpenMetadata if the source spreadsheets are deleted. Also, if the spreadsheet is deleted, all the associated entities like worksheets, lineage, etc., with that spreadsheet will be deleted. Default: `True`.
- **`markDeletedWorksheets`** *(boolean)*: Optional configuration to soft delete worksheets in OpenMetadata if the source worksheets are deleted. Also, if the worksheet is deleted, all the associated entities like lineage, etc., with that worksheet will be deleted. Default: `True`.
- **`includeDirectories`** *(boolean)*: Optional configuration to turn off fetching metadata for directories. Default: `True`.
- **`includeFiles`** *(boolean)*: Optional configuration to turn off fetching metadata for files. Default: `True`.
- **`includeSpreadsheets`** *(boolean)*: Optional configuration to turn off fetching metadata for spreadsheets. Default: `True`.
- **`includeWorksheets`** *(boolean)*: Optional configuration to turn off fetching metadata for worksheets. Default: `True`.
- **`includeTags`** *(boolean)*: Optional configuration to toggle the tags ingestion. Default: `True`.
- **`includeOwners`** *(boolean)*: Set the 'Include Owners' toggle to control whether to include owners to the ingested entity if the owner email matches with a user stored in the OM server as part of metadata ingestion. If the ingested entity already exists and has an owner, the owner will not be overwritten. Default: `False`.
- **`overrideMetadata`** *(boolean)*: Set the 'Override Metadata' toggle to control whether to override the existing metadata in the OpenMetadata server with the metadata fetched from the source. If the toggle is set to true, the metadata fetched from the source will override the existing metadata in the OpenMetadata server. If the toggle is set to false, the metadata fetched from the source will not override the existing metadata in the OpenMetadata server. This is applicable for fields like description, tags, owner and displayName. Default: `False`.
- **`useFqnForFiltering`** *(boolean)*: Regex will be applied on fully qualified name (e.g service_name.directory_name.file_name) instead of raw name (e.g. file_name). Default: `False`.
- **`directoryFilterPattern`**: Regex to only include/exclude directories that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`fileFilterPattern`**: Regex to only include/exclude files that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`spreadsheetFilterPattern`**: Regex to only include/exclude spreadsheets that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`worksheetFilterPattern`**: Regex to only include/exclude worksheets that matches the pattern. Refer to *../type/filterPattern.json#/definitions/filterPattern*.
- **`threads`** *(integer)*: Number of Threads to use in order to parallelize Drive ingestion. Default: `1`.
## Definitions

- **`driveMetadataConfigType`** *(string)*: Drive Source Config Metadata Pipeline type. Must be one of: `['DriveMetadata']`. Default: `DriveMetadata`.


Documentation file automatically generated at 2025-08-12 05:39:47.683420+00:00.
