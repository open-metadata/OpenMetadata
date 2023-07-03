-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection.secretsManagerCredentials')
where name = 'OpenMetadata';

-- Rename githubCredentials to gitCredentials
UPDATE dashboard_service_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.githubCredentials'),
        '$.connection.config.gitCredentials',
        JSON_EXTRACT(json, '$.connection.config.githubCredentials')
    )
WHERE serviceType = 'Looker'
  AND JSON_EXTRACT(json, '$.connection.config.githubCredentials') IS NOT NULL;


-- Rename gcsConfig in BigQuery to gcpConfig
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.credentials.gcsConfig'),
    '$.connection.config.credentials.gcpConfig',
    JSON_EXTRACT(json, '$.connection.config.credentials.gcsConfig')
) where serviceType in ('BigQuery');

-- Rename gcsConfig in Datalake to gcpConfig
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.configSource.securityConfig.gcsConfig'),
    '$.connection.config.configSource.securityConfig.gcpConfig',
    JSON_EXTRACT(json, '$.connection.config.configSource.securityConfig.gcsConfig')
) where serviceType in ('Datalake')
AND JSON_EXTRACT(json, '$.connection.config.configSource.securityConfig.gcsConfig') IS NOT NULL;


-- Rename gcsConfig in dbt to gcpConfig
UPDATE ingestion_pipeline_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.gcsConfig'),
    '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.gcpConfig',
    JSON_EXTRACT(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.gcsConfig')
)
WHERE json -> '$.sourceConfig.config.type' = 'DBT'
AND JSON_EXTRACT(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.gcsConfig') IS NOT NULL;

-- Rename chartUrl in chart_entity to sourceUrl
UPDATE chart_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.chartUrl'),
        '$.sourceUrl',
        JSON_EXTRACT(json, '$.chartUrl')
    )
WHERE JSON_EXTRACT(json, '$.chartUrl') IS NOT NULL;

-- Rename dashboardUrl in dashboard_entity to sourceUrl
UPDATE dashboard_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.dashboardUrl'),
        '$.sourceUrl',
        JSON_EXTRACT(json, '$.dashboardUrl')
    )
WHERE JSON_EXTRACT(json, '$.dashboardUrl') IS NOT NULL;

-- Rename pipelineUrl in pipeline_entity to sourceUrl
UPDATE pipeline_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.pipelineUrl'),
        '$.sourceUrl',
        JSON_EXTRACT(json, '$.pipelineUrl')
    )
WHERE JSON_EXTRACT(json, '$.pipelineUrl') IS NOT NULL;


-- Rename taskUrl in pipeline_entity to sourceUrl
UPDATE pipeline_entity AS pe
JOIN (
    SELECT id, JSON_ARRAYAGG(JSON_OBJECT(
        'name', t.name,
        'sourceUrl', t.sourceUrl,
        'taskType', t.taskType,
        'description', t.description,
        'displayName', t.displayName,
        'fullyQualifiedName', t.fullyQualifiedName,
        'downstreamTasks', t.downstreamTasks,
        'tags', t.tags,
        'endDate', t.endDate,
        'startDate', t.startDate,
        'taskSQL', t.taskSQL
    )) AS updated_json
    FROM pipeline_entity,
    JSON_TABLE(
        json,
        '$.tasks[*]' COLUMNS (
            name VARCHAR(256) PATH '$.name',
            sourceUrl VARCHAR(256) PATH '$.taskUrl',
            taskType VARCHAR(256) PATH '$.taskType',
            description TEXT PATH '$.description',
            displayName VARCHAR(256) PATH '$.displayName',
            fullyQualifiedName VARCHAR(256) PATH '$.fullyQualifiedName',
            downstreamTasks JSON PATH '$.downstreamTasks',
            tags JSON PATH '$.tags',
            endDate VARCHAR(256) PATH '$.endDate',
            startDate VARCHAR(256) PATH '$.startDate',
            taskSQL TEXT PATH '$.taskSQL'
        )
    ) AS t
    GROUP BY id
) AS updated_data
ON pe.id = updated_data.id
SET pe.json = JSON_INSERT(
    JSON_REMOVE(pe.json, '$.tasks'),
    '$.tasks',
    updated_data.updated_json
);

-- Modify migrations for service connection of postgres and mysql to move password under authType

UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.password'),
    '$.connection.config.authType',
    JSON_OBJECT(),
    '$.connection.config.authType.password',
    JSON_EXTRACT(json, '$.connection.config.password'))
where serviceType in ('Postgres', 'Mysql');


-- Clean old test connections
TRUNCATE automations_workflow;

-- Remove sourceUrl in pipeline_entity from DatabricksPipeline & Fivetran
UPDATE pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceUrl')
WHERE JSON_EXTRACT(json, '$.serviceType') in ('DatabricksPipeline','Fivetran');

-- Remove sourceUrl in dashboard_entity from Mode
UPDATE dashboard_entity 
SET json = JSON_REMOVE(json, '$.sourceUrl')
WHERE JSON_EXTRACT(json, '$.serviceType') in ('Mode');

