-- Enable allowImpersonation for all application bot users so they can impersonate users
UPDATE user_entity
SET json = JSON_SET(json, '$.allowImpersonation', true)
WHERE JSON_EXTRACT(json, '$.isBot') = true
  AND name LIKE '%applicationbot';

-- Add Impersonate operation to ApplicationBotPolicy for existing deployments
UPDATE policy_entity
SET json = JSON_ARRAY_APPEND(json, '$.rules[0].operations', 'Impersonate')
WHERE name = 'ApplicationBotPolicy'
  AND JSON_EXTRACT(json, '$.rules[0].operations') IS NOT NULL
  AND NOT JSON_CONTAINS(JSON_EXTRACT(json, '$.rules[0].operations'), '"Impersonate"');
