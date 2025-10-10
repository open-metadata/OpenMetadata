-- Increase Flowable ACTIVITY_ID_ column size to support longer user-defined workflow node names
ALTER TABLE ACT_RU_EVENT_SUBSCR ALTER COLUMN ACTIVITY_ID_ TYPE varchar(255);

-- Update workflow settings with new job acquisition interval settings
UPDATE openmetadata_settings
SET json = jsonb_set(
    jsonb_set(
        json,
        '{executorConfiguration,asyncJobAcquisitionInterval}',
        '60000',
        true
    ),
    '{executorConfiguration,timerJobAcquisitionInterval}',
    '60000',
    true
)
WHERE configtype = 'workflowSettings'
  AND json->'executorConfiguration' IS NOT NULL;