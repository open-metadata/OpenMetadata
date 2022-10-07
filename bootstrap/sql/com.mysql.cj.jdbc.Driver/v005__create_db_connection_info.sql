DELETE FROM entity_relationship
WHERE toEntity = 'ingestionPipeline'
AND toId NOT IN (
	SELECT DISTINCT id 
	FROM ingestion_pipeline_entity
);

CREATE TABLE IF NOT EXISTS user_tokens (
    token VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.token') STORED NOT NULL,
    userId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.userId') STORED NOT NULL,
    tokenType VARCHAR(50) GENERATED ALWAYS AS (json ->> '$.tokenType') STORED NOT NULL,
    json JSON NOT NULL,
    expiryDate BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.expiryDate') NOT NULL,
    PRIMARY KEY (token)
);

UPDATE dbservice_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.metastoreHostPort'),
        '$.connection.config.metastoreConnection',
        JSON_OBJECT('metastoreHostPort', JSON_EXTRACT(json, '$.connection.config.metastoreHostPort'))
    )
where serviceType = 'DeltaLake'
  and JSON_EXTRACT(json, '$.connection.config.metastoreHostPort') is not null;

UPDATE dbservice_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.metastoreFilePath'),
        '$.connection.config.metastoreConnection',
        JSON_OBJECT('metastoreFilePath', JSON_EXTRACT(json, '$.connection.config.metastoreFilePath'))
    )
where serviceType = 'DeltaLake'
  and JSON_EXTRACT(json, '$.connection.config.metastoreFilePath') is not null;


ALTER TABLE test_definition 
ADD COLUMN supported_data_types JSON GENERATED ALWAYS AS (json -> '$.supportedDataTypes');

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.name'),
	'$.name',
	'tableColumnCountToEqual'
)
WHERE BINARY name = 'TableColumnCountToEqual';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.fullyQualifiedName'),
	'$.fullyQualifiedName',
	'tableColumnCountToEqual'
)
WHERE BINARY JSON_CONTAINS(json, '"TableColumnCountToEqual"', '$.fullyQualifiedName');


UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.name'),
	'$.name',
	'tableColumnToMatchSet'
)
WHERE BINARY name = 'TableColumnToMatchSet';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.fullyQualifiedName'),
	'$.fullyQualifiedName',
	'tableColumnToMatchSet'
)
WHERE BINARY JSON_CONTAINS(json, '"TableColumnToMatchSet"', '$.fullyQualifiedName');


UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.name'),
	'$.name',
	'tableColumnNameToExist'
)
WHERE BINARY name = 'TableColumnNameToExist';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.fullyQualifiedName'),
	'$.fullyQualifiedName',
	'tableColumnNameToExist'
)
WHERE BINARY JSON_CONTAINS(json, '"TableColumnNameToExist"', '$.fullyQualifiedName');


UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.name'),
	'$.name',
	'tableRowCountToBeBetween'
)
WHERE BINARY name = 'TableRowCountToBeBetween';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.fullyQualifiedName'),
	'$.fullyQualifiedName',
	'tableRowCountToBeBetween'
)
WHERE BINARY JSON_CONTAINS(json, '"TableRowCountToBeBetween"', '$.fullyQualifiedName');


UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.name'),
	'$.name',
	'tableColumnCountToBeBetween'
)
WHERE BINARY name = 'TableColumnCountToBeBetween';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.fullyQualifiedName'),
	'$.fullyQualifiedName',
	'tableColumnCountToBeBetween'
)
WHERE BINARY JSON_CONTAINS(json, '"TableColumnCountToBeBetween"', '$.fullyQualifiedName');


UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.name'),
	'$.name',
	'columnValuesToBeInSet'
)
WHERE BINARY name = 'ColumnValuesToBeInSet';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.fullyQualifiedName'),
	'$.fullyQualifiedName',
	'columnValuesToBeInSet'
)
WHERE BINARY JSON_CONTAINS(json, '"ColumnValuesToBeInSet"', '$.fullyQualifiedName');


UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.name'),
	'$.name',
	'tableRowCountToEqual'
)
WHERE BINARY name = 'TableRowCountToEqual';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.fullyQualifiedName'),
	'$.fullyQualifiedName',
	'tableRowCountToEqual'
)
WHERE BINARY JSON_CONTAINS(json, '"TableRowCountToEqual"', '$.fullyQualifiedName');



UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT')
)
WHERE name = 'columnValueMaxToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT', 'ARRAY', 'SET')
)
WHERE name = 'columnValueMeanToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT')
)
WHERE name = 'columnValueMedianToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT')
)
WHERE name = 'columnValueMinToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('BYTES', 'STRING', 'MEDIUMTEXT', 'TEXT', 'CHAR', 'VARCHAR', 'ARRAY')
)
WHERE name = 'columnValueLengthsToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER','TINYINT','SMALLINT','INT','BIGINT','BYTEINT','BYTES','FLOAT','DOUBLE','DECIMAL','NUMERIC','TIMESTAMP','TIMESTAMPZ','TIME','DATE','DATETIME','INTERVAL','STRING','MEDIUMTEXT','TEXT','CHAR','VARCHAR','BOOLEAN','BINARY','VARBINARY','ARRAY','BLOB','LONGBLOB','MEDIUMBLOB','MAP','STRUCT','UNION','SET','GEOGRAPHY','ENUM','JSON','UUID','VARIANT','GEOMETRY','POINT','POLYGON')
)
WHERE name = 'columnValuesMissingCount'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT')
)
WHERE name = 'columnValuesSumToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT')
)
WHERE name = 'columnValueStdDevToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT')
)
WHERE name = 'columnValuesToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT', 'BYTES', 'STRING', 'MEDIUMTEXT', 'TEXT', 'CHAR', 'VARCHAR')
)
WHERE name = 'columnValuesToBeInSet'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER', 'INT', 'FLOAT', 'DOUBLE', 'DECIMAL', 'TINYINT', 'SMALLINT', 'BIGINT', 'BYTEINT', 'BYTES', 'STRING', 'MEDIUMTEXT', 'TEXT', 'CHAR', 'VARCHAR')
)
WHERE name = 'columnValuesToBeNotInSet'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER','TINYINT','SMALLINT','INT','BIGINT','BYTEINT','BYTES','FLOAT','DOUBLE','DECIMAL','NUMERIC','TIMESTAMP','TIMESTAMPZ','TIME','DATE','DATETIME','INTERVAL','STRING','MEDIUMTEXT','TEXT','CHAR','VARCHAR','BOOLEAN','BINARY','VARBINARY','ARRAY','BLOB','LONGBLOB','MEDIUMBLOB','MAP','STRUCT','UNION','SET','GEOGRAPHY','ENUM','JSON','UUID','VARIANT','GEOMETRY','POINT','POLYGON')
)
WHERE name = 'columnValuesToBeNotNull'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('NUMBER','TINYINT','SMALLINT','INT','BIGINT','BYTEINT','BYTES','FLOAT','DOUBLE','DECIMAL','NUMERIC','TIMESTAMP','TIMESTAMPZ','TIME','DATE','DATETIME','INTERVAL','STRING','MEDIUMTEXT','TEXT','CHAR','VARCHAR','BOOLEAN','BINARY','VARBINARY','ARRAY','BLOB','LONGBLOB','MEDIUMBLOB','MAP','STRUCT','UNION','SET','GEOGRAPHY','ENUM','JSON','UUID','VARIANT','GEOMETRY','POINT','POLYGON')
)
WHERE name = 'columnValuesToBeUnique'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('BYTES', 'STRING', 'MEDIUMTEXT', 'TEXT', 'CHAR', 'VARCHAR')
)
WHERE name = 'columnValuesToMatchRegex'
AND supported_data_types IS NULL;

UPDATE test_definition 
SET json = JSON_INSERT(
	json,
	'$.supportedDataTypes',
	JSON_ARRAY('BYTES', 'STRING', 'MEDIUMTEXT', 'TEXT', 'CHAR', 'VARCHAR')
)
WHERE name = 'columnValuesToNotMatchRegex'
AND supported_data_types IS NULL;

UPDATE pipeline_service_entity 
SET json = JSON_REMOVE(json, '$.connection.config.dbConnection')
WHERE serviceType = 'Dagster';  


UPDATE pipeline_service_entity 
SET JSON = JSON_INSERT(
	JSON_REMOVE(json, '$.connection.config.type','$.serviceType'),
		'$.connection.config.type','GluePipeline',
		'$.serviceType','GluePipeline'
	)
where serviceType='Glue';