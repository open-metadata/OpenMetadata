UPDATE test_definition
SET json = JSON_SET(
    json,
    '$.testPlatforms',
    CAST(REPLACE(
        JSON_EXTRACT(json, '$.testPlatforms'),
        '"DBT"',
        '"dbt"'
    ) AS JSON)
)
WHERE JSON_CONTAINS(json, '"DBT"', '$.testPlatforms');

-- Delete searchSettings to force reload from packaged searchSettings.json with field-based aggregations
DELETE FROM openmetadata_settings WHERE configType='searchSettings';

-- Increase Flowable ACTIVITY_ID_ column size to support longer user-defined workflow node names
ALTER TABLE ACT_RU_EVENT_SUBSCR MODIFY ACTIVITY_ID_ varchar(255);

-- Update workflow settings with new job acquisition interval settings
UPDATE openmetadata_settings
SET json = JSON_SET(
    json,
    '$.executorConfiguration.asyncJobAcquisitionInterval', 60000,
    '$.executorConfiguration.timerJobAcquisitionInterval', 60000
)
WHERE configType = 'workflowSettings'
  AND JSON_EXTRACT(json, '$.executorConfiguration') IS NOT NULL;