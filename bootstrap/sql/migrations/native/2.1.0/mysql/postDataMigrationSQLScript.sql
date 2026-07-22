
-- Add Topic permissions to AutoClassificationBotPolicy for messaging auto-classification support
UPDATE policy_entity
SET json = JSON_ARRAY_APPEND(
    json,
    '$.rules',
    JSON_OBJECT(
        'name', 'AutoClassificationBotRule-Allow-Topic',
        'description', 'Allow adding tags and sample data to the topics',
        'resources', JSON_ARRAY('Topic'),
        'operations', JSON_ARRAY('EditAll', 'ViewAll'),
        'effect', 'allow'
    )
)
WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$.name')) = 'AutoClassificationBotPolicy'
  AND NOT JSON_CONTAINS(json, JSON_OBJECT('name', 'AutoClassificationBotRule-Allow-Topic'), '$.rules');
