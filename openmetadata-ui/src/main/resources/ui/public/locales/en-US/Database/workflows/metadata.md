## DatabaseServiceMetadataPipeline

DatabaseService Metadata Pipeline Configuration.

- `$id`: `https://open-metadata.org/schema/metadataIngestion/databaseServiceMetadataPipeline.json`
- `$schema`: `http://json-schema.org/draft-07/schema#`
- `javaType`: `org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline`

### Definitions

#### `databaseMetadataConfigType`

Database Source Config Metadata Pipeline type

- `type`: `string`
- `enum`: `["DatabaseMetadata"]`
- `default`: `DatabaseMetadata`

### Properties

- `type`: Pipeline type
  - `$ref`: `#/definitions/databaseMetadataConfigType`
  - `default`: `DatabaseMetadata`
- `markDeletedTables`: This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply solely to the schema that is currently being ingested via the pipeline. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted.
  - `type`: `boolean`
  - `default`: `true`
- `markAllDeletedTables`: This is an optional configuration for enabling soft deletion of tables. When this option is enabled, only tables that have been deleted from the source will be soft deleted, and this will apply to all the schemas available in the data source. Any related entities such as test suites or lineage information that were associated with those tables will also be deleted. Do not enable this option when you have multiple metadata ingestion pipelines. Also make sure to enable the markDeletedTables option for this to work.
  - `type`: `boolean`
  - `default`: `false`
- `includeTables`: Optional configuration to turn off fetching metadata for tables.
  - `type`: `boolean`
  - `default`: `true`
- `includeViews`: Optional configuration to turn off fetching metadata for views.
  - `type`: `boolean`
  - `default`: `true`
- `includeTags`: Optional configuration to toggle the tags ingestion.
  - `type`: `boolean`
  - `default`: `true`
- `useFqnForFiltering`: Regex will be applied on fully qualified name (e.g service_name.db_name.schema_name.table_name) instead of raw name (e.g. table_name)
  - `type`: `boolean`
  - `default`: `false`
- `schemaFilterPattern`: Regex to only fetch tables or databases that matches the pattern.
  - `$ref`: `../type/filterPattern.json#/definitions/filterPattern`
- `tableFilterPattern`: Regex exclude tables or databases that matches the pattern.
  - `$ref`: `../type/filterPattern.json#/definitions/filterPattern`
- `databaseFilterPattern`: Regex to only fetch databases that matches the pattern.
  - `$ref`: `../type/filterPattern.json#/definitions/filterPattern`

### Additional Properties

- `additionalProperties`: `false`
