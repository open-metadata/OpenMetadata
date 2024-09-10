CREATE TABLE {schema_name}.empty (
    a INT,
    b INT
)
WITH (
    external_location = 's3a://hive-warehouse/empty',
    format = 'PARQUET'
)