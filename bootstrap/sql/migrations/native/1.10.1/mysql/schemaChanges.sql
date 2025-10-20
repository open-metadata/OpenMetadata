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