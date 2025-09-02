-- Add "Data Product Domain Validation" rule to existing entityRulesSettings configuration
UPDATE openmetadata_settings
SET json = JSON_ARRAY_APPEND(
    json,
    '$.entitySemantics',
    JSON_OBJECT(
        'name', 'Data Product Domain Validation',
        'description', 'Validates that Data Products assigned to an entity match the entity''s domains.',
        'rule', '{"validateDataProductDomainMatch":[{"var":"dataProducts"},{"var":"domains"}]}',
        'enabled', true,
        'provider', 'system'
    )
)
WHERE configType = 'entityRulesSettings'
  AND JSON_EXTRACT(json, '$.entitySemantics') IS NOT NULL
  AND NOT JSON_CONTAINS(
    JSON_EXTRACT(json, '$.entitySemantics[*].name'),
    JSON_QUOTE('Data Product Domain Validation')
  );
-- Increase Flowable ACTIVITY_ID_ column size to support longer user-defined workflow node names
ALTER TABLE ACT_RU_EVENT_SUBSCR MODIFY ACTIVITY_ID_ varchar(255);