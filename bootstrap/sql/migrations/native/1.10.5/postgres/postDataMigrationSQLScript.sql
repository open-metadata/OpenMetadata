-- Remove deprecated defaultTemplateChecksum field from notification_template_entity
UPDATE notification_template_entity
SET json = json::jsonb - 'defaultTemplateChecksum';