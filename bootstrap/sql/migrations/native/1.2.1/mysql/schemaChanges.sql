
--update the timestamps to millis for dbt test results
UPDATE data_quality_data_time_series dqdts
SET dqdts.json = JSON_INSERT(
    JSON_REMOVE(dqdts.json, '$.timestamp'),
    '$.timestamp',
    JSON_EXTRACT(dqdts.json, '$.timestamp') * 1000
 )
WHERE dqdts.extension = 'testCase.testCaseResult'
  AND JSON_EXTRACT(dqdts.json, '$.timestamp') REGEXP '^[0-9]{10}$'
;