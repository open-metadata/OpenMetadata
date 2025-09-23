-- If you upgraded to 1.9.8 with the initial migration and then upgraded to 1.9.9
-- `'profileData', pdts.json` `pdts.json` will have the profileData in the json field
-- you will hence have performed the same migration again. This brings the json 
-- `profileData`field back to the original state.
UPDATE profiler_data_time_series
SET json = JSON_SET(json, '$.profileData', json->'$.profileData.profileData')
WHERE json->>'$.profileData.profileData' IS NOT NULL;

-- Migration script to restructure Databricks connection configuration
-- Move 'token' field from connection.config.token to connection.config.authType.token
UPDATE dbservice_entity
SET
    json = JSON_SET (
        JSON_REMOVE (json, '$.connection.config.token'),
        '$.connection.config.authType',
        JSON_OBJECT (
            'token',
            JSON_EXTRACT (json, '$.connection.config.token')
        )
    )
WHERE
    serviceType = 'Databricks';