CREATE TABLE IF NOT EXISTS SERVER_CHANGE_LOG (
    installed_rank SERIAL,
    version VARCHAR(256)  PRIMARY KEY,
    migrationFileName VARCHAR(256) NOT NULL,
    checksum VARCHAR(256) NOT NULL,
    installed_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS SERVER_MIGRATION_SQL_LOGS (
    version VARCHAR(256) NOT NULL,
    sqlStatement VARCHAR(10000) NOT NULL,
    checksum VARCHAR(256) PRIMARY KEY,
    executedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update test definition parameterValues
UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
			'name', 'minValueForMeanInCol',
			'dataType', 'INT',
			'required', false,
			'description', 'Expected mean value for the column to be greater or equal than',
			'displayName', 'Min'
		),
		JSON_OBJECT(
			'name', 'maxValueForMeanInCol',
			'dataType', 'INT',
			'required', false,
			'description', 'Expected mean value for the column to be lower or equal than',
			'displayName', 'Max'
		)
	)	
)
WHERE name = 'columnValueMeanToBeBetween';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	        'name', 'minValueForMedianInCol',
	        'dataType', 'INT',
	        'required', false,
	        'description', 'Expected median value for the column to be greater or equal than',
	        'displayName', 'Min'
		),
		JSON_OBJECT(
        'name', 'maxValueForMedianInCol',
        'dataType', 'INT',
        'required', false,
        'description', 'Expected median value for the column to be lower or equal than',
        'displayName', 'Max'
		)
	)	
)
WHERE name = 'columnValueMedianToBeBetween';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	        'name', 'minValueForStdDevInCol',
	        'dataType', 'INT',
	        'required', false,
	        'description', 'Expected std. dev value for the column to be greater or equal than',
	        'displayName', 'Min'
		),
		JSON_OBJECT(
	        'name', 'maxValueForStdDevInCol',
	        'dataType', 'INT',
	        'required', false,
	        'description', 'Expected std. dev value for the column to be lower or equal than',
	        'displayName', 'Max'
		)
	)	
)
WHERE name = 'columnValueStdDevToBeBetween';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
	        'name', 'minLength',
	        'dataType', 'INT',
	        'required', false,
	        'description', 'The {minLength} for the column value. If minLength is not included, maxLength is treated as upperBound and there will be no minimum value length',
	        'displayName', 'Min'
		),
		JSON_OBJECT(
	        'name', 'maxLength',
	        'dataType', 'INT',
	        'required', false,
	        'description', 'The {maxLength} for the column value. if maxLength is not included, minLength is treated as lowerBound and there will be no maximum value length',
	        'displayName', 'Max'
		)
	)	
)
WHERE name = 'columnValueLengthsToBeBetween';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
        'name', 'minValue',
        'dataType', 'INT',
        'required', false,
        'description', 'The {minValue} value for the column entry. If minValue is not included, maxValue is treated as upperBound and there will be no minimum',
        'displayName', 'Min'
		),
		JSON_OBJECT(
        'name', 'maxValue',
        'dataType', 'INT',
        'required', false,
        'description', 'The {maxValue} value for the column entry. if maxValue is not included, minValue is treated as lowerBound and there will be no maximum',
        'displayName', 'Max'
		)
	)	
)
WHERE name = 'columnValuesToBeBetween';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
        'name', 'columnNames',
        'dataType', 'STRING',
        'required', true,
        'description', 'Expected columns names of the table to match the ones in {Column Names} -- should be a coma separated string',
        'displayName', 'Column Names'
		),
		JSON_OBJECT(
        'name', 'ordered',
        'dataType', 'BOOLEAN',
        'required', false,
        'description', 'Whether or not to considered the order of the list when performing the match check',
        'displayName', 'Ordered'
		)
	)	
)
WHERE name = 'tableColumnToMatchSet';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
        'name', 'minValue',
        'dataType', 'INT',
        'required', false,
        'description', 'Expected number of columns should be greater than or equal to {minValue}. If minValue is not included, maxValue is treated as upperBound and there will be no minimum',
        'displayName', 'Min'
		),
		JSON_OBJECT(
        'name', 'maxValue',
        'dataType', 'INT',
        'required', false,
        'description', 'Expected number of columns should be less than or equal to {maxValue}. If maxValue is not included, minValue is treated as lowerBound and there will be no maximum',
        'displayName', 'Max'
		)
	)	
)
WHERE name = 'tableRowCountToBeBetween';

UPDATE test_definition 
SET json = JSON_INSERT(
	JSON_REMOVE(json, '$.parameterDefinition'),
	'$.parameterDefinition',
	JSON_ARRAY(
		JSON_OBJECT(
		     'name', 'sqlExpression',
        	'displayName', 'SQL Expression',
        	'description', 'SQL expression to run against the table',
        	'dataType', 'STRING',
        	'required', 'true'
		),
		JSON_OBJECT(
			'name', 'strategy',
	        'displayName', 'Strategy',
    	    'description', 'Strategy to use to run the custom SQL query (i.e. `SELECT COUNT(<col>)` or `SELECT <col> (defaults to ROWS)',
        	'dataType', 'ARRAY',
	        'optionValues', JSON_ARRAY(
        	    'ROWS',
            	'COUNT'
    	    ),
	        'required', false
		),
		JSON_OBJECT(
			'name', 'threshold',
        	'displayName', 'Threshold',
        	'description', 'Threshold to use to determine if the test passes or fails (defaults to 0).',
        	'dataType', 'NUMBER',
        	'required', false
		)
	)	
)
WHERE name = 'tableCustomSQLQuery';

-- Modify migrations for service connection of airflow to move password under authType if 
-- Connection Type as Mysql or Postgres

UPDATE pipeline_service_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.connection.password'),
    '$.connection.config.connection.authType',
    JSON_OBJECT(),
    '$.connection.config.connection.authType.password',
    JSON_EXTRACT(json, '$.connection.config.connection.password'))
where serviceType = 'Airflow' 
AND JSON_EXTRACT(json, '$.connection.config.connection.type') in ('Postgres', 'Mysql')
AND JSON_EXTRACT(json, '$.connection.config.connection.password') IS NOT NULL;
