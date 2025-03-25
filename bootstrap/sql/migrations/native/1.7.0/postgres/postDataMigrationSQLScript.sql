UPDATE test_case
SET json = json || jsonb_build_object('createdBy', json->>'updatedBy')
WHERE json->>'createdBy' IS NULL;