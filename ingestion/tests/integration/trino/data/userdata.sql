CREATE TABLE {schema_name}."userdata" (
    registration_dttm TIMESTAMP,
    id INT,
    first_name VARCHAR,
    last_name VARCHAR,
    email VARCHAR,
    gender VARCHAR,
    ip_address VARCHAR,
    cc VARCHAR,
    country VARCHAR,
    birthdate VARCHAR,
    salary DOUBLE,
    title VARCHAR,
    comments VARCHAR
)
WITH (
    external_location = 's3a://hive-warehouse/userdata',
    format = 'PARQUET'
)