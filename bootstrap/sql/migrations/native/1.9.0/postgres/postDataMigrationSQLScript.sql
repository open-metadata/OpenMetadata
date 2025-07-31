UPDATE test_definition 
SET json = jsonb_set(json, '{supportsRowLevelPassedFailed}', 'true'::jsonb)
WHERE json->>'name' = 'tableCustomSQLQuery';