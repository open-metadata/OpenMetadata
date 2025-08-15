-- Migrate GlossaryTerm entities: rename 'status' field to 'entityStatus'
UPDATE glossary_term_entity
SET json = jsonb_set(
    json - 'status',
    '{entityStatus}',
    json->'status'
)
WHERE json ?? 'status'
  AND NOT json ?? 'entityStatus';

-- Migrate DataContract entities: rename 'status' field to 'entityStatus' and change 'Active' to 'Approved'
UPDATE data_contract_entity
SET json = jsonb_set(
    json - 'status',
    '{entityStatus}',
    CASE 
        WHEN json->>'status' = 'Active' THEN '"Approved"'::jsonb
        ELSE json->'status'
    END
)
WHERE json ?? 'status'
  AND NOT json ?? 'entityStatus';