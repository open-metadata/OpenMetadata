-- Make domain policy and role non-system
UPDATE policy_entity SET json = JSONB_SET(json::jsonb, '{provider}', '"user"', true) where name = 'DomainOnlyAccessPolicy';
UPDATE policy_entity SET json = JSONB_SET(json::jsonb, '{allowDelete}', 'true', true) WHERE name = 'DomainOnlyAccessPolicy';
UPDATE role_entity SET json = JSONB_SET(json::jsonb, '{provider}', '"user"', true) where name = 'DomainOnlyAccessRole';
UPDATE role_entity SET json = JSONB_SET(json::jsonb, '{allowDelete}', 'true', true) WHERE name = 'DomainOnlyAccessRole';
