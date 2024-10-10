CREATE TABLE {schema_name}."table" (
    one DOUBLE,
    two VARCHAR,
    three BOOLEAN,
    four TIMESTAMP,
    five TIMESTAMP,
    __index_level_0__ VARCHAR
)
WITH (
    external_location = 's3a://hive-warehouse/table',
    format = 'PARQUET'
)