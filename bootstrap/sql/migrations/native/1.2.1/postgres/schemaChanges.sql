
-- fixed Query for updating viewParsingTimeoutLimit
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(
  json::jsonb #- '{sourceConfig,config,viewParsingTimeoutLimit}',
  '{sourceConfig,config,queryParsingTimeoutLimit}',
  (json #> '{sourceConfig,config,viewParsingTimeoutLimit}')::jsonb,
  true
)
WHERE json #>> '{pipelineType}' = 'metadata'
AND json #>> '{sourceConfig,config,type}' = 'DatabaseMetadata';


-- update the timestamps to millis for dbt test results
UPDATE data_quality_data_time_series dqdts
SET json = jsonb_set(
	dqdts.json::jsonb,
	'{timestamp}',
	to_jsonb(((dqdts.json ->> 'timestamp')::bigint)*1000)
)
WHERE dqdts.extension = 'testCase.testCaseResult'
  AND (json->>'timestamp') ~ '^[0-9]{10}$';



UPDATE search_service_entity
SET json = JSONB_SET(
    json::jsonb,
    '{connection,config}',
    json::jsonb #> '{connection,config}' #- '{caCert}' || 
    jsonb_build_object(
        'sslConfig',
        jsonb_build_object(
            'certificates',
            jsonb_build_object('caCertPath', json #> '{connection,config,caCert}')
        )
    ),
    true
)
WHERE
    serviceType = 'ElasticSearch'
    AND json #> '{connection,config,caCert}' IS NOT NULL;
