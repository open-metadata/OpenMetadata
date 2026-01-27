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

-- TRUNCATE FLOWABLE HISTORY TABLES
TRUNCATE TABLE ACT_HI_PROCINST;
TRUNCATE TABLE ACT_HI_ACTINST;
TRUNCATE TABLE ACT_HI_TASKINST;
TRUNCATE TABLE ACT_HI_VARINST;
TRUNCATE TABLE ACT_HI_DETAIL;
TRUNCATE TABLE ACT_HI_COMMENT;
TRUNCATE TABLE ACT_HI_ATTACHMENT;
TRUNCATE TABLE ACT_HI_IDENTITYLINK;