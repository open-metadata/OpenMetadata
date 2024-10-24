CREATE TABLE {schema_name}."titanic" (
    PassengerId BIGINT,
    Survived BIGINT,
    Pclass BIGINT,
    Name VARCHAR,
    Sex VARCHAR,
    Age DOUBLE,
    SibSp BIGINT,
    Parch BIGINT,
    Ticket VARCHAR,
    Fare DOUBLE,
    Cabin VARCHAR,
    Embarked VARCHAR
)
WITH (
    external_location = 's3a://hive-warehouse/titanic',
    format = 'PARQUET'
)