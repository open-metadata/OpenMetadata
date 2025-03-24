UPDATE test_case
SET json = json_set(json, '$.createdBy', json->>'$.updatedBy')
WHERE json->>'$.createdBy' IS NULL;