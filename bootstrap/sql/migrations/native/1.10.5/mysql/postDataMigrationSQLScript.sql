-- Remove deprecated defaultTemplateChecksum field from notification_template_entity
UPDATE notification_template_entity
SET json = JSON_REMOVE(json, '$.defaultTemplateChecksum')
WHERE JSON_CONTAINS_PATH(json, 'one', '$.defaultTemplateChecksum');