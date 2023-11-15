
-- update the timestamps to millis for dbt test results
UPDATE data_quality_data_time_series dqdts
SET dqdts.json = JSON_INSERT(
    JSON_REMOVE(dqdts.json, '$.timestamp'),
    '$.timestamp',
    JSON_EXTRACT(dqdts.json, '$.timestamp') * 1000
 )
WHERE dqdts.extension = 'testCase.testCaseResult'
  AND JSON_EXTRACT(dqdts.json, '$.timestamp') REGEXP '^[0-9]{10}$'
;

-- update elasticsearch connection
UPDATE search_service_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.caCert'),
    '$.connection.config.sslConfig',
    JSON_OBJECT(
        'certificates',
        JSON_OBJECT(
            'caCertPath',
            JSON_EXTRACT(json, '$.connection.config.caCert')
        )
    )
)
WHERE
    serviceType = 'ElasticSearch'
    AND JSON_EXTRACT(json, '$.connection.config.caCert') IS NOT NULL;
