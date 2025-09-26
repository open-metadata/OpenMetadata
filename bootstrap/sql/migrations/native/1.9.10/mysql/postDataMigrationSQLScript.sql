-- If you upgraded to 1.9.8 with the initial migration and then upgraded to 1.9.9
-- `'profileData', pdts.json` `pdts.json` will have the profileData in the json field
-- you will hence have performed the same migration again. This brings the json 
-- `profileData`field back to the original state.
UPDATE profiler_data_time_series
SET json = JSON_SET(json, '$.profileData', json->'$.profileData.profileData')
WHERE json->>'$.profileData.profileData' IS NOT NULL;
