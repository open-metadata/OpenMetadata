DELETE FROM entity_relationship
WHERE toEntity = 'ingestionPipeline'
AND toId NOT IN (
	SELECT DISTINCT id 
	FROM ingestion_pipeline_entity
);

CREATE TABLE IF NOT EXISTS user_tokens (
    token VARCHAR(36) GENERATED ALWAYS AS (json ->> 'token') STORED NOT NULL,
    userId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'userId') STORED NOT NULL,
    tokenType VARCHAR(50) GENERATED ALWAYS AS (json ->> 'tokenType') STORED NOT NULL,
    json JSONB NOT NULL,
    expiryDate BIGINT GENERATED ALWAYS AS ((json ->> 'expiryDate')::bigint) STORED NOT NULL,
    PRIMARY KEY (token)
);

UPDATE dbservice_entity
SET json = jsonb_set(
        json,
        '{connection,config,metastoreConnection}',
        jsonb_build_object('metastoreHostPort', json#>'{connection,config,metastoreHostPort}')
    )
WHERE serviceType = 'DeltaLake'
  AND json#>'{connection,config,metastoreHostPort}' is not null;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,metastoreHostPort}'
WHERE serviceType = 'DeltaLake';

UPDATE dbservice_entity
SET json = jsonb_set(
        json,
        '{connection,config,metastoreConnection}',
        jsonb_build_object('metastoreFilePath', json#>'{connection,config,metastoreFilePath}')
    )
WHERE serviceType = 'DeltaLake'
  AND json#>'{connection,config,metastoreFilePath}' is not null;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,metastoreFilePath}'
WHERE serviceType = 'DeltaLake';

ALTER TABLE test_definition 
ADD supported_data_types JSONB GENERATED ALWAYS AS (json -> 'supportedDataTypes') STORED;


UPDATE test_definition
SET json = jsonb_set(
  json,
  '{name}',
  '"tableColumnCountToEqual"',
  false
)
WHERE json->>'name' = 'TableColumnCountToEqual';

UPDATE test_definition 
SET json = jsonb_set(
  json,
  '{fullyQualifiedName}',
  '"tableColumnCountToEqual"',
  false
)
WHERE json->>'fullyQualifiedName' = 'TableColumnCountToEqual';


UPDATE test_definition
SET json = jsonb_set(
  json,
  '{name}',
  '"tableColumnToMatchSet"',
  false
)
WHERE json->>'name' = 'TableColumnToMatchSet';

UPDATE test_definition 
SET json = jsonb_set(
  json,
  '{fullyQualifiedName}',
  '"tableColumnToMatchSet"',
  false
)
WHERE json->>'fullyQualifiedName' = 'TableColumnToMatchSet';


UPDATE test_definition
SET json = jsonb_set(
  json,
  '{name}',
  '"tableColumnNameToExist"',
  false
)
WHERE json->>'name' = 'TableColumnNameToExist';

UPDATE test_definition 
SET json = jsonb_set(
  json,
  '{fullyQualifiedName}',
  '"tableColumnNameToExist"',
  false
)
WHERE json->>'fullyQualifiedName' = 'TableColumnNameToExist';


UPDATE test_definition
SET json = jsonb_set(
  json,
  '{name}',
  '"tableRowCountToBeBetween"',
  false
)
WHERE json->>'name' = 'TableRowCountToBeBetween';

UPDATE test_definition 
SET json = jsonb_set(
  json,
  '{fullyQualifiedName}',
  '"tableRowCountToBeBetween"',
  false
)
WHERE json->>'fullyQualifiedName' = 'TableRowCountToBeBetween';


UPDATE test_definition
SET json = jsonb_set(
  json,
  '{name}',
  '"tableColumnCountToBeBetween"',
  false
)
WHERE json->>'name' = 'TableColumnCountToBeBetween';

UPDATE test_definition 
SET json = jsonb_set(
  json,
  '{fullyQualifiedName}',
  '"tableColumnCountToBeBetween"',
  false
)
WHERE json->>'fullyQualifiedName' = 'TableColumnCountToBeBetween';


UPDATE test_definition
SET json = jsonb_set(
  json,
  '{name}',
  '"columnValuesToBeInSet"',
  false
)
WHERE json->>'name' = 'ColumnValuesToBeInSet';

UPDATE test_definition 
SET json = jsonb_set(
  json,
  '{fullyQualifiedName}',
  '"columnValuesToBeInSet"',
  false
)
WHERE json->>'fullyQualifiedName' = 'ColumnValuesToBeInSet';


UPDATE test_definition
SET json = jsonb_set(
  json,
  '{name}',
  '"tableRowCountToEqual"',
  false
)
WHERE json->>'name' = 'TableRowCountToEqual';

UPDATE test_definition 
SET json = jsonb_set(
  json,
  '{fullyQualifiedName}',
  '"tableRowCountToEqual"',
  false
)
WHERE json->>'fullyQualifiedName' = 'TableRowCountToEqual';



UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT"]',
  true
) 
WHERE json->>'name' = 'columnValueMeanToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT", "ARRAY", "SET"]',
  true
) 
WHERE json->>'name' = 'columnValueMaxToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT"]',
  true
) 
WHERE json->>'name' = 'columnValueMedianToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT"]',
  true
) 
WHERE json->>'name' = 'columnValueMinToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["BYTES", "STRING", "MEDIUMTEXT", "TEXT", "CHAR", "VARCHAR", "ARRAY"]',
  true
) 
WHERE json->>'name' = 'columnValueLengthsToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER","TINYINT","SMALLINT","INT","BIGINT","BYTEINT","BYTES","FLOAT","DOUBLE","DECIMAL","NUMERIC","TIMESTAMP","TIMESTAMPZ","TIME","DATE","DATETIME","INTERVAL","STRING","MEDIUMTEXT","TEXT","CHAR","VARCHAR","BOOLEAN","BINARY","VARBINARY","ARRAY","BLOB","LONGBLOB","MEDIUMBLOB","MAP","STRUCT","UNION","SET","GEOGRAPHY","ENUM","JSON","UUID","VARIANT","GEOMETRY","POINT","POLYGON"]',
  true
) 
WHERE json->>'name' = 'columnValuesMissingCount'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT"]',
  true
) 
WHERE json->>'name' = 'columnValuesSumToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT"]',
  true
) 
WHERE json->>'name' = 'columnValueStdDevToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT"]',
  true
) 
WHERE json->>'name' = 'columnValuesToBeBetween'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT", "BYTES", "STRING", "MEDIUMTEXT", "TEXT", "CHAR", "VARCHAR"]',
  true
) 
WHERE json->>'name' = 'columnValuesToBeInSet'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER", "INT", "FLOAT", "DOUBLE", "DECIMAL", "TINYINT", "SMALLINT", "BIGINT", "BYTEINT", "BYTES", "STRING", "MEDIUMTEXT", "TEXT", "CHAR", "VARCHAR"]',
  true
) 
WHERE json->>'name' = 'columnValuesToBeNotInSet'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER","TINYINT","SMALLINT","INT","BIGINT","BYTEINT","BYTES","FLOAT","DOUBLE","DECIMAL","NUMERIC","TIMESTAMP","TIMESTAMPZ","TIME","DATE","DATETIME","INTERVAL","STRING","MEDIUMTEXT","TEXT","CHAR","VARCHAR","BOOLEAN","BINARY","VARBINARY","ARRAY","BLOB","LONGBLOB","MEDIUMBLOB","MAP","STRUCT","UNION","SET","GEOGRAPHY","ENUM","JSON","UUID","VARIANT","GEOMETRY","POINT","POLYGON"]',
  true
) 
WHERE json->>'name' = 'columnValuesToBeNotNull'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["NUMBER","TINYINT","SMALLINT","INT","BIGINT","BYTEINT","BYTES","FLOAT","DOUBLE","DECIMAL","NUMERIC","TIMESTAMP","TIMESTAMPZ","TIME","DATE","DATETIME","INTERVAL","STRING","MEDIUMTEXT","TEXT","CHAR","VARCHAR","BOOLEAN","BINARY","VARBINARY","ARRAY","BLOB","LONGBLOB","MEDIUMBLOB","MAP","STRUCT","UNION","SET","GEOGRAPHY","ENUM","JSON","UUID","VARIANT","GEOMETRY","POINT","POLYGON"]',
  true
) 
WHERE json->>'name' = 'columnValuesToBeUnique'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["BYTES", "STRING", "MEDIUMTEXT", "TEXT", "CHAR", "VARCHAR"]',
  true
) 
WHERE json->>'name' = 'columnValuesToMatchRegex'
AND supported_data_types IS NULL;

UPDATE test_definition
SET json = jsonb_set(
  json,
  '{supportedDataTypes}',
  '["BYTES", "STRING", "MEDIUMTEXT", "TEXT", "CHAR", "VARCHAR"]',
  true
) 
WHERE json->>'name' = 'columnValuesToNotMatchRegex'
AND supported_data_types IS NULL;

UPDATE pipeline_service_entity
SET json = json::jsonb #- '{connection,config,dbConnection}'
WHERE serviceType = 'Dagster';

UPDATE pipeline_service_entity
SET json = jsonb_set(
      jsonb_set(
        json,
        '{serviceType}',
        '"GluePipeline"',
        true
      ),
      '{connection,config,type}',
      '"GluePipeline"',
      true
  )
WHERE serviceType = 'Glue';