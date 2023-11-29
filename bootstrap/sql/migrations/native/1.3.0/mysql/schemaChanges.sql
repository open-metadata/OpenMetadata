-- Data quality failure status extension time series
CREATE TABLE data_quality_failure_status_extension_time_series (
  id varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.id'))) VIRTUAL NOT NULL,
  sequenceId varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.sequenceId'))) VIRTUAL NOT NULL,
  extension varchar(256) NOT NULL,
  timestamp bigint unsigned GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.timestamp'))) VIRTUAL NOT NULL,
  testCaseFailureStatusType varchar(36) GENERATED ALWAYS AS (json_unquote(json_extract(json,'$.testCaseFailureStatusType'))) VIRTUAL NOT NULL,
  jsonSchema varchar(256) NOT NULL,
  json json NOT NULL,
  entityFQNHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  CONSTRAINT data_quality_failure_status_unique_constraint UNIQUE (id,timestamp,extension),
  INDEX (id),
  INDEX(testCaseFailureStatusType),
  INDEX(id, testCaseFailureStatusType)

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
