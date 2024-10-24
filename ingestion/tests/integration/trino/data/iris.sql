CREATE TABLE {schema_name}.iris (
    "sepal.length" DOUBLE,
    "sepal.width" DOUBLE,
    "petal.length" DOUBLE,
    "petal.width" DOUBLE,
    "variety" VARCHAR
)
WITH (
    external_location = 's3a://hive-warehouse/iris',
    format = 'PARQUET'
)