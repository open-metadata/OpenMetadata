UPDATE test_definition 
SET json = JSON_SET(json, '$.supportsRowLevelPassedFailed', true)
WHERE JSON_EXTRACT(json, '$.name') = 'tableCustomSQLQuery';