-- Data quality failure status extension time series
CREATE TABLE test_case_resolution_status_time_series (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.id'))) VIRTUAL NOT NULL,
  stateId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.stateId'))) VIRTUAL NOT NULL,
  assignee varchar(256) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseResolutionStatusDetails.assignee.name'))) VIRTUAL NULL,
  timestamp bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.timestamp'))) VIRTUAL NOT NULL,
  testCaseResolutionStatusType varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseResolutionStatusType'))) VIRTUAL NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json json NOT NULL,
  entityFQNHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  CONSTRAINT test_case_resolution_status_unique_constraint UNIQUE (id,timestamp,entityFQNHash),
  INDEX (id),
  INDEX(testCaseResolutionStatusType),
  INDEX(id, testCaseResolutionStatusType)

) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- DataInsightsApplication should not allow configuration
update apps_marketplace
set json = JSON_INSERT(
  JSON_REMOVE(json, '$.allowConfiguration'),
  '$.allowConfiguration',
  false
)
where name = 'DataInsightsApplication';

update installed_apps
set json = JSON_INSERT(
  JSON_REMOVE(json, '$.allowConfiguration'),
  '$.allowConfiguration',
  false
)
where name = 'DataInsightsApplication';

-- Rename NOOP Secret Manager to DB
update metadata_service_entity
set json = JSON_REPLACE(json, '$.connection.config.secretsManagerProvider', 'db')
where name = 'OpenMetadata'
  and JSON_EXTRACT(json, '$.connection.config.secretsManagerProvider') = 'noop';

-- Clean old test connections
TRUNCATE automations_workflow;
