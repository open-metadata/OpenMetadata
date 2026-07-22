
-- Add Topic permissions to AutoClassificationBotPolicy for messaging auto-classification support
UPDATE policy_entity
SET json = jsonb_set(
    json::jsonb,
    '{rules}',
    (json->'rules') || jsonb_build_object(
        'name', 'AutoClassificationBotRule-Allow-Topic',
        'description', 'Allow adding tags and sample data to the topics',
        'resources', jsonb_build_array('Topic'),
        'operations', jsonb_build_array('EditAll', 'ViewAll'),
        'effect', 'allow'
    )
)
WHERE json->>'name' = 'AutoClassificationBotPolicy'
  AND NOT (json->'rules') @> jsonb_build_array(jsonb_build_object('name', 'AutoClassificationBotRule-Allow-Topic'));
