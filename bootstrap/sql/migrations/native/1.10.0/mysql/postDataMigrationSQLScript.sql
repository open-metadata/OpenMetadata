-- Migrate GlossaryTerm entities: rename 'status' field to 'entityStatus'
UPDATE glossary_term_entity
SET json = JSON_SET(
    JSON_REMOVE(json, '$.status'),
    '$.entityStatus',
    JSON_UNQUOTE(JSON_EXTRACT(json, '$.status'))
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1
  AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0;

-- Migrate DataContract entities: rename 'status' field to 'entityStatus' and change 'Active' to 'Approved'
UPDATE data_contract_entity
SET json = JSON_SET(
    JSON_REMOVE(json, '$.status'),
    '$.entityStatus',
    CASE 
        WHEN JSON_UNQUOTE(JSON_EXTRACT(json, '$.status')) = 'Active' THEN 'Approved'
        ELSE JSON_UNQUOTE(JSON_EXTRACT(json, '$.status'))
    END
)
WHERE JSON_CONTAINS_PATH(json, 'one', '$.status') = 1
  AND JSON_CONTAINS_PATH(json, 'one', '$.entityStatus') = 0;