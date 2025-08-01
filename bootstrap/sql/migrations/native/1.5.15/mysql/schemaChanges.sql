-- Make domain policy and role non-system
UPDATE policy_entity SET json = JSON_SET(json, '$.provider', 'user') where name = 'DomainOnlyAccessPolicy';
UPDATE policy_entity SET json = JSON_SET(json, '$.allowDelete', true) where name = 'DomainOnlyAccessPolicy';
UPDATE role_entity SET json = JSON_SET(json, '$.provider', 'user') where name = 'DomainOnlyAccessRole';
UPDATE role_entity SET json = JSON_SET(json, '$.allowDelete', true) where name = 'DomainOnlyAccessRole';