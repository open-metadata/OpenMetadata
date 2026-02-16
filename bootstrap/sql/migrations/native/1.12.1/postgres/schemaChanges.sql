-- Enable allowImpersonation for all application bot users so they can impersonate users
UPDATE user_entity
SET json = jsonb_set(json::jsonb, '{allowImpersonation}', 'true')::json
WHERE (json::jsonb ->> 'isBot')::boolean = true
  AND name LIKE '%applicationbot';

-- Add Impersonate operation to ApplicationBotPolicy for existing deployments
UPDATE policy_entity
SET json = jsonb_set(
    json::jsonb,
    '{rules,0,operations}',
    (json->'rules'->0->'operations')::jsonb || '["Impersonate"]'::jsonb
)
WHERE name = 'ApplicationBotPolicy'
  AND json->'rules'->0->'operations' IS NOT NULL
  AND NOT (json->'rules'->0->'operations' @> '"Impersonate"'::jsonb);
